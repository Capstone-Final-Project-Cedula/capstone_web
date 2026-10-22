import {
  REQUIRED_INTERVIEW_KEYS, endStepIndexes, isRequiredKey, missingRequiredIndexes, parseMissingChoice,
} from './endStep';

const FIELDS = ['surname', 'given_name', 'middle_name', 'address', 'date', 'sex', 'civil_status', 'citizenship',
  'icr_no', 'place_of_birth', 'height', 'weight', 'occupation', 'gross_annual_income'].map((key) => ({ key }));
const index = (key) => FIELDS.findIndex((f) => f.key === key);

const FULL = {
  surname: 'Villanueva', given_name: 'Ma. Concepcion', middle_name: 'Dela Cruz', address: 'Purok 2, Imbatug, Baungon',
  date: 'May 10, 1990', sex: 'Female', civil_status: 'Single', citizenship: 'Filipino', icr_no: '',
  place_of_birth: 'Baungon, Bukidnon', height: '160', weight: '55', occupation: 'Farmer', gross_annual_income: '0',
};

describe('the end step (plan 002.2)', () => {
  test('only the 6 fields the backend requires block the final yes (Codex plan review, round 1)', () => {
    expect(REQUIRED_INTERVIEW_KEYS).toEqual(['surname', 'given_name', 'address', 'sex', 'civil_status', 'date']);
    expect(isRequiredKey('date')).toBe(true);
    expect(isRequiredKey('height')).toBe(false);
    expect(isRequiredKey('place_of_birth')).toBe(false);
  });

  test('a skipped optional question is listed, and leaving it blank does not block issuing', () => {
    const answers = { ...FULL, height: '', occupation: '' };
    const skipped = new Set([index('occupation'), index('height')]);
    expect(endStepIndexes(FIELDS, answers, skipped)).toEqual([index('height'), index('occupation')]);   // interview order
    expect(missingRequiredIndexes(FIELDS, answers)).toEqual([]);
  });

  test('a blank birth date still blocks issuing, skipped or not', () => {
    const answers = { ...FULL, date: '' };
    expect(missingRequiredIndexes(FIELDS, answers)).toEqual([index('date')]);
    expect(endStepIndexes(FIELDS, answers, new Set())).toEqual([index('date')]);
  });

  test('required and optional skipped questions together, in interview order', () => {
    const answers = { ...FULL, surname: '', place_of_birth: '', weight: '' };
    const skipped = new Set([index('weight'), index('surname'), index('place_of_birth')]);
    expect(endStepIndexes(FIELDS, answers, skipped)).toEqual([index('surname'), index('place_of_birth'), index('weight')]);
  });

  test('a question finished at the end, or never skipped, is not listed', () => {
    const skipped = new Set([index('height')]);
    expect(endStepIndexes(FIELDS, FULL, skipped)).toEqual([]);
    expect(endStepIndexes(FIELDS, { ...FULL, icr_no: '' }, new Set())).toEqual([]);   // ICR blank for a Filipino
  });

  test.each([
    ['Type it.', 'type'], ['I will type', 'type'], ['Say it again.', 'say'], ['Say it', 'say'], ['Ulit po', 'say'],
    ['Leave it blank.', 'blank'], ['None po', 'blank'], ['Wala', 'blank'], ['Skip it', 'blank'],
    ['Type it, not say it', 'type'], ['Hello', null], ['', null],
  ])('"%s" is %s', (reply, choice) => {
    expect(parseMissingChoice(reply)).toBe(choice);
  });
});
