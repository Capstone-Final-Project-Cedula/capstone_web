import {
  dateProblem, filterOptions, fromIsoDate, localTodayIso, numberProblem, pickedCodes, pickerKind, toIsoDate,
  unchangedPicks,
} from './pickers';
import { joinAddress } from './address';

describe('typing pickers (plan 002.1)', () => {
  test('each answer gets its control, on the interview and on the QR page', () => {
    expect(pickerKind('sex')).toBe('sex');
    expect(pickerKind('date')).toBe('date');
    expect(pickerKind('date_of_birth')).toBe('date');
    expect(pickerKind('height_cm')).toBe('height');
    expect(pickerKind('place_of_birth')).toBe('place_of_birth');
    expect(pickerKind('surname')).toBe('text');          // names stay free text
    expect(pickerKind('icr_no')).toBe('text');
  });

  test('a picked date saves what the voice path saves ("May 10, 1990"), the QR page keeps ISO', () => {
    expect(fromIsoDate('1990-05-10')).toBe('May 10, 1990');   // backend: understand_answer("date", "May 10 1990")
    expect(fromIsoDate('1990-05-10', 'iso')).toBe('1990-05-10');
    expect(toIsoDate('May 10, 1990')).toBe('1990-05-10');
    expect(toIsoDate('December 25, 1985')).toBe('1985-12-25');
    expect(toIsoDate('1990-05-10')).toBe('1990-05-10');
    expect(toIsoDate('sometime')).toBe('');
  });

  test('no future birth dates', () => {
    expect(dateProblem('2999-01-01', '2026-10-22')).toMatch(/future/);
    expect(dateProblem('2026-10-22', '2026-10-22')).toBe('');
    expect(dateProblem('', '2026-10-22')).toBe('');
    expect(localTodayIso(new Date(2026, 0, 5, 1, 0))).toBe('2026-01-05');   // local clock, not UTC
  });

  test.each([
    ['height', '49', true], ['height', '50', false], ['height', '250', false], ['height', '251', true],
    ['weight', '19', true], ['weight', '20', false], ['weight', '300', false], ['weight', '301', true],
    ['income', '0', false], ['income', '-1', true], ['height', '', false], ['height', 'abc', true],
  ])('%s %s outside the voice limits: %s (Codex plan review)', (kind, value, refused) => {
    expect(Boolean(numberProblem(kind, value))).toBe(refused);
  });

  test('a picked address is joined exactly like the spoken one', () => {
    const picked = joinAddress({
      address_purok: { value: 'Purok 7' },
      address_barangay: { value: 'Imbatug', display: 'Barangay Imbatug' },
      address_town: { value: 'Baungon, Bukidnon' },
    });
    expect(picked).toBe('Purok 7, Barangay Imbatug, Baungon, Bukidnon');
  });

  test('short lists filter by the start of each word', () => {
    const towns = ['Baungon, Bukidnon', 'Cagayan de Oro City, Misamis Oriental', 'Malaybalay City, Bukidnon'];
    expect(filterOptions(towns, 'cag oro')).toEqual(['Cagayan de Oro City, Misamis Oriental']);
    expect(filterOptions(towns, 'bukid')).toEqual(['Baungon, Bukidnon', 'Malaybalay City, Bukidnon']);
    expect(filterOptions(towns, '')).toEqual(towns);
    expect(filterOptions(towns, 'xyz')).toEqual([]);
  });

  test('an answer still exactly as picked is kept as picked, never parsed again (Codex verify)', () => {
    const picked = {
      address: { value: 'Purok 7, Barangay Tomas L. Cabili, Iligan City', meta: { townCode: '1', barangay: 'Tomas L. Cabili' } },
      place_of_birth: { value: 'Tokyo', meta: { freeText: true } },       // typed, no code: checked as usual
      sex: { value: 'Female', meta: {} },
    };
    const answers = { address: 'Purok 7, Barangay Tomas L. Cabili, Iligan City', place_of_birth: 'Tokyo', sex: 'Female' };
    expect(unchangedPicks(answers, picked)).toEqual({ address: 'Purok 7, Barangay Tomas L. Cabili, Iligan City' });
    expect(unchangedPicks({ ...answers, address: 'Barangay Poblacion, Kalilangan, Bukidnon' }, picked)).toEqual({});
    expect(unchangedPicks({ address: '' }, picked)).toEqual({});
  });

  test('list codes go with the answer only while it is still what was picked', () => {
    const picked = {
      place_of_birth: { value: 'Malaybalay City, Bukidnon', meta: { code: '1031210000' } },
      address: { value: 'Purok 7, Barangay Imbatug, Baungon, Bukidnon', meta: { townCode: '1001301000', barangay: 'Imbatug' } },
    };
    const answers = { place_of_birth: 'Malaybalay City, Bukidnon', address: 'Purok 7, Barangay Imbatug, Baungon, Bukidnon' };
    expect(pickedCodes(answers, picked)).toEqual({
      place_of_birth_code: '1031210000', address_town_code: '1001301000', address_barangay: 'Imbatug',
    });
    // Changed afterwards by voice or typing: no stale code is sent.
    expect(pickedCodes({ ...answers, place_of_birth: 'Valencia City, Bukidnon' }, picked)).toEqual({
      address_town_code: '1001301000', address_barangay: 'Imbatug',
    });
    // "Not in the list" (no code) and nothing picked: nothing to send.
    expect(pickedCodes(answers, { place_of_birth: { value: 'Tokyo', meta: { freeText: true } } })).toEqual({});
    expect(pickedCodes(answers)).toEqual({});
  });
});
