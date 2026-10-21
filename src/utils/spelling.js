// Letter-by-letter spelling for the voice interview (fallback when an answer was
// heard wrong). Turns what the speech engine wrote for a spelled chunk ("D. E. L. A.",
// "dee ee el ay", "D as in dog", "double L", "space", "delete", "done") into edits
// of the text spelled so far.

const LETTER_WORDS = {
  a: 'a', ay: 'a', eh: 'a',
  b: 'b', bee: 'b', be: 'b', bi: 'b',
  c: 'c', see: 'c', sea: 'c', si: 'c', cee: 'c',
  d: 'd', dee: 'd', di: 'd',
  e: 'e', ee: 'e',
  f: 'f', ef: 'f', eff: 'f',
  g: 'g', gee: 'g', ji: 'g', jee: 'g',
  h: 'h', aitch: 'h', eych: 'h', eitch: 'h', etch: 'h',
  i: 'i', eye: 'i', ai: 'i',
  j: 'j', jay: 'j', jey: 'j',
  k: 'k', kay: 'k', key: 'k', kei: 'k',
  l: 'l', el: 'l', ell: 'l',
  m: 'm', em: 'm',
  n: 'n', en: 'n',
  'ñ': 'ñ', enye: 'ñ', enyeh: 'ñ', 'enie': 'ñ',
  o: 'o', oh: 'o', owe: 'o',
  p: 'p', pee: 'p', pi: 'p',
  q: 'q', cue: 'q', queue: 'q', kyu: 'q',
  r: 'r', ar: 'r', are: 'r',
  s: 's', es: 's', ess: 's',
  t: 't', tee: 't', tea: 't', ti: 't',
  u: 'u', you: 'u', yu: 'u',
  v: 'v', vee: 'v', vi: 'v',
  w: 'w',
  x: 'x', ex: 'x', eks: 'x',
  y: 'y', why: 'y', wai: 'y',
  z: 'z', zee: 'z', zed: 'z', zi: 'z',
};

const DONE = new Set(['done', 'finished', 'finish', 'tapos', 'complete', 'completed']);
const DELETE = new Set(['delete', 'erase', 'backspace', 'undo', 'remove', 'bura', 'burahin']);
const CLEAR = new Set(['clear', 'restart', 'ulitin']);
const SPACE = new Set(['space', 'espasyo']);

const COMMANDS = new Set([...DONE, ...DELETE, ...CLEAR, ...SPACE, 'double']);
// A whole spoken word, not a letter or a command ("Ordiz", "spelling").
const isWord = (tok) => Boolean(tok) && /^[a-zñ']{2,}$/.test(tok) && !LETTER_WORDS[tok] && !COMMANDS.has(tok);

/**
 * Apply one spoken chunk to the text spelled so far.
 * Returns { text, done }.
 */
export const applySpelling = (current, transcript) => {
  let text = String(current || '');
  let done = false;
  let t = String(transcript || '').toLowerCase();

  t = t
    .replace(/\b(?:double you|dobol yu|double u)\b/g, ' w ')
    .replace(/\b(?:start over|start again)\b/g, ' clear ')
    .replace(/\b(?:that'?s it|that is it|that'?s all|that is all|i'?m done|ok done|okay done)\b/g, ' done ')
    .replace(/\bnext word\b/g, ' space ')
    .replace(/\bn with (?:a )?tilde\b/g, ' ñ ')
    .replace(/\b(?:as in|like|for)\s+[a-zñ']+/g, ' ')        // "D as in dog", "B for boy"
    .replace(/[.,!?;:"()]/g, ' ');
  // Two letter groups written apart ("R-A-L-P-H J-O-H-N"): the pause between them is a
  // word break, as in a two-word given name.
  const groups = t.match(/\b[a-zñ](?:-[a-zñ])+\b/g) || [];
  if (groups.length >= 2) t = t.replace(/\b([a-zñ](?:-[a-zñ])+)\b(?=\s+[a-zñ](?:-[a-zñ])+\b)/g, '$1 space ');
  t = t
    .replace(/(?<=\b[a-zñ])-(?=[a-zñ]\b)/g, ' ')                // "d-e-l-a" -> "d e l a"
    .replace(/\s+-\s+|\bdash\b|\bhyphen\b/g, ' - ');

  const tokens = t.split(/\s+/).filter(Boolean);
  // When the reply contains spelled letters, words around them are talk, not part of the
  // name: "No, it's S-A-N-T-O-S", "the spelling is ...", "spelled ..." keep only the letters.
  const letterCount = tokens.filter((tok) => tok.length === 1 || LETTER_WORDS[tok]).length;
  const spelledReply = letterCount >= 2;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (DONE.has(tok)) { done = true; continue; }
    if (DELETE.has(tok)) { text = text.replace(/[\s-]*.$/, ''); continue; }
    if (CLEAR.has(tok)) { text = ''; continue; }
    if (SPACE.has(tok)) { if (text && !text.endsWith(' ')) text += ' '; continue; }
    if (tok === '-') { if (text) text += '-'; continue; }
    if (tok === 'double' && i + 1 < tokens.length && LETTER_WORDS[tokens[i + 1]]) {
      text += LETTER_WORDS[tokens[i + 1]].repeat(2);
      i += 1;
      continue;
    }
    if (LETTER_WORDS[tok]) {
      // A lone letter said before the whole word ("O, Ordiz, O R D I Z") is a lead-in, not the
      // first letter of the spelling: dropped, so the name is not spelled "oordiz" (plan 001.8).
      if (spelledReply && isWord(tokens[i + 1]) && !LETTER_WORDS[tokens[i - 1]]) continue;
      text += LETTER_WORDS[tok];
      continue;
    }
    if (!spelledReply && /^[a-zñ']+$/.test(tok)) {
      // A whole word ("Cruz"): keep it, as a new word if letters came before it.
      if (text && !/[\s-]$/.test(text)) text += ' ';
      text += tok.replace(/'/g, '');
    }
    // digits and anything else are ignored
  }
  return { text: text.replace(/\s+/g, ' ').replace(/^\s+/, ''), done };
};

const LEADING_NO = /^\s*(?:no|nope|hindi|mali|wrong|not)[\s,.!-]+/i;
// A reply that starts like this adds to (or edits) the spelling so far instead of replacing it.
const CONTINUE_START = /^\s*(?:space|espasyo|next word|dash|hyphen|delete|erase|backspace|undo|remove|bura|burahin|and|then|plus|continue|add|dugang)\b/i;

/**
 * Merge a spelled reply into the spelling so far. A new spelling replaces the old one,
 * whatever its first letter ("A R D I Z" heard wrong, then "O R D I Z" -> "ordiz", never
 * "ardizordiz"; plan 001.6). Only a reply that starts with "space", "and", "delete", ...
 * continues or edits it ("space A N N" -> "mary ann").
 */
export const combineSpelling = (current, transcript) => {
  const cleaned = String(transcript || '').replace(LEADING_NO, '');
  const prev = String(current || '').trim();
  if (prev && !LEADING_NO.test(String(transcript || '')) && CONTINUE_START.test(cleaned)) {
    return applySpelling(prev, cleaned.replace(/^\s*(?:and|then|plus|continue|add|dugang)\b/i, ' ')).text;
  }
  return applySpelling('', cleaned).text;
};

/** "dela cruz" -> "D, E, L, A, space, C, R, U, Z" (how the assistant reads it back). */
export const spellOut = (text) => String(text || '').trim().split('').map((ch) => {
  if (ch === ' ') return 'space';
  if (ch === '-') return 'dash';
  return ch.toUpperCase();
}).join(', ');

/** "dela cruz" -> "Dela Cruz" */
export const titleCaseSpelled = (text) => String(text || '').trim().split(' ')
  .map((w) => w.split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join('-'))
  .join(' ');

/** Does a reply look like spelled letters ("D E L A", "dee ee el ay")? */
export const looksSpelled = (transcript) => {
  const words = String(transcript || '').replace(LEADING_NO, '').toLowerCase()
    .replace(/[.,!?;:-]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = words.filter((w) => w.length === 1 || (LETTER_WORDS[w] && w.length <= 3));
  return letters.length >= 2 && letters.length >= words.length - 1;
};
