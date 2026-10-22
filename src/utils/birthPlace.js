// The voice interview asks the place of birth in two read-back steps (plan 006, replaces 001.8's shortcut):
//   1. province: "Which province were you born in?" (a city with no province can be said directly).
//      The match is read back ("Bukidnon. Is that correct?"); a yes goes to step 2.
//   2. town: "Which town or city in Bukidnon?", matched only against that province's towns, read back.
// A town that exists in several provinces ("San Jose") asks one extra question, "Which province is San Jose in?"
// (`pendingTown`); that is not a try. Each step has its own ladder of tries (plan 002.2, utils/ladder.js).
// The answer is still the one `place_of_birth` value the form stores ("Malaybalay City, Bukidnon").

export const BIRTH_KEYS = new Set(['place_of_birth', 'place_of_birth_province', 'place_of_birth_town']);

export const BIRTH_IDLE = { active: false, step: null, province: null, pendingTown: null };

// The ladders of the two steps (a spoken try at step 1 does not use up step 2's tries).
export const BIRTH_LADDER_KEYS = ['place_of_birth_province', 'place_of_birth_town'];

const PROVINCE_QUESTION = 'Which province were you born in? If you were born in a city like Cagayan de Oro, say the city.';

export const BIRTH_PROVINCE_STEP = {
  key: 'place_of_birth_province',
  logKey: 'place_of_birth',
  label: 'Place of birth',
  question: PROVINCE_QUESTION,
  hint: 'Province, for example Bukidnon. Or a city like Cagayan de Oro',
};

/** Start the place of birth: always at the province (or city) question. */
export const startBirth = () => ({ ...BIRTH_IDLE, active: true, step: 'province' });

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
  if (birth.pendingTown) {
    return {
      ...BIRTH_PROVINCE_STEP,
      question: `Which province is ${birth.pendingTown.name} in?`,
      hint: `The province of ${birth.pendingTown.name}`,
    };
  }
  return BIRTH_PROVINCE_STEP;
};

/** The ladder this step counts its tries on. */
export const birthLadderKey = (birth) => (birth.step === 'town' ? 'place_of_birth_town' : 'place_of_birth_province');

/**
 * What to do with an /answer result for a place-of-birth step. Returns { birth, action, result }:
 *   'province' — only a province: read it back; a yes asks its town (`result.birthProvince` = { code, name });
 *   'confirm'  — a whole place: read it back ("Malaybalay City, Bukidnon. Is that correct?");
 *   'ask'      — the town exists in several provinces: ask which one (`birth.pendingTown`), not a try;
 *   'miss'     — not a place: one try of the step's ladder (the caller counts it).
 */
export const onBirthResult = (birth, result) => {
  if (result?.ok && result.value) {
    const code = String(result.normalized || '');
    if (birth.pendingTown) {
      // "Which province is San Jose in?": the province said must be one that has the town.
      if (/^\d+$/.test(code)) {
        const found = birth.pendingTown.candidates.find((c) => c.province_psgc === code);
        if (!found) return { birth, action: 'miss', result };
        const whole = { ...result, value: found.value, display: found.value, normalized: '' };
        return { birth: { ...birth, pendingTown: null }, action: 'confirm', result: whole };
      }
      return { birth: { ...birth, pendingTown: null }, action: 'confirm', result };   // a whole place said instead
    }
    if (/^\d+$/.test(code)) {
      return { birth, action: 'province', result: { ...result, birthProvince: { code, name: result.value } } };
    }
    return { birth, action: 'confirm', result };
  }
  const candidates = result?.candidates || [];
  if (result?.reason === 'ambiguous_town' && candidates.length && !birth.pendingTown) {
    return { birth: { ...birth, pendingTown: { name: candidates[0].town || 'that town', candidates } }, action: 'ask', result };
  }
  return { birth, action: 'miss', result };
};

/** The province was read back and confirmed: its town is asked next. */
export const onProvinceConfirmed = (birth, province) => ({ ...birth, step: 'town', province, pendingTown: null });

/** "No" to a read-back, or a skip: a try of the step's ladder; a pending town is forgotten. */
export const onBirthNo = (birth) => ({ birth: { ...birth, pendingTown: null }, action: 'miss' });
