import {
  birthLadderKey, birthQuestion, onBirthNo, onBirthResult, onProvinceConfirmed, startBirth,
} from './birthPlace';
import * as birthPlace from './birthPlace';

const SAN_JOSE = [
  { value: 'San Jose, Batangas', town: 'San Jose', province: 'Batangas', province_psgc: '10' },
  { value: 'San Jose, Bohol', town: 'San Jose', province: 'Bohol', province_psgc: '20' },
  { value: 'San Jose, Tarlac', town: 'San Jose', province: 'Tarlac', province_psgc: '30' },
  { value: 'San Jose, Nueva Ecija', town: 'San Jose', province: 'Nueva Ecija', province_psgc: '40' },
];
const ambiguous = { ok: false, reason: 'ambiguous_town', candidates: SAN_JOSE, suggestions: SAN_JOSE.slice(0, 3) };

describe('place of birth in two read-back steps (plan 006)', () => {
  test('always starts at the province question: no "Were you born in <town>?" shortcut', () => {
    const birth = startBirth('Baungon, Bukidnon');
    expect(birth).toMatchObject({ active: true, step: 'province', pendingTown: null });
    expect(birthQuestion(birth).key).toBe('place_of_birth_province');
    expect(birthQuestion(birth).question).toBe(
      'Which province were you born in? If you were born in a city like Cagayan de Oro, say the city.',
    );
    expect(birthPlace.shortcutResult).toBeUndefined();
    expect(birthPlace.shortcutQuestion).toBeUndefined();
  });

  test('a province is read back first; only a yes asks its town', () => {
    const { birth, action, result } = onBirthResult(startBirth(), { ok: true, value: 'Bukidnon', normalized: '1001300000' });
    expect(action).toBe('province');
    expect(result.birthProvince).toEqual({ code: '1001300000', name: 'Bukidnon' });
    expect(birth.step).toBe('province');            // not advanced before the yes
    const next = onProvinceConfirmed(birth, result.birthProvince);
    expect(birthQuestion(next)).toMatchObject({ key: 'place_of_birth_town', logKey: 'place_of_birth' });
    expect(birthQuestion(next).question).toBe('Which town or city in Bukidnon were you born in?');
  });

  test('a city with no province is read back and is the whole answer', () => {
    const result = { ok: true, value: 'Iligan City', normalized: '' };
    expect(onBirthResult(startBirth(), result).action).toBe('confirm');
  });

  test('a whole place named at the town step is also read back', () => {
    const town = onProvinceConfirmed(startBirth(), { code: '1', name: 'Bukidnon' });
    expect(onBirthResult(town, { ok: true, value: 'Polomolok, South Cotabato', normalized: '' }).action).toBe('confirm');
  });

  test('every step has its own ladder key', () => {
    const town = onProvinceConfirmed(startBirth(), { code: '1', name: 'Bukidnon' });
    expect(birthLadderKey(startBirth())).toBe('place_of_birth_province');
    expect(birthLadderKey(town)).toBe('place_of_birth_town');
  });

  test('a miss is one try of the step, never a list to tap', () => {
    const miss = { ok: false, message: 'For example: Bukidnon.', suggestions: [{ value: 'Bukidnon', province: '1' }] };
    expect(onBirthResult(startBirth(), miss).action).toBe('miss');
    const town = onProvinceConfirmed(startBirth(), { code: '1', name: 'Bukidnon' });
    expect(onBirthResult(town, miss).action).toBe('miss');
  });

  test('a "no" to a read-back is a try; the step stays', () => {
    const town = onProvinceConfirmed(startBirth(), { code: '1', name: 'Bukidnon' });
    expect(onBirthNo(town)).toEqual({ birth: town, action: 'miss' });
  });

  describe('the same town in several provinces', () => {
    test('asks "Which province is San Jose in?" and it is not a try', () => {
      const { birth, action } = onBirthResult(startBirth(), ambiguous);
      expect(action).toBe('ask');
      expect(birth.pendingTown.candidates).toHaveLength(4);
      expect(birthQuestion(birth).question).toBe('Which province is San Jose in?');
      expect(birthQuestion(birth).key).toBe('place_of_birth_province');
    });

    test('a candidate beyond the first three resolves to "Town, Province" and is read back', () => {
      const { birth } = onBirthResult(startBirth(), ambiguous);
      const out = onBirthResult(birth, { ok: true, value: 'Nueva Ecija', normalized: '40' });
      expect(out.action).toBe('confirm');
      expect(out.result.value).toBe('San Jose, Nueva Ecija');
      expect(out.birth.pendingTown).toBeNull();
    });

    test('a province that does not have the town is one try, and the question stays', () => {
      const { birth } = onBirthResult(startBirth(), ambiguous);
      const out = onBirthResult(birth, { ok: true, value: 'Bukidnon', normalized: '1001300000' });
      expect(out.action).toBe('miss');
      expect(out.birth.pendingTown).not.toBeNull();
    });

    test('a second ambiguous answer is a try, not another question', () => {
      const { birth } = onBirthResult(startBirth(), ambiguous);
      expect(onBirthResult(birth, ambiguous).action).toBe('miss');
    });

    test('a "no" at the read-back clears the pending town', () => {
      const { birth } = onBirthResult(startBirth(), ambiguous);
      expect(onBirthNo(birth).birth.pendingTown).toBeNull();
    });
  });

  test('the old tap screen and shortcut are gone', () => {
    expect(birthPlace.BIRTH_MISSES).toBeUndefined();
    expect(birthPlace.onBirthPick).toBeUndefined();
    expect(startBirth()).not.toHaveProperty('home');
  });
});
