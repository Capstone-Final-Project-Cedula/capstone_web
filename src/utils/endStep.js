// The end step of the voice interview (plan 001.3, widened by plan 002.2): before the final "yes",
// every question skipped in the interview is asked again, "say it or type it?", in interview order.
import { REQUIRED_FIELDS } from './requiredFields';

// The 6 fields a CTC cannot be issued without (the backend's 422 rule), as interview question keys.
// Only these block the final "yes"; any other skipped question can be left blank.
export const REQUIRED_INTERVIEW_KEYS = REQUIRED_FIELDS.map(({ key }) => (key === 'date_of_birth' ? 'date' : key));

export const isRequiredKey = (key) => REQUIRED_INTERVIEW_KEYS.includes(key);

const isBlank = (value) => !String(value ?? '').trim();

/** Indexes of `fields` still blank that are required, or were skipped (`skipped`: a Set of indexes). */
export const endStepIndexes = (fields, answers, skipped) =>
  fields
    .map((field, index) => ({ field, index }))
    .filter(({ field, index }) => isBlank(answers?.[field.key]) && (isRequiredKey(field.key) || skipped.has(index)))
    .map(({ index }) => index);

/** Indexes of `fields` that are required and still blank: what blocks issuing. */
export const missingRequiredIndexes = (fields, answers) => endStepIndexes(fields, answers, new Set());

/**
 * Reply to "Would you like to say it or type it?": 'type', 'blank', 'say' or null. "type" wins when
 * both are heard. 'blank' ("leave it blank", "none") is only acted on for a question that is not required.
 */
export const parseMissingChoice = (reply) => {
  const t = String(reply || '').toLowerCase();
  if (/\b(type|typed|typing|tayp|i-?type|keyboard|write|isulat|sulat)\b/.test(t)) return 'type';
  if (/\b(blank|none|wala|skip|leave|walay)\b/.test(t)) return 'blank';
  if (/\b(say|said|speak|again|repeat|voice|ulit|usab|isulti|sabihin)\b/.test(t)) return 'say';
  return null;
};
