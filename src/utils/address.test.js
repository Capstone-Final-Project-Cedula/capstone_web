import { ADDRESS_PARTS, joinAddress } from './address';

describe('joinAddress (plan 001.6)', () => {
  test('three parts become one address, purok first', () => {
    expect(joinAddress({
      address_town: { value: 'Baungon, Bukidnon' },
      address_barangay: { value: 'Imbatug', display: 'Barangay Imbatug' },
      address_purok: { value: 'Purok 2' },
    })).toBe('Purok 2, Barangay Imbatug, Baungon, Bukidnon');
  });

  test('Cagayan de Oro keeps its own province', () => {
    expect(joinAddress({
      address_town: { value: 'Cagayan de Oro City, Misamis Oriental' },
      address_barangay: { value: 'Barangay 10', display: 'Barangay 10' },
      address_purok: { value: 'Zone 1' },
    })).toBe('Zone 1, Barangay 10, Cagayan de Oro City, Misamis Oriental');
  });

  test('no purok ("none") is left out', () => {
    expect(joinAddress({
      address_town: { value: 'Baungon, Bukidnon' },
      address_barangay: { value: 'Lingating', display: 'Barangay Lingating' },
      address_purok: { value: '', display: 'none' },
    })).toBe('Barangay Lingating, Baungon, Bukidnon');
  });

  test('the questions go town, barangay, purok; only the purok is optional', () => {
    expect(ADDRESS_PARTS.map((p) => p.key)).toEqual(['address_town', 'address_barangay', 'address_purok']);
    expect(ADDRESS_PARTS.filter((p) => p.optional).map((p) => p.key)).toEqual(['address_purok']);
  });
});
