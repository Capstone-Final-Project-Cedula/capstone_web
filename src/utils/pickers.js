// Typing pickers (plan 002.1): which control each answer gets, and the text it saves. A picked or typed
// answer is written exactly as the voice path writes it ("Female", "May 10, 1990", "160",
// "Malaybalay City, Bukidnon", "Purok 7, Barangay Imbatug, Baungon, Bukidnon").

// Interview keys and the QR page's (the phone's applicant_data) keys -> the kind of control.
const KINDS = {
  sex: 'sex',
  civil_status: 'civil_status',
  date: 'date',
  date_of_birth: 'date',
  height: 'height',
  height_cm: 'height',
  weight: 'weight',
  weight_kg: 'weight',
  gross_annual_income: 'income',
  citizenship: 'citizenship',
  place_of_birth: 'place_of_birth',
  address: 'address',
  occupation: 'occupation',
};

export const pickerKind = (key) => KINDS[key] || 'text';

// The voice path's limits (backend answer_service HEIGHT_CM / WEIGHT_KG); /forms/issue checks the same.
export const NUMBER_LIMITS = {
  height: { min: 50, max: 250, unit: 'cm', label: 'Height' },
  weight: { min: 20, max: 300, unit: 'kg', label: 'Weight' },
  income: { min: 0, max: null, unit: 'pesos a year', label: 'Income' },
};

/** Why a typed number cannot be saved, or '' (blank is "not given"). */
export const numberProblem = (kind, text) => {
  const limits = NUMBER_LIMITS[kind];
  const t = String(text ?? '').trim();
  if (!limits || !t) return '';
  const n = Number(t);
  if (!Number.isFinite(n)) return `${limits.label} must be a number.`;
  if (n < limits.min || (limits.max !== null && n > limits.max)) {
    return limits.max === null
      ? `${limits.label} cannot be below ${limits.min}.`
      : `${limits.label} must be ${limits.min} to ${limits.max} ${limits.unit}.`;
  }
  return '';
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD on this computer's clock (toISOString is UTC: a day behind before 08:00 here). */
export const localTodayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** A saved birth date ("May 10, 1990" or "1990-05-10") as the date input's YYYY-MM-DD, or ''. */
export const toIsoDate = (value) => {
  const t = String(value || '').trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;
  const spoken = t.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!spoken) return '';
  const month = MONTHS.findIndex((m) => m.toLowerCase() === spoken[1].toLowerCase());
  return month < 0 ? '' : `${spoken[3]}-${pad(month + 1)}-${pad(spoken[2])}`;
};

/** The date input's YYYY-MM-DD as saved: the interview writes it like a spoken date, the QR page as ISO. */
export const fromIsoDate = (iso, format = 'display') => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  if (format === 'iso') return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
};

/** A birth date after today, or not a real date. */
export const dateProblem = (iso, today = localTodayIso()) => {
  if (!iso) return '';
  if (!fromIsoDate(iso)) return 'Please pick a real date.';
  return iso > today ? 'A birth date cannot be in the future.' : '';
};

// Suggestions only: any other occupation can be typed (the backend's hint uses the same words).
export const OCCUPATIONS = ['Farmer', 'Teacher', 'Driver', 'Tricycle Driver', 'Vendor', 'Housewife', 'Student',
  'Laborer', 'Carpenter', 'Fisherman', 'Store Owner', 'Government Employee', 'Barangay Official', 'Nurse',
  'Construction Worker', 'Unemployed'];

const words = (text) => String(text || '').toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter(Boolean);

/** A short list filtered like the backend's place search: every typed word starts a word of the entry. */
export const filterOptions = (options, query, toText = (o) => o) => {
  const typed = words(query);
  if (!typed.length) return options;
  return options.filter((option) => {
    const have = words(toText(option));
    return typed.every((w) => have.some((h) => h.startsWith(w)));
  });
};

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * The answers that are still exactly a list pick (with its code): { key: value }. They are saved as picked,
 * never run through the whole-address or place parser again, which can rewrite a picked address (Codex
 * verify, plan 002.1); /forms/issue still checks them against the list by their code.
 */
export const unchangedPicks = (answers, picked = {}) => {
  const out = {};
  Object.entries(picked).forEach(([key, pick]) => {
    if ((pick?.meta?.code || pick?.meta?.townCode) && String(answers?.[key] ?? '').trim()
      && same(pick.value, answers[key])) out[key] = answers[key];
  });
  return out;
};

/**
 * The list codes to send with /forms/issue: only for an answer that is still exactly what was picked
 * (`picked`: { place_of_birth: { value, meta: { code } }, address: { value, meta: { townCode, barangay } } }).
 * A later spoken or typed change drops them, so the server never checks a stale pick.
 */
export const pickedCodes = (answers, picked = {}) => {
  const out = {};
  const place = picked.place_of_birth;
  if (place?.meta?.code && same(place.value, answers?.place_of_birth)) out.place_of_birth_code = place.meta.code;
  const address = picked.address;
  if (address?.meta?.townCode && same(address.value, answers?.address)) {
    out.address_town_code = address.meta.townCode;
    if (address.meta.barangay) out.address_barangay = address.meta.barangay;
  }
  return out;
};
