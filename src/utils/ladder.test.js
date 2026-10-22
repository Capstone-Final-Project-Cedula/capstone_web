import { SPELLED_TRIES, SPOKEN_TRIES, newLadder, onMiss, startSpellingLadder } from './ladder';

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

  test('a fresh ladder for a question asked again from the end step', () => {
    expect(newLadder()).toEqual({ spoken: 0, spelled: 0, spelling: false });
  });
});
