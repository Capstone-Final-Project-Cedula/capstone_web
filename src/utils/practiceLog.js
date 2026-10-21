// TEMPORARY practice session log (plan 001.7; plan 003 replaces it).
// The browser alone knows the tries, the seconds and the typed fixes of an interview, so it builds one
// note per finished question and sends it to the backend without making anyone wait. Nothing here
// changes what staff see; every failure is swallowed.

const ADDRESS_PART_PREFIX = 'address_';
const seconds1 = (ms) => Math.round(ms / 100) / 10;
const text500 = (value) => String(value ?? '').slice(0, 500);

/**
 * Collects what happened to each question and builds the note when it is answered or given up.
 * `savedForm(field, value)` turns a voice-parsed value into the form the CTC saves (the birthday as
 * the ISO date, names title-cased ...), so the backend compares like with like.
 */
export const createPracticeRecorder = ({ savedForm = (field, value) => value, now = () => Date.now() } = {}) => {
  let questions = {};
  let addressSeconds = 0;
  let addressEngine = 'whisper';

  const entry = (key) => {
    if (!questions[key]) questions[key] = { askedAt: null, attempts: [], first: undefined };
    return questions[key];
  };

  const build = (key, { value, engine }) => {
    const e = entry(key);
    const last = e.attempts[e.attempts.length - 1];
    const elapsed = e.askedAt === null ? null : seconds1(now() - e.askedAt);
    const note = {
      field: key,
      attempts: e.attempts.length,
      attempt_details: [...e.attempts],
      first_value: e.first === undefined ? null : e.first,
      accepted_value: value === undefined || value === null || value === '' ? null : text500(value),
      accepted_engine: engine || last?.engine || 'whisper',
      seconds: elapsed,
    };
    // A question visited again ("go back to my surname") keeps its first voice value and its tries, so a
    // correction still shows as changed; only reset() (a new applicant) clears them.
    e.askedAt = null;
    if (key.startsWith(ADDRESS_PART_PREFIX)) {
      addressSeconds += elapsed || 0;
      addressEngine = note.accepted_engine;
    }
    return note;
  };

  return {
    /** The question was asked (again): only the first ask starts the clock. */
    asked(key) {
      const e = entry(key);
      if (e.askedAt === null) e.askedAt = now();
    },

    /** One try: what was heard (or typed), by which engine, and the Whisper seconds. */
    heard(key, { text, engine, seconds, reason }) {
      entry(key).attempts.push({
        heard: text500(text),
        engine: engine || 'whisper',
        seconds: typeof seconds === 'number' ? seconds : null,
        parsed: null,
        ok: null,
        reason: reason || null,
      });
    },

    /** What /answer made of the latest try. The first usable one is the "first voice-parsed value". */
    parsed(key, result) {
      const e = entry(key);
      const last = e.attempts[e.attempts.length - 1];
      if (last) {
        last.parsed = text500(result?.value);
        last.ok = Boolean(result?.ok);
        last.reason = result?.reason || null;
      }
      const engine = last?.engine;
      if (e.first === undefined && result?.ok && result.value && (engine === 'whisper' || engine === 'browser')) {
        e.first = savedForm(key, result.value);
      }
    },

    /** The answer was accepted. Returns the note to send. */
    accept(key, value, engine) {
      return build(key, { value, engine });
    },

    /** Too many unusable tries: the question is left blank for now. */
    skip(key) {
      return build(key, { value: null, engine: 'skipped' });
    },

    /** The three address parts are joined: the one `address` summary row (compared with the saved address at issue). */
    joined(value) {
      const note = {
        field: 'address',
        attempts: 0,
        attempt_details: [],
        first_value: savedForm('address', value),
        accepted_value: text500(value),
        accepted_engine: addressEngine,
        seconds: Math.round(addressSeconds * 10) / 10,
      };
      addressSeconds = 0;
      return note;
    },

    reset() {
      questions = {};
      addressSeconds = 0;
    },
  };
};

/**
 * One practice session per applicant: started at "I agree, start", notes sent in order without
 * blocking, finished as "abandoned" if the applicant leaves. `api` is practiceLogAPI.
 * Off on the backend (the default) = `start` answers enabled: false and nothing is ever sent.
 */
export const createPracticeSession = (api) => {
  let current = null;

  const run = (session, task) => {
    session.ready = session.ready.then(task).catch(() => {});
  };

  return {
    /** The id to send with /forms/issue, or null when the log is off or not started. */
    get id() {
      return current?.id ?? null;
    },

    get active() {
      return current !== null;
    },

    start(inputMethod = 'manual') {
      if (current) return;
      const session = { id: null, ready: Promise.resolve() };
      current = session;
      run(session, async () => {
        const { data } = await api.start(inputMethod);
        if (data?.enabled && data.session_id) session.id = data.session_id;
        else if (current === session) current = null;   // log off: nothing more is ever sent
      });
    },

    note(note) {
      const session = current;
      if (!session || !note) return;
      run(session, async () => { if (session.id) await api.addAnswer(session.id, note); });
    },

    /** The CTC was issued: the backend closed the session; later notes still go out. */
    issued() {
      current = null;
    },

    /**
     * Leaving the page or starting over before the CTC was issued. `keepalive`: the tab is closing or
     * reloading, so send at once with a request that outlives the page (only if the id is already known).
     */
    finish({ keepalive = false } = {}) {
      const session = current;
      current = null;
      if (!session) return;
      if (keepalive && session.id && api.finishKeepalive) {
        api.finishKeepalive(session.id);
        return;
      }
      run(session, async () => { if (session.id) await api.finish(session.id); });
    },
  };
};
