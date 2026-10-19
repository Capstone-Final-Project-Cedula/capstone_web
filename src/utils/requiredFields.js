// The 6 fields a CTC cannot be issued without: the same set as the backend's
// missing_required_fields (capstone_backend/app/api/routes/forms.py), which answers 422
// when one is blank. The web is stricter: it accepts only the exact values below and
// YYYY-MM-DD, while the server also reads "m"/"f", MM/DD/YYYY and other date forms.
// So anything that passes here also passes there. Used by the voice and QR pages (plan 001.4).

export const SEX_OPTIONS = ['Male', 'Female'];
export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'];

// Keys are the API's applicant_data names.
export const REQUIRED_FIELDS = [
  { key: 'surname', label: 'Surname', message: 'Surname is required' },
  { key: 'given_name', label: 'Given name', message: 'Given name is required' },
  { key: 'address', label: 'Address', message: 'Address is required' },
  { key: 'sex', label: 'Sex', message: 'Sex must be Male or Female' },
  {
    key: 'civil_status',
    label: 'Civil status',
    message: 'Civil status must be Single, Married, Widowed, or Separated',
  },
  { key: 'date_of_birth', label: 'Date of birth', message: 'Date of birth is missing or could not be read' },
];

// YYYY-MM-DD that is a real calendar date (2023-02-30 is not).
export const isValidIsoDate = (value) => {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const isFilled = (key, value) => {
  if (key === 'sex') return SEX_OPTIONS.includes(value);
  if (key === 'civil_status') return CIVIL_STATUS_OPTIONS.includes(value);
  if (key === 'date_of_birth') return isValidIsoDate(value);
  return String(value ?? '').trim() !== '';
};

// { key: message } for every required field that is blank or invalid.
export const missingRequiredFields = (formData = {}) => {
  const missing = {};
  REQUIRED_FIELDS.forEach(({ key, message }) => {
    if (!isFilled(key, formData[key])) missing[key] = message;
  });
  return missing;
};

// The messages for the review page: the required fields, plus a negative income.
export const validateFormData = (formData) => {
  const errors = Object.values(missingRequiredFields(formData));
  if (formData.gross_annual_income && formData.gross_annual_income < 0) {
    errors.push('Gross annual income must be a positive number');
  }
  return errors;
};
