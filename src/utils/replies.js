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

// Includes how Whisper writes "mali" and "hindi po" ("Malay", "Molly", "Hindipa", "In people").
export const isNoAnswer = (value) => {
  const reply = normalizeReply(value);
  return /^(no|nope|not correct|that is wrong|that's wrong|incorrect|wrong|cancel|stop|don't|do not|nevermind|hindi\w*|mali|malay|malin|malih|molly|hindi tama|di|in people|in deeper)\b/.test(reply)
    && reply.split(' ').length <= 4;
};
