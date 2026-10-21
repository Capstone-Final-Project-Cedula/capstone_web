import { applySpelling, combineSpelling, looksSpelled } from './spelling';

describe('combineSpelling (plan 001.6: a new spelling replaces, never glues)', () => {
  test('a re-spelling with a different first letter replaces the misheard one', () => {
    expect(combineSpelling('ardiz', 'O, R, D, I, Z')).toBe('ordiz');
  });

  test('a re-spelling with the same first letter replaces it too', () => {
    expect(combineSpelling('ordis', 'O R D I Z')).toBe('ordiz');
  });

  test('a short re-spelling replaces a long one (two-letter surnames)', () => {
    expect(combineSpelling('oyola', 'U, Y')).toBe('uy');
  });

  test('"No, ..." before the letters replaces', () => {
    expect(combineSpelling('santo', 'No, S-A-N-T-O-S')).toBe('santos');
  });

  test('"space ..." adds a second word to the spelling so far', () => {
    expect(combineSpelling('mary', 'space A N N')).toBe('mary ann');
  });

  test('"and ..." continues the spelling so far', () => {
    expect(combineSpelling('ord', 'and I, Z')).toBe('ordiz');
  });

  test('"delete" edits the spelling so far', () => {
    expect(combineSpelling('ordizz', 'delete')).toBe('ordiz');
  });

  test('a lone lead-in letter before the word is not glued onto the spelling (plan 001.8)', () => {
    expect(combineSpelling('', 'O, Ordiz, O, R, D, I, Z')).toBe('ordiz');
    expect(combineSpelling('', 'B. Bautista. B-A-U-T-I-S-T-A')).toBe('bautista');
  });

  test('the last letter before trailing talk is kept', () => {
    expect(combineSpelling('', 'S, A, N, T, O, S please')).toBe('santos');
  });

  test('nothing spelled before: the letters are taken as they are', () => {
    expect(combineSpelling('', 'D, E, L, A, space, C, R, U, Z')).toBe('dela cruz');
  });
});

describe('applySpelling / looksSpelled', () => {
  test('letter words and doubles', () => {
    expect(applySpelling('', 'bee ee double el').text).toBe('bell');
  });

  test('spelled letters are recognised, plain words are not', () => {
    expect(looksSpelled('O, R, D, I, Z')).toBe(true);
    expect(looksSpelled('Oh.')).toBe(false);
    expect(looksSpelled('Yes, that is correct')).toBe(false);
  });
});
