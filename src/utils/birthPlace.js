// The voice interview asks the place of birth in short steps (plan 001.8):
//   1. shortcut: "Were you born in Baungon, Bukidnon?" (the town of the address answers), yes = done;
//   2. province: "Which province were you born in?" (a city with no province can be said directly);
//   3. town: "Which town or city in Bukidnon?", matched only against that province's towns.
// After 2 misses on a step the closest list entries are shown to tap, or the place is typed.
// The answer is still the one `place_of_birth` value the form stores ("Malaybalay City, Bukidnon").

export const BIRTH_MISSES = 2;

export const BIRTH_KEYS = new Set(['place_of_birth', 'place_of_birth_province', 'place_of_birth_town']);

export const BIRTH_IDLE = { active: false, step: null, province: null, misses: 0, home: '' };

const PROVINCE_QUESTION = 'Which province were you born in? If you were born in a city like Cagayan de Oro, say the city.';

export const BIRTH_PROVINCE_STEP = {
  key: 'place_of_birth_province',
  logKey: 'place_of_birth',
  label: 'Place of birth',
  question: PROVINCE_QUESTION,
  hint: 'Province, for example Bukidnon. Or a city like Cagayan de Oro',
};

/** Start the place of birth: the shortcut when the address gave a town, else the province question. */
export const startBirth = (homeTown) => {
  const home = String(homeTown || '').trim();
  return { ...BIRTH_IDLE, active: true, step: home ? 'shortcut' : 'province', home };
};

/** The question of the step in progress (same shape as an interview field or an address part). */
export const birthQuestion = (birth) => {
  if (birth.step === 'town' && birth.province) {
    return {
      key: 'place_of_birth_town',
      logKey: 'place_of_birth',
      label: 'Place of birth',
      question: `Which town or city in ${birth.province.name} were you born in?`,
      hint: `A town or city in ${birth.province.name}`,
    };
  }
  if (birth.step === 'shortcut') {
    return { key: 'place_of_birth', logKey: 'place_of_birth', label: 'Place of birth', question: shortcutQuestion(birth.home), hint: '' };
  }
  return BIRTH_PROVINCE_STEP;
};

export const shortcutQuestion = (home) => `Were you born in ${home}?`;

/** The shortcut as an answer to confirm: "yes" saves the address town as the place of birth. */
export const shortcutResult = (home) => ({
  ok: true, value: home, display: home, needs_confirmation: true, message: shortcutQuestion(home), birthShortcut: true,
});

/**
 * What to do with an /answer result for a place-of-birth step. Returns { birth, action }:
 *   action 'confirm' — a whole place: read it back ("Malaybalay City, Bukidnon. Is that correct?");
 *   action 'town'    — only a province: ask its town next (`birth.province` = { code, name });
 *   action 'retry'   — say result.message (it has an example) and listen again;
 *   action 'choose'  — the second miss: show `result.suggestions` to tap, or type it.
 */
export const onBirthResult = (birth, result) => {
  if (result?.ok && result.value) {
    const code = String(result.normalized || '');
    if (/^\d+$/.test(code)) {
      // The province's suggestions are not the town's: cleared, so the town fallback lists its towns.
      return { birth: { ...birth, step: 'town', province: { code, name: result.value }, misses: 0, suggestions: [] }, action: 'town' };
    }
    return { birth, action: 'confirm' };
  }
  const misses = birth.misses + 1;
  return { birth: { ...birth, misses }, action: misses >= BIRTH_MISSES ? 'choose' : 'retry' };
};

/** "No" to a read-back counts as a miss of the step it came from. */
export const onBirthNo = (birth) => {
  if (birth.step === 'shortcut') return { birth: { ...birth, step: 'province', misses: 0 }, action: 'ask' };
  const misses = birth.misses + 1;
  return { birth: { ...birth, misses }, action: misses >= BIRTH_MISSES ? 'choose' : 'ask' };
};

/**
 * A tapped suggestion ({ value, province }): a province asks its town next, anything else is the
 * place of birth itself. Never anything that is not a list entry.
 */
export const onBirthPick = (birth, choice) => {
  if (!choice?.value) return { birth, action: 'none' };
  if (choice.province) {
    return {
      birth: { ...birth, step: 'town', province: { code: choice.province, name: choice.value }, misses: 0, suggestions: [] },
      action: 'town',
    };
  }
  return {
    birth,
    action: 'accept',
    result: { ok: true, value: choice.value, display: choice.value, methods: ['gazetteer'], picked: true },
  };
};
