// Evaluation mode (plan 003). The backend logs each Whisper try and each answer check by itself; the
// browser only tells it what the server cannot see:
//   - which interview a call belongs to, which question is being asked and which step of the ladder
//     (spoken / spelled / end_said / confirm / review), plus a try id shared by the Whisper call and the
//     answer check of the same try (Codex plan review, finding 1);
//   - one batch at the end: typed vs staff, skips, seconds per question (the attempt recorder's notes).
// Nothing here is visible to staff, and every failure is swallowed.

const TRY_STEPS = ['spoken', 'spelled', 'end_said'];
const ASKED_ABOUT = ['confirm', 'missing_choice', 'spelling'];   // Whisper keys that are not questions themselves
const PENDING_MS = 60000;
const CONFIRM_MS = 15000;   // a reply at "is that correct?" that turns out to be a new answer
const ERROR_REASONS = ['whisper-failed', 'extract-failed', 'mic-blocked'];

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * What the next Whisper / answer-check call should carry. `ask(key)` says which question is being asked
 * (a place-of-birth step or an address part is its own key), `endStep()` that skipped questions are being
 * asked again at the end, `reset()` a new applicant.
 */
export const createEvalContext = ({ newId = randomId, now = () => Date.now() } = {}) => {
  let sessionId = null;
  let field = null;
  let stage = 'spoken';
  let pending = null;
  let confirmTry = null;

  const stepFor = (fieldKey) => {
    if (fieldKey === 'review') return 'review';
    if (fieldKey === 'confirm' || fieldKey === 'missing_choice') return 'confirm';
    if (fieldKey === 'spelling') return stage === 'end_said' ? 'end_said' : 'spelled';   // the end step is not the ladder
    return stage;
  };

  return {
    get sessionId() { return sessionId; },
    setSession(id) { sessionId = id || null; if (!id) pending = null; },
    ask(key) { field = key || null; confirmTry = null; },
    endStep() { stage = 'end_said'; },
    reset() { field = null; stage = 'spoken'; pending = null; confirmTry = null; },

    /** For POST /speech/transcribe, or null when no evaluation session is running. */
    forTranscribe(fieldKey) {
      if (!sessionId) return null;
      const step = stepFor(fieldKey);
      const target = step === 'review' ? 'review' : (ASKED_ABOUT.includes(fieldKey) ? field : fieldKey);
      if (!target) return null;
      const tryId = newId();
      pending = TRY_STEPS.includes(step) ? { tryId, field: target, step, at: now() } : null;
      confirmTry = step === 'confirm' ? { tryId, field: target, at: now() } : null;
      return { session: sessionId, field: target, step, tryId };
    },

    /** For POST /extraction/answer: joined to the Whisper try just before it, or a browser / typed try. */
    forExtraction(key) {
      if (!sessionId) return null;
      const p = pending;
      pending = null;
      if (p && p.field === key && now() - p.at < PENDING_MS) return { session: sessionId, step: p.step, tryId: p.tryId };
      // The reply at the read-back was a new answer, not a yes / no: it is that spoken (or spelled) try.
      const c = confirmTry;
      confirmTry = null;
      if (c && c.field === key && now() - c.at < CONFIRM_MS) {
        return { session: sessionId, step: stage === 'end_said' ? 'end_said' : 'spoken', tryId: c.tryId };
      }
      return { session: sessionId, step: stage === 'end_said' ? 'end_said' : 'spoken', tryId: null };
    },
  };
};

export const evalContext = createEvalContext();

const text500 = (value) => (value === undefined || value === null || value === '' ? null : String(value).slice(0, 500));

/** The attempt recorder's note for one question -> the small note the backend wants. */
export const toFieldNote = (note) => ({
  field: note.field,
  accepted_engine: note.accepted_engine || 'whisper',
  accepted_value: text500(note.accepted_value),
  left_blank: (note.attempt_details || []).some((a) => a.reason === 'left-blank'),
  skipped: note.accepted_engine === 'skipped',
  seconds: typeof note.seconds === 'number' ? note.seconds : null,
});

const deviceLabel = () => {
  try {
    return `${navigator.platform || 'unknown'} | ${String(navigator.userAgent || '').slice(0, 150)}`;
  } catch {
    return null;
  }
};

/**
 * One evaluation session per applicant: started at "I agree, start", the notes kept in memory, the batch
 * sent with /forms/issue (or with /finish when the applicant leaves). `api` is evalAPI.
 * Off on the backend = `start` answers session_id null and nothing more is sent.
 */
export const createEvalSession = (api, ctx = evalContext, { device = deviceLabel } = {}) => {
  let current = null;
  let notes = {};
  let errors = 0;

  const run = (session, task) => {
    session.ready = session.ready.then(task).catch(() => {});
  };
  const batch = () => ({ notes: Object.values(notes), errors: Math.min(errors, 1000) });

  return {
    get id() { return current?.id ?? null; },
    get active() { return current !== null; },

    start(inputMethod = 'manual') {
      if (current) return;
      const session = { id: null, ready: Promise.resolve() };
      current = session;
      notes = {};
      errors = 0;
      run(session, async () => {
        const { data } = await api.start(inputMethod, device());
        if (data?.session_id) {
          session.id = data.session_id;
          if (current === session) ctx.setSession(session.id);
        } else if (current === session) {
          current = null;   // logging is off: nothing more is ever sent
        }
      });
    },

    note(note) {
      if (!current || !note?.field) return;
      const skippedBefore = Boolean(notes[note.field]?.skipped);
      notes[note.field] = { ...toFieldNote(note), skipped: skippedBefore || note.accepted_engine === 'skipped' };   // a recovered skip is still a skip
      errors += (note.attempt_details || []).filter((a) => ERROR_REASONS.includes(a.reason)).length;
    },

    /** What only the browser knows, to send with /forms/issue. */
    batch,

    /** The CTC was issued: the backend closed and scored the session. */
    issued() {
      current = null;
      ctx.setSession(null);
    },

    /** Leaving the page or starting over before the CTC was issued ("abandoned"). */
    finish({ keepalive = false } = {}) {
      const session = current;
      current = null;
      ctx.setSession(null);
      if (!session) return;
      const body = batch();
      if (keepalive && session.id && api.finishKeepalive) {
        api.finishKeepalive(session.id, body);
        return;
      }
      run(session, async () => { if (session.id) await api.finish(session.id, body); });
    },
  };
};
