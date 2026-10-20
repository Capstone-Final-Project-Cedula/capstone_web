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

  test('a long sentence is not a plain yes', () => {
    expect(isYesAnswer('yes my name is maria clara santos dela cruz')).toBe(false);
  });
});

describe('isNoAnswer', () => {
  test.each(['No.', 'Hindi po.', 'Mali.', 'Nope'])('%s is a no', (reply) => expect(isNoAnswer(reply)).toBe(true));
  test('Oh is not a no', () => expect(isNoAnswer('Oh.')).toBe(false));
});
