// System Usability Scale (SUS) survey content. The ten statements are the
// standard SUS wording and must not be edited; the codes match the
// sus_responses table and the Google Sheet's Apps Script.

export const SUS_CONSENT_TEXT =
  'Your answers are used only for our capstone research at USTP. Your name is optional.';

export const SUS_STATEMENTS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

export const SUS_SCALE = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
];

export const SUS_ROLES = [
  { value: 'citizen_applicant', label: 'Citizen applicant', hint: 'I came to get my Cedula' },
  { value: 'cedula_personnel', label: 'Cedula-processing personnel', hint: 'I process Cedula at the barangay' },
  { value: 'barangay_secretary', label: 'Barangay secretary', hint: 'I am the barangay secretary' },
];

export const SUS_EXPERIENCE = [
  { value: 'none', label: 'None', hint: 'I rarely or never use computers or phones' },
  { value: 'basic', label: 'Basic', hint: 'I can text, call, and use simple apps' },
  { value: 'comfortable', label: 'Comfortable', hint: 'I use apps and websites often' },
  { value: 'advanced', label: 'Advanced', hint: 'I am very good with computers' },
];

export const SUS_FEATURES = [
  { value: 'voice_input', label: 'Voice input', hint: 'Speaking your answers' },
  { value: 'qr_prefill', label: 'QR pre-fill', hint: 'Filling the form with a QR code from the phone app' },
  { value: 'form_generation', label: 'Form generation', hint: 'The printed Cedula form' },
  { value: 'receipt', label: 'Receipt', hint: 'The printed receipt' },
  { value: 'voice_feedback', label: 'Voice feedback', hint: 'The system talking back to you' },
];
