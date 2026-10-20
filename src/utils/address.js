// The voice interview asks the address in 3 short questions (plan 001.6): town or city first, then the
// barangay (matched only against that town's barangays), then the purok or street. The answers are joined
// into the one `address` value the form stores.

export const ADDRESS_PARTS = [
  {
    key: 'address_town',
    label: 'Town or city',
    question: 'Which town or city do you live in?',
    hint: 'Example: Baungon, or Cagayan de Oro',
  },
  {
    key: 'address_barangay',
    label: 'Barangay',
    question: 'What is your barangay?',
    hint: 'Example: Imbatug',
  },
  {
    key: 'address_purok',
    label: 'Purok or street',
    question: 'What is your purok, sitio or street? If none, say none.',
    hint: 'Example: Purok 2. Say none if there is none',
    optional: true,
  },
];

/**
 * { address_town, address_barangay, address_purok } answer results -> "Purok 2, Barangay Imbatug, Baungon, Bukidnon".
 * The barangay is written as the backend shows it ("Barangay Carmen", "Barangay 10"), the town with its province.
 */
export const joinAddress = (results = {}) => [
  results.address_purok?.value,
  results.address_barangay?.display || results.address_barangay?.value,
  results.address_town?.value,
]
  .map((part) => String(part || '').trim().replace(/^[\s,]+|[\s,]+$/g, ''))
  .filter((part) => part && part.toLowerCase() !== 'none')
  .join(', ');
