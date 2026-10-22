import { isNoAnswer, isNoReply, isYesAnswer } from './replies';

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

describe('"oh no" and its variants (plan 002.2)', () => {
  test.each(['Oh no.', 'Oh, no.', 'Uh no', 'Ah, no po.', 'No, no.', 'Oh, hindi.', 'No po.', 'Um, mali.', 'Eh hindi po'])(
    '%s is a no, never a yes',
    (reply) => {
      expect(isNoAnswer(reply)).toBe(true);
      expect(isNoReply(reply)).toBe(true);
      expect(isYesAnswer(reply)).toBe(false);
    },
  );

  test.each(['Oh.', 'Oh po.', 'O.', 'Oo.', 'Ooh.'])('%s is still a yes, not a no', (reply) => {
    expect(isYesAnswer(reply)).toBe(true);
    expect(isNoReply(reply)).toBe(false);
  });

  test('a long no is a no at the confirm step', () => {
    expect(isNoReply('Oh no, it is Bacus with a C')).toBe(true);
    expect(isNoReply('No, my surname is Bacus with a C')).toBe(true);
    expect(isNoReply('Bacus with a C')).toBe(false);
  });

  test('"oh" before another word is not a no', () => {
    expect(isNoReply('Oh, Bacus po')).toBe(false);
    expect(isNoReply('Nobleza')).toBe(false);   // a surname that starts with "no"
  });
});

describe('isPlainYes and isFillerOnly (plan 006)', () => {
  const { isPlainYes, isFillerOnly } = require('./replies');

  test.each(['Yes.', 'yes po', 'Opo', 'Okay', 'Correct.', 'Yes please'])('%s approves', (text) => {
    expect(isPlainYes(text)).toBe(true);
  });

  test.each([
    'Yes, my surname is Cruz.', 'Yes but change the address', 'Yes male', 'No', '', 'Yes yes yes yes', 'Y, E, S',
  ])('%s is not a plain yes', (text) => {
    expect(isPlainYes(text)).toBe(false);
  });

  test('the ordinary yes still accepts extra words (001.8), the final approval does not', () => {
    expect(isYesAnswer('Yes, my surname is Cruz')).toBe(true);
    expect(isPlainYes('Yes, my surname is Cruz')).toBe(false);
  });

  test.each(['Um.', 'Uh', 'Uhm', 'Hmm', 'Mm', 'Ah', 'Eh', 'Er', 'um... uh', 'Mm-hmm.'])('%s is a filler', (text) => {
    expect(isFillerOnly(text)).toBe(true);
  });

  test.each(['', 'Umali', 'Um, Purok 2', 'yes', 'Ahmad'])('%s is not only fillers', (text) => {
    expect(isFillerOnly(text)).toBe(false);
  });
});
