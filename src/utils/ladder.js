// The voice ladder for one question (plan 002.2): up to 3 spoken tries, then up to 2 spelled tries
// (spellable fields only), then the question is skipped and asked again at the end. Nothing here
// opens a text box: typing happens only at the end step, or when staff press "type" themselves.
//
// A try is one turn that ends without an accepted answer (unusable text, silence, a "no" or a new
// answer at "is that correct?", a failed spelling). Each turn counts once.

export const SPOKEN_TRIES = 3;
export const SPELLED_TRIES = 2;

export const newLadder = () => ({ spoken: 0, spelled: 0, spelling: false });

/**
 * One try that did not give an accepted answer. Returns { ladder, next }:
 *   'again' — ask (or spell) once more;  'spell' — spoken tries used up, spell it now;  'skip' — skip it.
 */
export const onMiss = (ladder, { canSpell }) => {
  if (ladder.spelling) {
    const spelled = ladder.spelled + 1;
    return { ladder: { ...ladder, spelled }, next: spelled >= SPELLED_TRIES ? 'skip' : 'again' };
  }
  const spoken = ladder.spoken + 1;
  if (spoken < SPOKEN_TRIES) return { ladder: { ...ladder, spoken }, next: 'again' };
  if (canSpell) return { ladder: { ...ladder, spoken, spelling: true }, next: 'spell' };
  return { ladder: { ...ladder, spoken }, next: 'skip' };
};

/**
 * The last spoken try was a new answer at "is that correct?": it is read back for one last yes, and the
 * step the ladder decided ('spell' or 'skip') is due if that is not a yes. Spelling has not started yet.
 */
export const withDue = (ladder, next) => ({ ...ladder, spelling: false, due: next });

/** The step due on this ladder, or null; taken once (Codex verify round 2, plan 002.2: no endless re-answers). */
export const takeDue = (ladders, key) => {
  const due = ladders[key]?.due || null;
  if (due) ladders[key] = { ...ladders[key], due: null };
  return due;
};

/** The applicant started spelling on their own (letters at "is that correct?"): spelled tries from now on. */
export const startSpellingLadder = (ladder) => ({ ...ladder, spelling: true });

/** The "No" button at "is that correct?" says what a no does next. */
export const noButtonLabel = (ladder, { canSpell }) => {
  const { next } = onMiss(ladder, { canSpell });
  if (next === 'skip') return 'No, skip for now';
  if (next === 'spell' || ladder.spelling) return 'No, spell it';
  return 'No, say again';
};
