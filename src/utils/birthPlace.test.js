import {
  birthQuestion, onBirthNo, onBirthResult, shortcutResult, startBirth,
} from './birthPlace';
import * as birthPlace from './birthPlace';

describe('place of birth steps (plan 001.8)', () => {
  test('the shortcut is asked when the address gave a town', () => {
    const birth = startBirth('Baungon, Bukidnon');
    expect(birth.step).toBe('shortcut');
    expect(birthQuestion(birth).question).toBe('Were you born in Baungon, Bukidnon?');
    expect(shortcutResult('Baungon, Bukidnon')).toMatchObject({ ok: true, value: 'Baungon, Bukidnon', birthShortcut: true });
  });

  test('no address town: straight to the province question', () => {
    expect(startBirth('').step).toBe('province');
    expect(birthQuestion(startBirth('')).key).toBe('place_of_birth_province');
  });

  test('a "no" to the shortcut asks the province, without counting a miss', () => {
    const { birth, action } = onBirthNo(startBirth('Baungon, Bukidnon'));
    expect(action).toBe('ask');
    expect(birth).toMatchObject({ step: 'province' });
  });

  test('a province asks for its town, matched inside it', () => {
    const { birth, action } = onBirthResult(startBirth(''), { ok: true, value: 'Bukidnon', normalized: '1001300000' });
    expect(action).toBe('town');
    expect(birthQuestion(birth)).toMatchObject({ key: 'place_of_birth_town', logKey: 'place_of_birth' });
    expect(birthQuestion(birth).question).toContain('Bukidnon');
  });

  test('a whole place is read back', () => {
    const result = { ok: true, value: 'Iligan City', normalized: '' };
    expect(onBirthResult(startBirth(''), result).action).toBe('confirm');
  });

  test('every miss on a step is one try of the shared ladder, never a list to tap (plan 002.2)', () => {
    const miss = { ok: false, message: 'For example: Bukidnon.', suggestions: [{ value: 'Bukidnon', province: '1' }] };
    const first = onBirthResult(startBirth(''), miss);
    expect(first.action).toBe('miss');
    expect(onBirthResult(first.birth, miss).action).toBe('miss');
    const town = { ...startBirth(''), step: 'town', province: { code: '1', name: 'Bukidnon' } };
    expect(onBirthResult(town, miss).action).toBe('miss');
  });

  test('a "no" to a read-back place is a try too; the step stays', () => {
    const town = { ...startBirth(''), step: 'town', province: { code: '1', name: 'Bukidnon' } };
    expect(onBirthNo(town)).toEqual({ birth: town, action: 'miss' });
  });

  test('the old 2-miss tap screen is gone: no miss counter, no pick', () => {
    expect(birthPlace.BIRTH_MISSES).toBeUndefined();
    expect(birthPlace.onBirthPick).toBeUndefined();
    expect(startBirth('')).not.toHaveProperty('misses');
  });
});
