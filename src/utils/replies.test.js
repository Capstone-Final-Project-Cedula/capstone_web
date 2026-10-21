import { isNoAnswer, isYesAnswer } from './replies';

describe('isYesAnswer (plan 001.6)', () => {
  test.each(['Yes.', 'Yes po.', 'Opo.', 'Oo.', 'Oo po', 'Oh.', 'O.', 'Oh po.', 'O, oo.', 'Oop.', 'Yes. Go back.', 'Oo, tama'])(
    '%s is a yes',
    (reply) => expect(isYesAnswer(reply)).toBe(true),
  );

  test.each(['Oh, hindi.', 'O, hindi po.', 'Oo, pero mali', 'Yes but change it', 'No.', 'Hindi po.'])(
    '%s is not a yes (negation)',
    (reply) => expect(isYesAnswer(reply)).toBe(false),
  );

  test('spelled letters starting with O are a spelling, not a yes', () => {
    expect(isYesAnswer('O, R, D, I, Z')).toBe(false);
  });

  test.each([
    'Yes, thank you very much for watching this video',          // words the tiny model invented
    'Opo, salamat po sa inyong lahat at sa tulong',
    'Oo tama yan sige na po salamat kaayo',
  ])('a yes with extra words after it is still a yes: %s (plan 001.8)', (reply) => {
    expect(isYesAnswer(reply)).toBe(true);
  });
});

describe('isNoAnswer', () => {
  test.each(['No.', 'Hindi po.', 'Mali.', 'Nope'])('%s is a no', (reply) => expect(isNoAnswer(reply)).toBe(true));
  test('Oh is not a no', () => expect(isNoAnswer('Oh.')).toBe(false));
});
