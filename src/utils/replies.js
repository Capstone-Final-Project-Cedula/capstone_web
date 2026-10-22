// Yes / no replies in the voice interview ("is that correct?"), as Whisper writes them.
import { looksSpelled } from './spelling';

// Lowercase, drop punctuation and the polite "po"/"opo" so "Yes po." and "Opo" both count.
export const normalizeReply = (value) =>
  String(value || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\b(po|ho)\b/g, ' ').replace(/\s+/g, ' ').trim();

// Includes how Whisper writes a short Filipino "oo" ("Oop", "Oof", "Ooh", "Oh", "O").
const YES_START = /^(yes|yeah|yep|yup|yah|ya|correct|right|that is correct|that's correct|that's right|it is correct|it's correct|spelling is correct|okay|ok|sure|confirm|confirmed|proceed|go ahead|opo|oo|ooh|oop|oof|oho|oh|o|tama|sige|ayos)\b/;
const NEGATION = /\b(no|not|nope|hindi|mali|wrong|incorrect|but|pero|change|wait)\b/;

// "Yes.", "Yes. Yes.", "Yes, that's correct po", "Oo, tama", "Oh." all count as yes, also with
// extra words after it, however many (the tiny yes/no model invents some; plan 001.8). Anything
// that also says no / but / change does not, and neither do spelled letters ("O, R, D, I, Z").
export const isYesAnswer = (value) => {
  const reply = normalizeReply(value);
  return YES_START.test(reply) && !NEGATION.test(reply) && !looksSpelled(value);
};

// A sound before the no ("Oh no", "Uh, hindi", plan 002.2). "Oh." alone stays a yes (Whisper's "oo").
const FILLER = '(?:(?:oh|uh|ah|um|uhm|eh|hmm)\\s+)?';

// Includes how Whisper writes "mali" and "hindi po" ("Malay", "Molly", "Hindipa", "In people").
const NO_START = new RegExp(`^${FILLER}(no|nope|not correct|that is wrong|that's wrong|incorrect|wrong|cancel|stop|don't|do not|nevermind|hindi\\w*|mali|malay|malin|malih|molly|hindi tama|di|in people|in deeper)\\b`);

export const isNoAnswer = (value) => {
  const reply = normalizeReply(value);
  return NO_START.test(reply) && reply.split(' ').length <= 4;
};

// A no at the "is that correct?" step, also a longer one ("No, it is Bacus with a C").
export const isNoReply = (value) => isNoAnswer(value) || new RegExp(`^${FILLER}(no|hindi|mali)\\b`).test(normalizeReply(value));

// A whole-reply yes for the final approval (plan 006): "Yes.", "Opo", "yes po", "okay". At most 3 words and no field
// name, "change" or "but": "Yes, my surname is Cruz" is a correction, never an approval (isYesAnswer would accept it).
const PLAIN_YES = /^(yes|yeah|yep|yup|opo|oo|okay|ok|correct|right|sure)( please)?$/;
const FIELD_WORD = /\b(change|but|no|not|name|surname|birth|address|purok|barangay|sex|civil|status|height|weight|occupation|citizenship|income|male|female|single|married|date)\b/;

export const isPlainYes = (value) => {
  const reply = normalizeReply(value);
  return Boolean(reply) && reply.split(' ').length <= 3 && !FIELD_WORD.test(reply) && PLAIN_YES.test(reply) && !looksSpelled(value);
};

// "Um.", "Uh", "Hmm", "Mm-hmm": a hesitation, never an answer or a yes/no (plan 006).
const FILLER_ONLY = /^(uh+m*|um+|ah+m*|eh+|er+m*|hm+|mm+|mh+m*)$/;

export const isFillerOnly = (value) => {
  const words = String(value || '').toLowerCase().match(/[a-zñ']+/g) || [];
  return words.length > 0 && words.every((w) => FILLER_ONLY.test(w));
};
