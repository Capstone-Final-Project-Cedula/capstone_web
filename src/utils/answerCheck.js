// One interview answer checked by the backend (/extraction/answer), with the local check as the
// fallback when the backend cannot be reached.
import { BIRTH_KEYS } from './birthPlace';

// A spoken place of birth is never taken by the local check: it cannot tell a place from talk
// Whisper heard ("Sounds good"), so the station asks for it to be typed (plan 001.8).
export const OFFLINE_BIRTH_RESULT = {
  ok: false,
  reason: 'offline',
  message: 'I cannot check the place right now. Please type your place of birth on the screen.',
  methods: ['local'],
};

/**
 * request(): the API call (resolves to { data }); local(): the local check's result.
 * A 401 is re-thrown (the API client sends the user to the login page).
 */
export const checkAnswer = async ({ request, local, key, spoken = false, onOffline = () => {} }) => {
  try {
    const { data } = await request();
    return data;
  } catch (error) {
    if (error.response?.status === 401) throw error;
    onOffline(error);
    if (spoken && BIRTH_KEYS.has(key)) return OFFLINE_BIRTH_RESULT;
    return local();
  }
};
