import {
  SPELLED_TRIES, SPOKEN_TRIES, newLadder, noButtonLabel, onMiss, startSpellingLadder, takeDue, withDue,
} from './ladder';

const run = (misses, canSpell, start = newLadder()) => {
  let ladder = start;
  const steps = [];
  for (let i = 0; i < misses; i += 1) {
    const out = onMiss(ladder, { canSpell });
    ladder = out.ladder;
    steps.push(out.next);
  }
  return { ladder, steps };
};

describe('the voice ladder (plan 002.2)', () => {
  test('3 spoken tries, then 2 spelled, then skip', () => {
    expect(SPOKEN_TRIES).toBe(3);
    expect(SPELLED_TRIES).toBe(2);
    expect(run(5, true).steps).toEqual(['again', 'again', 'spell', 'again', 'skip']);
  });

  test('a field that cannot be spelled is skipped after 3 spoken tries', () => {
    expect(run(3, false).steps).toEqual(['again', 'again', 'skip']);
  });

  test('each miss counts once', () => {
    const { ladder } = run(2, true);
    expect(ladder).toEqual({ spoken: 2, spelled: 0, spelling: false });
  });

  test('spelling started by the applicant uses the spelled tries only', () => {
    const start = startSpellingLadder(onMiss(newLadder(), { canSpell: true }).ladder);
    expect(run(2, true, start).steps).toEqual(['again', 'skip']);
  });

  test('the No button says what happens next', () => {
    expect(noButtonLabel(newLadder(), { canSpell: true })).toBe('No, say again');      // names too (plan 002.2)
    expect(noButtonLabel({ spoken: 2, spelled: 0, spelling: false }, { canSpell: true })).toBe('No, spell it');
    expect(noButtonLabel({ spoken: 2, spelled: 0, spelling: false }, { canSpell: false })).toBe('No, skip for now');
    expect(noButtonLabel({ spoken: 3, spelled: 0, spelling: true }, { canSpell: true })).toBe('No, spell it');
    expect(noButtonLabel({ spoken: 3, spelled: 1, spelling: true }, { canSpell: true })).toBe('No, skip for now');
  });

  test('a new answer on the last spoken try is read back once, then its step is due once (Codex verify round 2)', () => {
    // Three re-answers at "is that correct?" for a name: the third decides 'spell'.
    let ladder = newLadder();
    let next;
    for (let i = 0; i < 3; i += 1) ({ ladder, next } = onMiss(ladder, { canSpell: true }));
    expect(next).toBe('spell');
    const ladders = { 0: withDue(ladder, next) };
    expect(ladders[0]).toMatchObject({ spoken: 3, spelling: false, due: 'spell' });   // not spelling yet
    expect(noButtonLabel(ladders[0], { canSpell: true })).toBe('No, spell it');
    // Any reply but yes takes the due step; it is never taken (or counted) twice.
    expect(takeDue(ladders, 0)).toBe('spell');
    expect(takeDue(ladders, 0)).toBeNull();
    expect(ladders[0].spoken).toBe(3);
    // A field that cannot be spelled: the last re-answer is read back, then skipped.
    expect(noButtonLabel(withDue({ spoken: 3, spelled: 0, spelling: false }, 'skip'), { canSpell: false })).toBe('No, skip for now');
    expect(takeDue({}, 5)).toBeNull();
  });

  test('a fresh ladder for a question asked again from the end step', () => {
    expect(newLadder()).toEqual({ spoken: 0, spelled: 0, spelling: false });
  });
});
