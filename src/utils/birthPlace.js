// The voice interview asks the place of birth in short steps (plan 001.8):
//   1. shortcut: "Were you born in Baungon, Bukidnon?" (the town of the address answers), yes = done;
//   2. province: "Which province were you born in?" (a city with no province can be said directly);
//   3. town: "Which town or city in Bukidnon?", matched only against that province's towns.
// The steps share the question's one ladder of tries (plan 002.2, utils/ladder.js): no list to tap.
// The answer is still the one `place_of_birth` value the form stores ("Malaybalay City, Bukidnon").

export const BIRTH_KEYS = new Set(['place_of_birth', 'place_of_birth_province', 'place_of_birth_town']);

export const BIRTH_IDLE = { active: false, step: null, province: null, home: '' };

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
 *   action 'miss'    — not a place: one try of the question's ladder (the caller counts it).
 */
export const onBirthResult = (birth, result) => {
  if (result?.ok && result.value) {
    const code = String(result.normalized || '');
    if (/^\d+$/.test(code)) {
      return { birth: { ...birth, step: 'town', province: { code, name: result.value } }, action: 'town' };
    }
    return { birth, action: 'confirm' };
  }
  return { birth, action: 'miss' };
};

/**
 * "No" to a read-back. To the shortcut ("Were you born in Baungon?") it is an answer, not a miss:
 * the province is asked. To a place it is a try of the question's ladder ('miss').
 */
export const onBirthNo = (birth) => {
  if (birth.step === 'shortcut') return { birth: { ...birth, step: 'province' }, action: 'ask' };
  return { birth, action: 'miss' };
};
