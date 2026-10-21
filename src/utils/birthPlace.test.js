import {
  BIRTH_IDLE, birthQuestion, onBirthNo, onBirthPick, onBirthResult, shortcutResult, startBirth,
} from './birthPlace';

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
    expect(birth).toMatchObject({ step: 'province', misses: 0 });
  });

  test('a province asks for its town, matched inside it', () => {
    const { birth, action } = onBirthResult(startBirth(''), { ok: true, value: 'Bukidnon', normalized: '1001300000' });
    expect(action).toBe('town');
    expect(birthQuestion(birth)).toMatchObject({ key: 'place_of_birth_town', logKey: 'place_of_birth' });
    expect(birthQuestion(birth).question).toContain('Bukidnon');
  });

  test('the province step suggestions are cleared for the town step (Codex, plan 001.8)', () => {
    const before = { ...startBirth(''), suggestions: [{ value: 'Bukidnon', province: '1001300000' }] };
    expect(onBirthResult(before, { ok: true, value: 'Bukidnon', normalized: '1001300000' }).birth.suggestions).toEqual([]);
    expect(onBirthPick(before, { value: 'Bukidnon', province: '1001300000' }).birth.suggestions).toEqual([]);
  });

  test('a whole place is read back', () => {
    const result = { ok: true, value: 'Iligan City', normalized: '' };
    expect(onBirthResult(startBirth(''), result).action).toBe('confirm');
  });

  test('the first miss re-asks, the second shows the choices', () => {
    const miss = { ok: false, message: 'For example: Bukidnon.', suggestions: [] };
    const first = onBirthResult(startBirth(''), miss);
    expect(first.action).toBe('retry');
    expect(onBirthResult(first.birth, miss).action).toBe('choose');
  });

  test('two "no"s to read-backs also lead to the choices', () => {
    const first = onBirthNo({ ...startBirth(''), step: 'town', province: { code: '1', name: 'Bukidnon' } });
    expect(first.action).toBe('ask');
    expect(onBirthNo(first.birth).action).toBe('choose');
  });

  test('the 2-miss fallback picks a list entry: a whole place is the answer', () => {
    const pick = onBirthPick(startBirth(''), { value: 'Lantapan, Bukidnon', province: '' });
    expect(pick.action).toBe('accept');
    expect(pick.result).toMatchObject({ ok: true, value: 'Lantapan, Bukidnon' });
  });

  test('a picked province asks its town next', () => {
    const pick = onBirthPick(startBirth(''), { value: 'Bukidnon', province: '1001300000' });
    expect(pick.action).toBe('town');
    expect(pick.birth.province).toEqual({ code: '1001300000', name: 'Bukidnon' });
  });

  test('nothing picked: nothing happens', () => {
    expect(onBirthPick(BIRTH_IDLE, null).action).toBe('none');
  });
});
