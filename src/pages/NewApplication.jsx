import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaDownload,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaRegEdit,
  FaStop,
  FaUserTie,
  FaExclamationTriangle,
  FaBrain,
  FaCommentDots,
  FaFileAlt,
  FaTimes,
} from 'react-icons/fa';
import { speechAPI } from '../api/speech';
import { extractionAPI } from '../api/extraction';
import { formsAPI } from '../api/forms';
import { practiceLogAPI } from '../api/practiceLog';
import apiClient from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SusSurveyDialog from '../components/sus/SusSurveyDialog';
import ConsentNotice from '../components/interview/ConsentNotice';
import { combineSpelling, looksSpelled, titleCaseSpelled } from '../utils/spelling';
import { isNoAnswer, isYesAnswer, normalizeReply } from '../utils/replies';
import { ADDRESS_PARTS, addressTownOf, joinAddress } from '../utils/address';
import { checkAnswer } from '../utils/answerCheck';
import {
  BIRTH_IDLE, BIRTH_PROVINCE_STEP, birthQuestion, onBirthNo, onBirthPick, onBirthResult, shortcutResult, startBirth,
} from '../utils/birthPlace';
import { COUNTER_LINE, COUNTER_SCREEN_LINE } from '../utils/counterFlow';
import { validateFormData } from '../utils/requiredFields';
import { createPracticeRecorder, createPracticeSession } from '../utils/practiceLog';
import { Keyboard, Mic } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Constants & Configuration
// ═══════════════════════════════════════════════════════════════

const INTERVIEW_FIELDS = [
  {
    key: 'surname',
    label: 'Surname',
    question: "What is your surname?",
    hint: 'Example: Santos',
  },
  {
    key: 'given_name',
    label: 'Given name',
    question: "What is your given name?",
    hint: 'Example: Maria',
  },
  {
    key: 'middle_name',
    label: 'Middle name',
    question: "What is your middle name? If none, say none.",
    hint: 'Leave blank if none',
    optional: true,
  },
  {
    key: 'address',
    label: 'Complete address',
    question: "Please tell me your complete address.",
    hint: 'House number, street, barangay, city or municipality',
  },
  {
    key: 'date',
    label: 'Date of birth',
    question: "When is your birthday? Month, day, and year.",
    hint: 'Any way is fine: May 10 1990, 10 May 1990, 05/10/1990',
  },
  {
    key: 'sex',
    label: 'Sex',
    question: "Are you male or female?",
    hint: 'Male or Female',
  },
  {
    key: 'civil_status',
    label: 'Civil status',
    question: "Are you single, married, widowed, or separated?",
    hint: 'Single, Married, Widowed, or Separated',
  },
  {
    key: 'citizenship',
    label: 'Citizenship',
    question: "What is your citizenship?",
    hint: 'Example: Filipino',
  },
  {
    key: 'icr_no',
    label: 'ICR number',
    question: "What is your ICR number? If none, say none.",
    hint: 'Only for foreign residents. Say none if not applicable',
    optional: true,
  },
  {
    key: 'place_of_birth',
    label: 'Place of birth',
    question: "Where were you born?",
    hint: 'City or municipality and province',
  },
  {
    key: 'height',
    label: 'Height (cm)',
    question: "How tall are you, in centimeters or feet and inches?",
    hint: 'Example: 165 cm, or 5 feet 5',
  },
  {
    key: 'weight',
    label: 'Weight (kg)',
    question: "How much do you weigh, in kilos or pounds?",
    hint: 'Example: 60 kilos, or 130 pounds',
  },
  {
    key: 'occupation',
    label: 'Occupation',
    question: "What is your occupation?",
    hint: 'Example: Teacher',
  },
  {
    key: 'gross_annual_income',
    label: 'Gross annual income',
    question: "How much do you earn, per month or per year? If none, say none.",
    hint: 'Example: 240,000 a year, or 20,000 a month',
  },
];

const REQUIRED_KEYS = INTERVIEW_FIELDS
  .filter((f) => !f.optional)
  .map((f) => f.key);

const FIELD_MAP = Object.fromEntries(INTERVIEW_FIELDS.map((f) => [f.key, f]));

const SPEECH_RATE = 185;

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Kept short on purpose: every spoken second adds up over 14 questions.
const getConversationGreeting = () =>
  `${getTimeGreeting()}! I'll help you apply for your Cedula.`;

const REVIEW_PROMPT =
  'Please check your details on the screen. If everything is correct, say yes. To change something, say for example: change occupation to teacher.';

// Plan 001.3: spoken only once every check has passed and the save really starts.
const CHECKING_LINE = 'Checking your details.';
const SAVING_LINE = 'Saving your application, please wait.';

const isBlank = (value) => !String(value ?? '').trim();

// Required questions still blank (e.g. skipped after too many tries), in interview order.
const missingRequiredIndexes = (answers) =>
  INTERVIEW_FIELDS
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => REQUIRED_KEYS.includes(field.key) && isBlank(answers?.[field.key]))
    .map(({ index }) => index);

// "Height (cm)" -> "height", for speech.
const spokenLabel = (field) => field.label.toLowerCase().replace(/\s*\(.*\)/, '');

// Reply to "Would you like to type it or say it again?". "type" wins when both are heard.
const parseMissingChoice = (reply) => {
  const t = String(reply || '').toLowerCase();
  if (/\b(type|typed|typing|tayp|i-?type|keyboard|write|isulat|sulat)\b/.test(t)) return 'type';
  if (/\b(say|said|speak|again|repeat|voice|ulit|usab|isulti|sabihin)\b/.test(t)) return 'say';
  return null;
};

// Answers that can be spelled letter by letter when they were heard wrong.
// (Dates, numbers and choices are simply asked again instead.)
const SPELLABLE_KEYS = new Set(['surname', 'given_name', 'middle_name', 'place_of_birth', 'occupation', 'citizenship']);

const isFilipino = (answers) => /^filipino$/i.test(String(answers?.citizenship || '').trim());

// Next question to ask. The ICR number only applies to foreign residents, so it is
// skipped when the applicant is Filipino.
const nextFieldIndex = (index, answers) => {
  let next = index + 1;
  if (INTERVIEW_FIELDS[next]?.key === 'icr_no' && isFilipino(answers)) next += 1;
  return next;
};

// The address is asked in 3 parts by voice (plan 001.6). `address` = { active, part, results }.
const isAddressPartOf = (address, fieldIndex) => INTERVIEW_FIELDS[fieldIndex]?.key === 'address' && address.active;
// The question being asked: the field itself, or the address part in progress.
const questionOf = (address, fieldIndex) => (isAddressPartOf(address, fieldIndex)
  ? ADDRESS_PARTS[address.part]
  : INTERVIEW_FIELDS[fieldIndex]);
const attemptKeyOf = (address, fieldIndex) => (isAddressPartOf(address, fieldIndex) ? ADDRESS_PARTS[address.part].key : fieldIndex);
// The place of birth is asked in steps by voice (plan 001.8). `birth` = see utils/birthPlace.js.
const isBirthStepOf = (birth, fieldIndex) => INTERVIEW_FIELDS[fieldIndex]?.key === 'place_of_birth' && birth.active;
// The question being asked: an address part, a place-of-birth step, or the field itself.
const askedOf = (address, birth, fieldIndex) => (isBirthStepOf(birth, fieldIndex)
  ? birthQuestion(birth)
  : questionOf(address, fieldIndex));
// The practice log keeps one row per field: every place-of-birth step is noted as `place_of_birth`.
const logKeyOf = (asked) => asked.logKey || asked.key;
const RETRY_PHRASES = [
  "I didn't quite catch that. Could you say it again?",
  "Sorry, I missed that. One more time, please?",
  "Let's try that once more.",
];

// Phases drive every piece of visual/voice feedback in the UI.
const PHASE = {
  IDLE: 'idle',
  GREETING: 'greeting',
  ASKING: 'asking',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  CONFIRMING: 'confirming',
  ISSUING: 'issuing',
  RETRY: 'retry',
};

const PHASE_COPY = {
  [PHASE.IDLE]: { label: 'Ready when you are', icon: '💬' },
  [PHASE.GREETING]: { label: 'Saying hello...', icon: '👋' },
  [PHASE.ASKING]: { label: 'Asking a question...', icon: '🗣️' },
  [PHASE.LISTENING]: { label: 'Listening...', icon: '🎤' },
  [PHASE.THINKING]: { label: 'Understanding your answer...', icon: '🧠' },
  [PHASE.SPEAKING]: { label: 'Speaking...', icon: '🔊' },
  [PHASE.CONFIRMING]: { label: 'Verifying your information...', icon: '🔍' },
  [PHASE.ISSUING]: { label: 'Preparing your application...', icon: '📄' },
  [PHASE.RETRY]: { label: "Didn't quite catch that...", icon: '🔁' },
};

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Pure Utility Functions
// ═══════════════════════════════════════════════════════════════

const cleanText = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const cleanNumber = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  return cleaned ? Number(cleaned) : null;
};

const getSpeechRecognition = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const isSpeechSupported = () => Boolean(getSpeechRecognition());

const isBlankAnswer = (value) =>
  /^(none|no|not applicable|n\/a|blank|skip|wala|wala po|no middle name)$/i.test(String(value || '').trim().replace(/[.!]$/, ''));

// normalizeReply, isYesAnswer and isNoAnswer live in utils/replies.js (tested there; plan 001.6).

const TEXT_TITLE_CASE_FIELDS = new Set([
  'surname',
  'given_name',
  'middle_name',
  'address',
  'citizenship',
  'place_of_birth',
  'occupation',
]);

const titleCaseWords = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_, first, rest) => `${first.toUpperCase()}${rest}`)
    .replace(/\b(st|rd|nd|th)\b/gi, (match) => match.toUpperCase());
};

const MONTH_LOOKUP = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const getValidDateParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return { year, month, day };
  }
  return null;
};

const formatDateParts = ({ year, month, day }, format = 'display') => {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  return format === 'iso' ? `${yyyy}-${mm}-${dd}` : `${mm}-${dd}-${yyyy}`;
};

const parseDateParts = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return getValidDateParts(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10)
    );
  }

  const numericMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10);
    const day = parseInt(numericMatch[2], 10);
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) year += 2000;
    return getValidDateParts(year, month, day);
  }

  const monthFirstMatch = trimmed.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i
  );
  if (monthFirstMatch) {
    return getValidDateParts(
      parseInt(monthFirstMatch[3], 10),
      MONTH_LOOKUP[monthFirstMatch[1].toLowerCase()],
      parseInt(monthFirstMatch[2], 10)
    );
  }

  const dayFirstMatch = trimmed.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b/i
  );
  if (dayFirstMatch) {
    return getValidDateParts(
      parseInt(dayFirstMatch[3], 10),
      MONTH_LOOKUP[dayFirstMatch[2].toLowerCase()],
      parseInt(dayFirstMatch[1], 10)
    );
  }

  return null;
};

const validateDate = (value) => {
  const parts = parseDateParts(value);
  return parts ? formatDateParts(parts) : null;
};

const formatDateForBackend = (value) => {
  const parts = parseDateParts(value);
  return parts ? formatDateParts(parts, 'iso') : null;
};

const validateSex = (value) => {
  if (!value) return null;
  const t = String(value).trim().toLowerCase();
  if (['1', 'one', 'male', 'm', 'mail'].includes(t)) return 'Male';
  if (['2', 'two', 'female', 'f', 'femal', 'fe-male'].includes(t)) return 'Female';
  if (t.includes('female')) return 'Female';
  if (t.includes('male')) return 'Male';
  return null;
};

const validateCivilStatus = (value) => {
  if (!value) return null;
  const t = String(value).trim().toLowerCase();
  const map = {
    '1': 'Single', 'one': 'Single', 'single': 'Single', 's': 'Single',
    '2': 'Married', 'two': 'Married', 'married': 'Married', 'm': 'Married', 'mar': 'Married',
    '3': 'Widowed', 'three': 'Widowed', 'widowed': 'Widowed', 'widow': 'Widowed', 'w': 'Widowed', 'wid': 'Widowed',
    '4': 'Separated', 'four': 'Separated', 'separated': 'Separated', 'divorced': 'Separated',
  };
  if (map[t]) return map[t];
  for (const status of ['single', 'married', 'widowed', 'separated', 'divorced']) {
    if (t.includes(status)) {
      return status === 'divorced' ? 'Separated' : status.charAt(0).toUpperCase() + status.slice(1);
    }
  }
  return null;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * Used only when the backend cannot be reached: a strict, simpler check so a
 * clearly wrong answer ("nails" for sex) is still not accepted.
 */
const localInterpret = (key, text) => {
  const t = String(text || '').trim();
  const field = FIELD_MAP[key];
  const fail = (message) => ({ ok: false, message, methods: ['local'] });
  const ok = (value, display) => ({ ok: true, value, display: display || value, methods: ['local'] });
  if (!t) return field?.optional ? ok('') : fail(`Please tell me your ${field?.label.toLowerCase()}.`);
  if (field?.optional && isBlankAnswer(t)) return ok('');
  switch (key) {
    case 'sex': {
      const v = validateSex(t);
      return v ? ok(v) : fail('Please answer male or female.');
    }
    case 'civil_status': {
      const v = validateCivilStatus(t);
      return v ? ok(v) : fail('Please answer single, married, widowed, or separated.');
    }
    case 'date': {
      const p = parseDateParts(t);
      if (!p) return fail('Please say your full birthday, for example May 10, 1990.');
      return ok(`${MONTH_NAMES[p.month - 1]} ${p.day}, ${p.year}`);
    }
    case 'height': {
      const n = cleanNumber(t);
      return n >= 50 && n <= 250 ? ok(String(n)) : fail('Please say your height in centimeters.');
    }
    case 'weight': {
      const n = cleanNumber(t);
      return n >= 20 && n <= 300 ? ok(String(n)) : fail('Please say your weight in kilos.');
    }
    case 'gross_annual_income': {
      const n = cleanNumber(t);
      return n !== null || /^(none|wala|zero)$/i.test(t) ? ok(String(n || 0)) : fail('Please say an amount.');
    }
    default:
      return ok(validateFieldValue(key, t));
  }
};

/**
 * Understand one answer for one field. The backend uses DistilBERT (names,
 * places) and regex (dates, numbers, choices) and rejects answers that do not
 * fit the question. Falls back to localInterpret if the backend is unreachable.
 */
const interpretAnswer = (key, text, { spoken = false, town = null, province = null } = {}) => checkAnswer({
  request: () => extractionAPI.understandAnswer(key, String(text || ''), spoken, town, province),
  local: () => localInterpret(key, text),
  key,
  spoken,
  onOffline: (error) => console.warn('Answer check unavailable, using the local check:', error),
});

const validateFieldValue = (key, value) => {
  if (key === 'sex') return validateSex(value) || value;
  if (key === 'civil_status') return validateCivilStatus(value) || value;
  if (key === 'date') return validateDate(value) || value;
  if (key === 'icr_no') return String(value || '').trim().toUpperCase();
  if (TEXT_TITLE_CASE_FIELDS.has(key)) return titleCaseWords(value);
  return value;
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;


// ═══════════════════════════════════════════════════════════════
// SECTION 3: Audio Processing
// ═══════════════════════════════════════════════════════════════

const audioBufferToWavBlob = (audioBuffer) => {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerChannel = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = samplesPerChannel * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = Array.from({ length: channelCount }, (_, i) => audioBuffer.getChannelData(i));

  for (let s = 0; s < samplesPerChannel; s++) {
    for (let c = 0; c < channelCount; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][s]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const convertRecordingToWav = async (blob) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return blob;

  const ctx = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const targetRate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;

    if (decoded.numberOfChannels > 1) {
      const merger = offline.createChannelMerger(1);
      const splitter = offline.createChannelSplitter(decoded.numberOfChannels);
      source.connect(splitter);
      for (let i = 0; i < decoded.numberOfChannels; i++) {
        splitter.connect(merger, i, 0);
      }
      merger.connect(offline.destination);
    } else {
      source.connect(offline.destination);
    }

    source.start(0);
    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  } finally {
    ctx.close?.();
  }
};

// ═══════════════════════════════════════════════════════════════
// SECTION 3B: Backend Voice Playback (Edge neural TTS)
// ═══════════════════════════════════════════════════════════════

/**
 * Fetches synthesized speech audio from the backend (Microsoft Edge
 * neural TTS) and plays it through the browser's audio output.
 * Falls back to the browser's built-in speechSynthesis only if the
 * backend call fails (e.g. no internet), so the interview never goes
 * silent.
 *
 * @param {string} text - What to say
 * @param {object} opts
 * @param {(audio: HTMLAudioElement) => void} [opts.onStart] - fired once playback begins
 * @param {() => void} [opts.onEnd] - fired once when speech finishes (success or fallback)
 * @param {React.MutableRefObject} [opts.audioRef] - optional ref to store the live Audio element, so callers can pause/cancel it
 */
// Spoken lines already fetched from the backend (text -> audio Blob). The fixed
// questions are fetched ahead of time (prefetchSpeech) so they play without waiting.
const speechCache = new Map();
const SPEECH_CACHE_MAX = 80;

const fetchSpeech = (text) => {
  const key = String(text || '').trim();
  if (!key) return Promise.resolve(null);
  if (!speechCache.has(key)) {
    const request = apiClient
      .post('/speech/synthesize', { text: key, rate: SPEECH_RATE }, { responseType: 'blob' })
      .then((response) => response.data)
      .catch((error) => {
        speechCache.delete(key);   // retry next time instead of caching the failure
        throw error;
      });
    speechCache.set(key, request);
    if (speechCache.size > SPEECH_CACHE_MAX) speechCache.delete(speechCache.keys().next().value);
  }
  return speechCache.get(key);
};

/** Start generating a line in the background; it plays instantly when needed. */
const prefetchSpeech = (...texts) => texts.forEach((t) => fetchSpeech(t).catch(() => {}));

const synthesizeAndPlay = async (text, { onStart, onEnd, audioRef } = {}) => {
  const spoken = String(text || '').trim();
  if (!spoken) {
    onEnd?.();
    return;
  }

  const stopCurrentAudio = () => {
    window.speechSynthesis?.cancel();
    if (audioRef?.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  };

  stopCurrentAudio();

  try {
    const blob = await fetchSpeech(spoken);
    const url = window.URL.createObjectURL(blob);
    const audio = new Audio(url);
    if (audioRef) audioRef.current = audio;

    await new Promise((resolve) => {
      audio.onended = () => {
        window.URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        window.URL.revokeObjectURL(url);
        resolve();
      };
      onStart?.(audio);
      audio.play().catch(() => {
        window.URL.revokeObjectURL(url);
        resolve();
      });
    });
  } catch (error) {
    console.warn('Backend voice unavailable, using browser voice instead:', error);
    stopCurrentAudio();
    if (window.speechSynthesis) {
      await new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = 'en-US';
        utterance.rate = 1.08;
        utterance.pitch = 1;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        onStart?.(null);
        window.speechSynthesis.speak(utterance);
      });
    }
  } finally {
    if (audioRef) audioRef.current = null;
    onEnd?.();
  }
};

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Form Data Builders
// ═══════════════════════════════════════════════════════════════

const buildApplicantData = (answers) => {
  const sex = validateSex(answers.sex);
  const civilStatus = validateCivilStatus(answers.civil_status);
  const dob = formatDateForBackend(answers.date);

  return {
    surname: titleCaseWords(answers.surname),
    given_name: titleCaseWords(answers.given_name),
    middle_name: cleanText(answers.middle_name),
    address: titleCaseWords(answers.address),
    // No silent defaults: a missing or unreadable value is caught by validateFormData.
    sex: sex || null,
    civil_status: civilStatus || null,
    citizenship: titleCaseWords(answers.citizenship || 'Filipino'),
    place_of_birth: cleanText(titleCaseWords(answers.place_of_birth)),
    occupation: cleanText(titleCaseWords(answers.occupation)),
    gross_annual_income: cleanNumber(answers.gross_annual_income) || 0,
    tax_classification: answers.tax_classification || 'A',
    date_of_birth: dob || null,
    icr_number: cleanText(answers.icr_no),
    height_cm: cleanNumber(answers.height) || 0,
    weight_kg: cleanNumber(answers.weight) || 0,
  };
};

// validateFormData (the 6 required fields + income) lives in utils/requiredFields.js,
// shared with the QR page and matching the server's 422 check (plan 001.4).

// Temporary practice log (plan 001.7): a question's answer in the form the CTC saves it
// (the birthday as the ISO date ...), so the backend compares it with the saved record.
const PRACTICE_SAVED_FIELD = {
  surname: 'surname', given_name: 'given_name', middle_name: 'middle_name', address: 'address',
  date: 'date_of_birth', sex: 'sex', civil_status: 'civil_status', citizenship: 'citizenship',
  icr_no: 'icr_number', place_of_birth: 'place_of_birth', height: 'height_cm', weight: 'weight_kg',
  occupation: 'occupation', gross_annual_income: 'gross_annual_income',
};
const practiceSavedForm = (field, value) => {
  const saved = PRACTICE_SAVED_FIELD[field];
  if (!saved) return String(value ?? '').trim();          // an address part is never saved apart
  return buildApplicantData({ [field]: value })[saved];
};

// ═══════════════════════════════════════════════════════════════
// SECTION 5: PDF & Print Utilities
// ═══════════════════════════════════════════════════════════════

// Printing happens at the counter (Records), never at the interview station: see
// utils/printPdf.js.

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Voice Correction Parser
// ═══════════════════════════════════════════════════════════════

// What people call each question, in English and Filipino ("apelyido", "tirahan").
const FIELD_ALIAS_EXTRAS = {
  surname: ['last name', 'family name', 'apelyido'],
  given_name: ['first name', 'pangalan'],
  middle_name: ['middle initial', 'gitnang pangalan'],
  address: ['address', 'tirahan'],
  date: ['date of birth', 'birthday', 'birth date', 'birthdate', 'kaarawan', 'kapanganakan'],
  sex: ['gender', 'kasarian'],
  civil_status: ['status', 'civil status'],
  citizenship: ['nationality', 'pagkamamamayan'],
  icr_no: ['icr number', 'icr'],
  place_of_birth: ['birthplace', 'birth place', 'where i was born', 'lugar ng kapanganakan'],
  height: ['taas'],
  weight: ['timbang'],
  occupation: ['job', 'work', 'trabaho', 'profession'],
  gross_annual_income: ['income', 'salary', 'annual income', 'kita', 'sweldo', 'earnings'],
};

const FIELD_ALIASES = INTERVIEW_FIELDS.map((field, index) => {
  const baseLabel = field.label.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  return {
    ...field,
    index,
    aliases: Array.from(new Set([
      field.key, field.key.replace(/_/g, ' '), baseLabel, baseLabel.replace('complete ', ''),
      ...(FIELD_ALIAS_EXTRAS[field.key] || []),
    ])).sort((a, b) => b.length - a.length),   // longest first: "middle name" before "name"
  };
});

/** The question a phrase names ("my last name", "the birthday part"), or -1. */
const findFieldIndex = (phrase) => {
  const p = normalizeReply(phrase).replace(/\b(my|the|ang|aking|part|question|tanong|po|please)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!p) return -1;
  for (const f of FIELD_ALIASES) {
    if (f.aliases.some((a) => p === a || new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(p))) {
      return f.index;
    }
  }
  return -1;
};

/**
 * Moving around the interview by voice:
 *   "go back", "balik"                      -> { type: 'back' }
 *   "go back to my address", "change my surname", "balik sa apelyido"
 *                                           -> { type: 'goto', index }
 * A change that already says the new value ("change my surname to Cruz") is a
 * correction, handled by parseVoiceCorrections instead.
 */
const parseNavigation = (transcript) => {
  const reply = normalizeReply(transcript);
  if (!reply) return null;
  const back = reply.match(
    /^(?:(?:let'?s|lets|can we|can i|please|pwede|i want to|i'd like to)\s+)*(?:go\s+back|back|previous(?:\s+question)?|balik|bumalik|ibalik|return)(?:\s+(?:to|sa)\s+(.+))?$/
  );
  if (back) {
    if (!back[1]) return { type: 'back' };
    const index = findFieldIndex(back[1]);
    return index >= 0 ? { type: 'goto', index } : { type: 'back' };
  }
  const change = reply.match(
    /^(?:(?:i want to|i'd like to|let me|can i|please|pwede|wait)\s+)*(?:change|edit|fix|correct|redo|repeat|ulitin|palitan|itama)\s+(.+)$/
  );
  if (change && !/\s(?:to|into|as)\s/.test(` ${change[1]} `)) {
    const index = findFieldIndex(change[1]);
    if (index >= 0) return { type: 'goto', index };
  }
  return null;
};

const parseVoiceCorrections = (transcript) => {
  const spoken = String(transcript || '').trim();
  if (!spoken || isYesAnswer(spoken) || isNoAnswer(spoken)) return [];

  const fieldAliases = FIELD_ALIASES;

  const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [];

  fieldAliases.forEach((field) => {
    field.aliases.forEach((alias) => {
      const pattern = new RegExp(
        `\\b(?:change|update|correct|set)?\\s*(?:my\\s+)?${escapeRegExp(alias)}\\s*(?:is|to|as|into|equals)\\s*`,
        'gi'
      );
      let match;
      while ((match = pattern.exec(spoken)) !== null) {
        matches.push({ key: field.key, label: field.label, start: match.index, valueStart: pattern.lastIndex });
      }
    });
  });

  const unique = matches
    .sort((a, b) => a.start - b.start || b.valueStart - a.valueStart)
    .filter((m, i, arr) => i === 0 || m.start !== arr[i - 1].start);

  return unique
    .map((m, i) => {
      const next = unique[i + 1];
      const raw = spoken.slice(m.valueStart, next ? next.start : spoken.length);
      const value = raw.replace(/^\s*(and|also|then|please)\s+/i, '').replace(/[,.!?;:]+$/g, '').trim();
      return value ? { key: m.key, label: m.label, value } : null;
    })
    .filter(Boolean);
};


// ═══════════════════════════════════════════════════════════════
// SECTION 7: Custom Hooks (All inside this file)
// ═══════════════════════════════════════════════════════════════

/**
 * Hook: useSpeechSynthesis
 * Manages text-to-speech with lifecycle callbacks. Uses the backend's
 * Edge neural TTS voice via synthesizeAndPlay(), falling back to the
 * browser's built-in speechSynthesis only if that call fails.
 */
function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const speechSequenceRef = useRef(0);

  const cancel = useCallback(() => {
    speechSequenceRef.current += 1;
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text, onEnd) => {
    cancel();
    const sequence = speechSequenceRef.current + 1;
    speechSequenceRef.current = sequence;
    setIsSpeaking(true);
    synthesizeAndPlay(text, {
      audioRef,
      onEnd: () => {
        if (speechSequenceRef.current !== sequence) return;
        setIsSpeaking(false);
        onEnd?.();
      },
    });
  }, [cancel]);

  useEffect(() => () => cancel(), [cancel]);

  return { isSpeaking, speak, cancel };
}

/**
 * Hook: useBrowserSpeechRecognition
 * One-shot browser-based speech recognition.
 */
function useBrowserSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const listenOnce = useCallback(({ onStart, onResult, onError, onEnd }) => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      onError?.('unsupported');
      return null;
    }

    const recognition = new SpeechRecognition();
    let finalText = '';
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      onStart?.();
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      const heard = (finalTranscript || interimTranscript).trim();
      if (heard) {
        finalText = heard;
        onResult?.(heard, Boolean(finalTranscript));
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      onError?.(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onEnd?.(finalText);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return recognition;
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  return { isListening, listenOnce, stopListening };
}

// Voice activity detection for one answer (milliseconds).
const VAD = {
  calibrateMs: 300,   // measure the room's background noise first
  silenceMs: 800,     // this much quiet after speaking ends the answer
  noSpeechMs: 7000,   // nobody spoke at all
  maxMs: 15000,       // longest answer (long addresses)
  minSpeechMs: 150,   // shorter than this is a click or a cough, not an answer
  tickMs: 40,
};

const isWhisperCaptureSupported = () =>
  Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));

/**
 * Hook: useWhisperListener
 * The speech-to-text step of the live interview, as described in the paper:
 * records ONE spoken answer, stops by itself when the speaker pauses, and has
 * Whisper (backend /speech/transcribe) transcribe it with a hint for that
 * question. Same interface as the browser listener: listenOnce({ fieldKey,
 * onStart, onTranscribing, onEnd(text, meta), onError }).
 */
function useWhisperListener() {
  const [isListening, setIsListening] = useState(false);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const activeRef = useRef(null);

  const getStream = useCallback(async () => {
    if (streamRef.current?.getAudioTracks().some((t) => t.readyState === 'live')) return streamRef.current;
    streamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    return streamRef.current;
  }, []);

  const getContext = useCallback(async () => {
    if (!ctxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  // Ask for the microphone once, at the start of the conversation.
  const prepare = useCallback(async () => {
    await getStream();
    await getContext();
  }, [getStream, getContext]);

  const stopListening = useCallback(() => activeRef.current?.cancel(), []);

  const releaseMicrophone = useCallback(() => {
    activeRef.current?.cancel();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const listenOnce = useCallback(async ({ fieldKey, town, province, onStart, onTranscribing, onEnd, onError, vad }) => {
    const cfg = { ...VAD, ...(vad || {}) };   // e.g. spelling allows longer pauses between letters
    let stream;
    let ctx;
    try {
      stream = await getStream();
      ctx = await getContext();
    } catch {
      onError?.('mic-blocked');
      onEnd?.('', { error: 'mic-blocked' });
      return;
    }

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const level = () => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      return Math.sqrt(sum / buffer.length);
    };

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      .find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    let cancelled = false;
    let speechStart = 0;
    let lastVoice = 0;
    let noise = 0;
    let noiseSamples = 0;
    const started = performance.now();

    const finish = () => {
      clearInterval(timer);
      try { source.disconnect(); } catch { /* already disconnected */ }
      if (recorder.state !== 'inactive') recorder.stop();
    };
    // Recording starts the moment the assistant stops speaking (no beep), so an applicant
    // who answers right away is not cut off.
    recorder.start(250);
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - started;
      const current = level();
      if (elapsed < cfg.calibrateMs) {
        noise += current;
        noiseSamples += 1;
        // Someone already talking here must still be detected as speech.
        if (current > 0.05) { speechStart = speechStart || now; lastVoice = now; }
        return;
      }
      // Capped, so speech during the noise measurement cannot make the threshold too high.
      const threshold = Math.min(0.05, Math.max(0.012, (noise / Math.max(noiseSamples, 1)) * 2.5));
      if (current > threshold) {
        if (!speechStart) speechStart = now;
        lastVoice = now;
      }
      if (speechStart && now - lastVoice > cfg.silenceMs) finish();
      else if (!speechStart && elapsed > cfg.noSpeechMs) finish();
      else if (elapsed > cfg.maxMs) finish();
    }, cfg.tickMs);

    activeRef.current = { cancel: () => { cancelled = true; finish(); } };

    recorder.onstop = async () => {
      activeRef.current = null;
      setIsListening(false);
      if (cancelled) return;
      if (!speechStart || lastVoice - speechStart < cfg.minSpeechMs) {
        onEnd?.('', { engine: 'whisper', reason: 'no-speech' });
        return;
      }
      onTranscribing?.();
      try {
        const wav = await convertRecordingToWav(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        const file = new File([wav], 'answer.wav', { type: 'audio/wav' });
        const t0 = performance.now();
        const { data } = await speechAPI.transcribe(file, fieldKey, { timeout: 20000, town, province });
        onEnd?.((data.transcript || '').trim(), {
          engine: 'whisper',
          seconds: Math.round((performance.now() - t0) / 100) / 10,
        });
      } catch (error) {
        if (error.response?.status === 401) return;            // login expired: client redirects
        if (error.response?.status === 422) {                   // Whisper heard no speech
          onEnd?.('', { engine: 'whisper', reason: 'no-speech' });
          return;
        }
        onError?.('whisper-failed');
        onEnd?.('', { engine: 'whisper', error: 'whisper-failed' });
      }
    };

    setIsListening(true);
    onStart?.();
  }, [getStream, getContext]);

  useEffect(() => () => releaseMicrophone(), [releaseMicrophone]);

  return { isListening, listenOnce, stopListening, prepare, releaseMicrophone };
}

/**
 * Hook: useConversationEngine
 * Orchestrates the full hands-free voice interview flow.
 * `setPhase` drives every visible/audible state cue in the UI.
 */
function useConversationEngine({
  answers,
  currentFieldIndex,
  setAnswers,
  setDraftAnswer,
  setCurrentFieldIndex,
  setStep,
  setAwaitingConfirmation,
  setStatusMessage,
  setPhase,
  setVoiceError,
  addChatMessage,
  issueForm,
  setConfirmView,
  setMissingView,
  setAddressPart,
  practice,   // temporary practice log (plan 001.7): { session, rec }
}) {
  const { isSpeaking, speak: rawSpeak, cancel: cancelSpeech } = useSpeechSynthesis();
  const browser = useBrowserSpeechRecognition();
  const whisper = useWhisperListener();
  const [isConversationActive, setIsConversationActive] = useState(false);
  const isListening = whisper.isListening || browser.isListening;

  // Speech-to-text engine: Whisper (as in the paper). The browser's own recognition
  // is only a backup if the Whisper server fails twice in a row.
  const engineRef = useRef('whisper');
  const whisperFailuresRef = useRef(0);
  const stopBrowserListening = useCallback(() => {
    whisper.stopListening();
    browser.stopListening();
  }, [whisper, browser]);

  // One listening turn with the active engine. onEnd(text, meta) — meta.engine says who heard it.
  const listenOnce = useCallback((opts) => {
    if (engineRef.current === 'browser') {
      browser.listenOnce({ ...opts, onEnd: (text) => opts.onEnd?.(text, { engine: 'browser' }) });
      return;
    }
    whisper.listenOnce({
      ...opts,
      onTranscribing: () => {
        setPhase(PHASE.THINKING);
        setStatusMessage('Whisper is transcribing your answer...');
        opts.onTranscribing?.();
      },
      onEnd: (text, meta) => {
        if (meta?.error === 'whisper-failed') {
          whisperFailuresRef.current += 1;
          if (whisperFailuresRef.current >= 2 && isSpeechSupported()) {
            engineRef.current = 'browser';
            setVoiceError('The Whisper server is not responding, so the browser speech recognition is being used for now.');
          }
        } else if (!meta?.error) {
          whisperFailuresRef.current = 0;
        }
        opts.onEnd?.(text, meta);
      },
    });
  }, [whisper, browser, setPhase, setStatusMessage, setVoiceError]);

  const answersRef = useRef(answers);
  const currentFieldIndexRef = useRef(currentFieldIndex);
  const conversationActiveRef = useRef(false);
  // The callbacks below are memoized once, so issueForm is read from a ref to always get
  // the current one (its inputMethod changes after the first render).
  const issueFormRef = useRef(issueForm);
  issueFormRef.current = issueForm;
  // Functions called before they are declared (or by memoized callbacks that would keep a
  // first-render copy) are read from here; filled in just before the hook returns.
  const latestRef = useRef({});

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { currentFieldIndexRef.current = currentFieldIndex; }, [currentFieldIndex]);

  // Wrap speak() so every utterance flips the phase to SPEAKING automatically.
  const speak = useCallback((text, onEnd) => {
    setPhase(PHASE.SPEAKING);
    rawSpeak(text, onEnd);
  }, [rawSpeak, setPhase]);

  const stopConversation = useCallback(() => {
    setIsConversationActive(false);
    conversationActiveRef.current = false;
    setPhase(PHASE.IDLE);
    setStatusMessage('Conversation paused');
    cancelSpeech();
    stopBrowserListening();
    whisper.releaseMicrophone();
    pendingConfirmRef.current = null;
    setConfirmView(null);
    missingTurnRef.current += 1;
    setMissingView(null);
    addressRef.current = { active: false, part: 0, results: {} };   // a resumed address starts at the town
    birthRef.current = BIRTH_IDLE;                                    // a resumed place of birth starts over
    setAddressPart(null);
  }, [cancelSpeech, stopBrowserListening, whisper, setStatusMessage, setPhase, setConfirmView, setMissingView, setAddressPart]);

  // The conversation is over (Cedula saved, or moved to the manual review page): stop
  // listening and free the microphone, but let the last spoken line finish.
  const endConversation = useCallback(() => {
    setIsConversationActive(false);
    conversationActiveRef.current = false;
    stopBrowserListening();
    whisper.releaseMicrophone();
    pendingConfirmRef.current = null;
    setConfirmView(null);
    missingTurnRef.current += 1;
    setMissingView(null);
    addressRef.current = { active: false, part: 0, results: {} };
    birthRef.current = BIRTH_IDLE;
    setAddressPart(null);
  }, [stopBrowserListening, whisper, setConfirmView, setMissingView, setAddressPart]);

  // Where to continue after the applicant went back to an earlier question by voice.
  const resumeIndexRef = useRef(null);

  const moveToNextQuestion = useCallback(() => {
    const index = currentFieldIndexRef.current;
    const naturalNext = nextFieldIndex(index, answersRef.current);
    let nextIndex = naturalNext;
    if (resumeIndexRef.current !== null) {
      // Went back to fix one answer: return to where the interview was.
      nextIndex = Math.max(naturalNext, resumeIndexRef.current);
      resumeIndexRef.current = null;
    }
    if (nextIndex >= INTERVIEW_FIELDS.length) {
      setPhase(PHASE.CONFIRMING);
      setStatusMessage('All questions answered. Please check the details.');
      window.setTimeout(() => {
        if (conversationActiveRef.current) latestRef.current.startVoiceReview();
      }, 150);
      return;
    }
    if (naturalNext > index + 1 && INTERVIEW_FIELDS[index + 1].key === 'icr_no') {
      // Filipino citizen: no ICR number to ask about.
      answersRef.current = { ...answersRef.current, icr_no: '' };
      setAnswers((prev) => ({ ...prev, icr_no: '' }));
    }
    currentFieldIndexRef.current = nextIndex;
    setCurrentFieldIndex(nextIndex);
    window.setTimeout(() => {
      if (conversationActiveRef.current) askQuestion(nextIndex);
    }, 150);
  }, [setCurrentFieldIndex, setStatusMessage, setPhase, setAnswers]);

  // `value` is already normalized by interpretAnswer (e.g. "May 10, 1990", "168").
  const saveSpokenAnswer = useCallback((fieldIndex, value) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    setDraftAnswer(value);
    // Update the ref right away: the next step (e.g. skipping ICR for Filipinos) reads it
    // before React has applied the state update.
    answersRef.current = { ...answersRef.current, [field.key]: value };
    setAnswers((prev) => ({ ...prev, [field.key]: value }));
  }, [setAnswers, setDraftAnswer]);

  // The address is asked in 3 short questions (plan 001.6): town or city, barangay, purok or street.
  // `active` while those questions run; each confirmed answer is kept in `results` and they are joined
  // into the one address answer after the last one.
  const addressRef = useRef({ active: false, part: 0, results: {} });
  // The place of birth in steps (plan 001.8): the "Were you born in <town>?" shortcut, the province,
  // then a town of it. `homeTownRef`: the town of the address answers ("Baungon, Bukidnon").
  const birthRef = useRef(BIRTH_IDLE);
  const homeTownRef = useRef('');

  // How many times each question was answered with something unusable, said "no" to, or answered
  // again at the "is that correct?" step (plan 001.8: every try counts). At the limit the answer is
  // typed instead of asked again; the place of birth shows its closest places to tap.
  const attemptsRef = useRef({});
  const MAX_ATTEMPTS = 2;
  const countAttempt = (fieldIndex) => {
    const key = attemptKeyOf(addressRef.current, fieldIndex);
    attemptsRef.current[key] = (attemptsRef.current[key] || 0) + 1;
    return attemptsRef.current[key];
  };

  // The on-screen confirmation panel (see confirmAnswer).
  const confirmTurnRef = useRef(0);        // a tap ends the voice turn in progress
  const pendingConfirmRef = useRef(null);  // { fieldIndex, result } while the panel is up

  // The missing-answers step before the final "yes" (plan 001.3).
  const missingTurnRef = useRef(0);          // a tap ends the voice turn in progress
  const pendingMissingRef = useRef(null);    // field index shown on the missing-answer panel
  const missingRetryRef = useRef(new Set()); // fields asked again from that step ("Say it again")

  const clearConfirmView = useCallback(() => {
    pendingConfirmRef.current = null;
    setConfirmView(null);
  }, [setConfirmView]);

  const askQuestion = useCallback((fieldIndex = currentFieldIndexRef.current) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    if (field.key === 'address' && !addressRef.current.active) {
      // Starting the address (again): from the town question.
      addressRef.current = { active: true, part: 0, results: {} };
      ADDRESS_PARTS.forEach((p) => { attemptsRef.current[p.key] = 0; });
    }
    if (field.key === 'place_of_birth' && !birthRef.current.active) {
      birthRef.current = startBirth(homeTownRef.current);   // the shortcut first when the address gave a town
    }
    const asked = askedOf(addressRef.current, birthRef.current, fieldIndex);
    practice.rec.asked(logKeyOf(asked));   // practice log: the clock starts at the first ask only
    clearConfirmView();
    currentFieldIndexRef.current = fieldIndex;
    setCurrentFieldIndex(fieldIndex);
    const inSteps = field.key === 'address' || isBirthStepOf(birthRef.current, fieldIndex);
    setAddressPart(inSteps ? asked : null);
    setDraftAnswer(inSteps ? '' : answersRef.current[field.key] || '');
    setAwaitingConfirmation(false);
    if (isBirthStepOf(birthRef.current, fieldIndex) && birthRef.current.step === 'shortcut') {
      // "Were you born in Baungon, Bukidnon?": a yes is the answer, a no asks the province.
      latestRef.current.confirmAnswer(fieldIndex, shortcutResult(birthRef.current.home));
      return;
    }
    setPhase(PHASE.ASKING);
    setStatusMessage(`Asking about your ${asked.label.toLowerCase()}`);
    addChatMessage('assistant', asked.question);
    speak(asked.question, () => listenForAnswer(fieldIndex));
  }, [speak, clearConfirmView, setCurrentFieldIndex, setAddressPart, setDraftAnswer, setAwaitingConfirmation, setStatusMessage, setPhase, addChatMessage, practice]);

  // Whisper -> (handleSpokenAnswer) DistilBERT + Regex -> voice read-back.
  const listenForAnswer = useCallback((fieldIndex) => {
    if (!conversationActiveRef.current) return;
    const asked = askedOf(addressRef.current, birthRef.current, fieldIndex);
    listenOnce({
      fieldKey: asked.key,   // Whisper gets a hint for this question (e.g. the barangays of the town said)
      town: asked.key === 'address_barangay' ? addressTownOf(addressRef.current) : null,
      province: asked.key === 'place_of_birth_town' ? birthRef.current.province?.code : null,   // its towns in the hint
      onStart: () => {
        setVoiceError('');
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening for your answer...');
      },
      onEnd: (heard, meta = {}) => {
        if (!conversationActiveRef.current) return;
        if (meta.error === 'mic-blocked') {
          setVoiceError('The microphone is blocked. Allow microphone access in the browser, or type the answers.');
          setIsConversationActive(false);
          conversationActiveRef.current = false;
          setPhase(PHASE.IDLE);
          return;
        }
        if (meta.error) {
          practice.rec.heard(logKeyOf(asked), { text: '', engine: meta.engine, reason: meta.error });
          if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
            giveUpOnField(fieldIndex);
            return;
          }
          speak("Sorry, I had trouble hearing that. Please say it again.", () => listenForAnswer(fieldIndex));
          return;
        }
        if (heard) setDraftAnswer(heard);
        handleSpokenAnswer(fieldIndex, heard, meta);
      },
    });
  }, [listenOnce, speak, setDraftAnswer, setVoiceError, setStatusMessage, setPhase, practice]);

  // Save a confirmed answer and go to the next question.
  const acceptAnswer = useCallback((fieldIndex, result) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    if (isAddressPartOf(addressRef.current, fieldIndex)) {
      // One part of the address confirmed: ask the next part, or join the three into the address.
      const address = addressRef.current;
      const part = ADDRESS_PARTS[address.part];
      practice.session.note(practice.rec.accept(part.key, result.value));
      attemptsRef.current[part.key] = 0;
      address.results[part.key] = result;
      clearConfirmView();
      addChatMessage('assistant', `${part.label}: ${result.display || result.value || 'none'}`);
      if (address.part < ADDRESS_PARTS.length - 1) {
        address.part += 1;
        setStatusMessage('Next question...');
        window.setTimeout(() => {
          if (conversationActiveRef.current) askQuestion(fieldIndex);
        }, 150);
        return;
      }
      const joined = joinAddress(address.results);
      homeTownRef.current = address.results.address_town?.value || '';   // for "Were you born in ...?"
      addressRef.current = { active: false, part: 0, results: {} };
      setAddressPart(null);
      result = { ...result, value: joined, display: joined };
    }
    practice.session.note(field.key === 'address'
      ? practice.rec.joined(result.value)
      : practice.rec.accept(field.key, result.value, result.picked ? 'typed' : undefined));   // a tapped place: on screen
    if (field.key === 'place_of_birth') birthRef.current = BIRTH_IDLE;
    attemptsRef.current[fieldIndex] = 0;
    missingRetryRef.current.delete(fieldIndex);
    clearConfirmView();
    saveSpokenAnswer(fieldIndex, result.value || '');
    addChatMessage('assistant', `${field.label}: ${result.display || result.value || 'none'}`);
    setStatusMessage('Next question...');
    moveToNextQuestion();
  }, [saveSpokenAnswer, moveToNextQuestion, askQuestion, clearConfirmView, setStatusMessage, setAddressPart, addChatMessage, practice]);

  // Leave the field blank for now ("Skip for now", or the address after too many tries). Before the
  // final "yes" the applicant is asked for it again (type it or say it again). If speaking
  // fails again on that second round, the text box opens on its own.
  const skipField = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    practice.session.note(practice.rec.skip(logKeyOf(askedOf(addressRef.current, birthRef.current, fieldIndex))));   // before the address resets
    attemptsRef.current[fieldIndex] = 0;
    if (field.key === 'address') {
      addressRef.current = { active: false, part: 0, results: {} };   // asked again from the town question
      setAddressPart(null);
    }
    if (field.key === 'place_of_birth') birthRef.current = BIRTH_IDLE;
    clearConfirmView();
    if (missingRetryRef.current.has(fieldIndex)) {
      missingRetryRef.current.delete(fieldIndex);
      resumeIndexRef.current = null;
      latestRef.current.openMissingTyping(fieldIndex, { auto: true });
      return;
    }
    const msg = `Let's skip your ${spokenLabel(field)} for now. We will come back to it at the end.`;
    addChatMessage('assistant', msg);
    speak(msg, moveToNextQuestion);
  }, [speak, moveToNextQuestion, clearConfirmView, setAddressPart, addChatMessage, practice]);

  // Too many tries (plan 001.8): the answer is typed instead of asked again, so no question loops.
  // The place of birth shows its closest places to tap. The address (asked in 3 parts) and a question
  // asked again from the missing-answers step keep their way out (skip, then the text box).
  const giveUpOnField = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    if (field.key === 'place_of_birth') {
      latestRef.current.showBirthChoices(fieldIndex);
      return;
    }
    if (field.key === 'address' || missingRetryRef.current.has(fieldIndex)) {
      skipField(fieldIndex);
      return;
    }
    attemptsRef.current[fieldIndex] = 0;
    confirmTurnRef.current += 1;
    pendingConfirmRef.current = { fieldIndex, result: null };
    setConfirmView({ mode: 'typing', label: field.label, value: '', letters: '', canSpell: true, hint: field.hint });
    setPhase(PHASE.CONFIRMING);
    setStatusMessage(`Type your ${spokenLabel(field)} in the box, or skip it for now.`);
    const msg = `Let's type your ${spokenLabel(field)} instead. Please type it in the box on the screen.`;
    addChatMessage('assistant', msg);
    speak(msg);   // no listening: the applicant is typing
  }, [speak, skipField, setConfirmView, setPhase, setStatusMessage, addChatMessage]);

  // The place of birth after 2 misses (plan 001.8): its closest list entries to tap, or type it.
  // `typed`: a typed place that is not in the list, offered "as typed" next to the list entries.
  const showBirthChoices = useCallback(async (fieldIndex, suggestions = [], { typed = '', message = '' } = {}) => {
    confirmTurnRef.current += 1;
    const turn = confirmTurnRef.current;
    pendingConfirmRef.current = { fieldIndex, result: null };
    const birth = birthRef.current;
    let choices = suggestions.length ? suggestions : birth.suggestions || [];
    if (!choices.length && !message) {
      // Nothing usable heard: the likeliest places (the home province and its region, or the province's towns).
      const inProvince = birth.step === 'town' && birth.province;
      let fallback = null;
      try {
        fallback = await interpretAnswer(inProvince ? 'place_of_birth_town' : 'place_of_birth_province', '', {
          spoken: true, province: inProvince ? birth.province.code : null,
        });
      } catch {
        return;   // session expired: the API client sends the user to the login page
      }
      if (!conversationActiveRef.current || turn !== confirmTurnRef.current) return;
      choices = fallback?.suggestions || [];
    }
    choices = choices.slice(0, 3);
    setConfirmView({ mode: 'choose', label: 'Place of birth', value: '', letters: '', canSpell: true, choices, typed });
    let prompt = message || 'Please type your place of birth on the screen.';
    if (!message && typed) prompt = `${typed} is not in the list of places. Please tap the right place, or use it as typed.`;
    else if (!message && choices.length) prompt = 'Please tap your place of birth on the screen, or type it.';
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Tap your place of birth, or type it.');
    addChatMessage('assistant', prompt);
    speak(prompt);   // no listening: the applicant taps or types
  }, [speak, setConfirmView, setPhase, setStatusMessage, addChatMessage]);

  // "Go back", "go back to my address", "change my surname": ask that question again,
  // then continue where the interview was. Returns true when the reply was such a request.
  const handleNavigation = useCallback((reply, fromIndex) => {
    const nav = parseNavigation(reply);
    if (!nav) return false;
    if (nav.type === 'back' && isAddressPartOf(addressRef.current, fromIndex) && addressRef.current.part > 0) {
      // "Go back" at the barangay or purok question: the address part before it.
      addressRef.current.part -= 1;
      askQuestion(fromIndex);
      return true;
    }
    addressRef.current = { active: false, part: 0, results: {} };   // an address asked again starts at the town
    birthRef.current = BIRTH_IDLE;                                    // so does a place of birth
    let target = nav.type === 'goto' ? nav.index : fromIndex - 1;
    if (nav.type === 'back' && INTERVIEW_FIELDS[target]?.key === 'icr_no' && isFilipino(answersRef.current)) target -= 1;
    if (target < 0) {
      speak('This is the first question.', () => askQuestion(fromIndex));
      return true;
    }
    if (target < fromIndex) {
      resumeIndexRef.current = Math.max(resumeIndexRef.current ?? fromIndex, fromIndex);
    } else {
      resumeIndexRef.current = null;          // jumping ahead: just continue from there
    }
    attemptsRef.current[target] = 0;
    spelledRef.current = '';
    askQuestion(target);
    return true;
  }, [speak, askQuestion]);

  // ── Every answer is confirmed before it is saved ──
  // Speech recognition will sometimes get an answer wrong (uncommon local names
  // especially: "Bacus" heard as "Bakus"). The answer and its spelling are SHOWN on
  // screen (letter by letter for names); the assistant only says "Bacus. Is that
  // correct?", which is much faster than reading the letters aloud. The applicant
  // answers by voice or with the Yes / No buttons.
  const confirmAnswer = useCallback((fieldIndex, result) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const shown = result.display || result.value;
    confirmTurnRef.current += 1;
    pendingConfirmRef.current = { fieldIndex, result };
    // The place of birth in steps is read back as "Town, Province" in large text; a "no" asks the step again.
    const birthSteps = isBirthStepOf(birthRef.current, fieldIndex);
    setConfirmView({
      mode: 'confirm',
      label: askedOf(addressRef.current, birthRef.current, fieldIndex).label,
      value: shown,
      // Letter tiles only where spelling matters (names), not for dates, numbers or a place from the list.
      letters: SPELLABLE_KEYS.has(field.key) && !birthSteps ? String(result.value || '') : '',
      canSpell: SPELLABLE_KEYS.has(field.key) && !birthSteps,
      note: result.warnings?.[0] || '',
    });
    const prompt = result.needs_confirmation && result.message
      ? result.message   // e.g. "I heard Nails. Is that the place where you were born?"
      : `${shown}. Is that correct?`;
    setDraftAnswer(result.value || '');
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Say yes if it is correct, or no to fix it.');
    addChatMessage('assistant', prompt);
    speak(prompt, () => listenForConfirmation(fieldIndex, result));
  }, [speak, setDraftAnswer, setPhase, setStatusMessage, addChatMessage, setConfirmView]);

  // The answer was wrong: spell it (names, places) or ask again (dates, numbers, choices).
  const fixAnswer = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    if (isBirthStepOf(birthRef.current, fieldIndex)) {
      // "No" to the shortcut asks the province; to a place, the same step again, then the places to tap.
      const { birth, action } = onBirthNo(birthRef.current);
      birthRef.current = birth;
      if (action === 'choose') showBirthChoices(fieldIndex);
      else askQuestion(fieldIndex);
      return;
    }
    if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
      giveUpOnField(fieldIndex);
      return;
    }
    if (SPELLABLE_KEYS.has(field.key)) {
      startSpelling(fieldIndex);
      return;
    }
    clearConfirmView();
    const msg = `Okay. Please say your ${askedOf(addressRef.current, birthRef.current, fieldIndex).label.toLowerCase().replace(/\s*\(.*\)/, '')} again.`;
    addChatMessage('assistant', msg);
    speak(msg, () => listenForAnswer(fieldIndex));
  }, [speak, giveUpOnField, showBirthChoices, askQuestion, clearConfirmView, addChatMessage]);

  const listenForConfirmation = useCallback((fieldIndex, result, silentTries = 0) => {
    const turn = confirmTurnRef.current;
    listenOnce({
      fieldKey: 'confirm',             // Whisper hint: yes / no / opo / hindi (fast "tiny" model)
      vad: { noSpeechMs: 5000, silenceMs: 600 },   // yes/no is short: end the turn sooner
      onStart: () => {
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening for yes or no...');
      },
      onError: () => {},
      onEnd: (heard, meta = {}) => {
        if (!conversationActiveRef.current || turn !== confirmTurnRef.current) return;
        const reply = heard.trim();
        // The shortcut ("Were you born in Baungon, Bukidnon?") is the place-of-birth answer itself: a try.
        const noteShortcut = (parsed, partial) => {
          if (!result.birthShortcut) return;
          practice.rec.heard('place_of_birth', { text: reply, engine: meta.engine || engineRef.current, seconds: meta.seconds });
          practice.rec.parsed('place_of_birth', parsed, { partial });
        };
        if (!reply) {
          if (result.birthShortcut) {
            noteShortcut({ ok: false, value: '' }, true);
            fixAnswer(fieldIndex);   // no reply to the shortcut: ask the province
            return;
          }
          if (silentTries >= 1) {
            // Still no reply: keep the answer; it stays on screen and is checked again at the review.
            spelledRef.current = '';
            acceptAnswer(fieldIndex, result);
            return;
          }
          speak('Please say yes or no.', () => listenForConfirmation(fieldIndex, result, silentTries + 1));
          return;
        }
        addChatMessage('user', reply);
        // A clear yes wins over navigation words heard in the same reply ("Yes. Go back."); only a
        // reply that is just "go back" / "change my address" moves (plan 001.6).
        if (isYesAnswer(reply)) {
          noteShortcut(result, false);
          spelledRef.current = '';
          acceptAnswer(fieldIndex, result);
          return;
        }
        if (handleNavigation(reply, fieldIndex)) return;
        if (result.birthShortcut) {
          if (isNoAnswer(reply) || /^(no|hindi|mali)\b/i.test(normalizeReply(reply))) {
            noteShortcut({ ok: false, value: '' }, true);
            fixAnswer(fieldIndex);
          } else {
            // Not yes or no: taken as the answer to the province question ("Malaybalay, Bukidnon").
            birthRef.current = { ...birthRef.current, step: 'province' };
            handleSpokenAnswer(fieldIndex, reply, { shown: true, engine: meta.engine, seconds: meta.seconds });
          }
          return;
        }
        const spellable = SPELLABLE_KEYS.has(INTERVIEW_FIELDS[fieldIndex].key) && !isBirthStepOf(birthRef.current, fieldIndex);
        if (spellable && looksSpelled(reply)) {
          // Letters instead of yes/no: they are spelling it (or adding to their spelling).
          spelledRef.current = combineSpelling(spelledRef.current, reply);
          finishSpelling(fieldIndex);
        } else if (isNoAnswer(reply) || /^(no|hindi|mali)\b/i.test(normalizeReply(reply))) {
          spelledRef.current = '';
          fixAnswer(fieldIndex);
        } else {
          // They simply said the right answer. A try like any other (plan 001.8): at the limit it is typed.
          spelledRef.current = '';
          if (isBirthStepOf(birthRef.current, fieldIndex)) {
            const { birth, action } = onBirthNo(birthRef.current);
            birthRef.current = birth;
            if (action === 'choose') { showBirthChoices(fieldIndex); return; }
          } else if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
            giveUpOnField(fieldIndex);
            return;
          }
          handleSpokenAnswer(fieldIndex, reply, { shown: true, engine: meta.engine, seconds: meta.seconds });
        }
      },
    });
  }, [listenOnce, speak, acceptAnswer, fixAnswer, giveUpOnField, showBirthChoices, setPhase, setStatusMessage, addChatMessage, practice]);

  // ── Letter-by-letter spelling (the fallback) ──
  // One turn: the applicant spells, and as soon as they pause the assistant reads the
  // letters back for a yes. Exactly what was spelled is kept.
  const spelledRef = useRef('');

  const startSpelling = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    spelledRef.current = '';
    confirmTurnRef.current += 1;
    pendingConfirmRef.current = { fieldIndex, result: null };
    setConfirmView({ mode: 'spelling', label: field.label, value: '', letters: '', canSpell: true });
    const prompt = `Please spell your ${field.label.toLowerCase().replace(/\s*\(.*\)/, '')}.`;
    setPhase(PHASE.ASKING);
    setStatusMessage('Spell it letter by letter, or type it.');
    setDraftAnswer('');
    addChatMessage('assistant', prompt);
    speak(prompt, () => listenForLetters(fieldIndex));
  }, [speak, setDraftAnswer, setPhase, setStatusMessage, addChatMessage, setConfirmView]);

  const listenForLetters = useCallback((fieldIndex, silentTries = 0) => {
    const turn = confirmTurnRef.current;
    listenOnce({
      fieldKey: 'spelling',            // Whisper hint: letters spelled one by one
      vad: { silenceMs: 2000, noSpeechMs: 7000, maxMs: 25000 },   // people pause between letters
      onStart: () => {
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening for the letters...');
      },
      onError: () => {},
      onEnd: (heard) => {
        if (!conversationActiveRef.current || turn !== confirmTurnRef.current) return;
        const reply = heard.trim();
        if (!reply) {
          if (silentTries >= 1) {
            giveUpOnField(fieldIndex);
            return;
          }
          speak('Please spell it letter by letter, for example: C, R, U, Z.', () => listenForLetters(fieldIndex, silentTries + 1));
          return;
        }
        addChatMessage('user', reply);
        spelledRef.current = combineSpelling(spelledRef.current, reply);
        setDraftAnswer(spelledRef.current.toUpperCase());
        finishSpelling(fieldIndex);
      },
    });
  }, [listenOnce, speak, giveUpOnField, setDraftAnswer, setPhase, setStatusMessage, addChatMessage]);

  // `typed`: the applicant (or staff) typed the correction on screen, so it is saved
  // without another "is that correct?".
  const finishSpelling = useCallback(async (fieldIndex, { typed = '' } = {}) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const letters = (typed || spelledRef.current).trim();
    if (!letters) {
      startSpelling(fieldIndex);
      return;
    }
    // Typed text keeps its own capitals ("McArthur") unless it was all one case.
    const spelledValue = typed && typed !== typed.toLowerCase() && typed !== typed.toUpperCase()
      ? letters
      : titleCaseSpelled(letters.toLowerCase());
    // Only a basic check (e.g. a name cannot have digits); the spelled value itself is
    // kept exactly as spelled, never "corrected" by the system.
    let result;
    try {
      result = await interpretAnswer(field.key, spelledValue);
    } catch {
      return;
    }
    if (!conversationActiveRef.current) return;
    practice.rec.heard(field.key, { text: letters, engine: typed ? 'typed' : 'spelled' });
    practice.rec.parsed(field.key, result);
    if (!result.ok && result.reason !== 'unclear') {
      if (typed) {
        // Typed in the box: say why and keep the box open (a date or number is not spelled).
        setConfirmView((view) => (view ? { ...view, error: result.message } : view));
        speak(result.message);
        return;
      }
      if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) { giveUpOnField(fieldIndex); return; }   // every try counts
      const msg = `${result.message} Let's spell it again.`;
      addChatMessage('assistant', msg);
      speak(msg, () => startSpelling(fieldIndex));
      return;
    }
    // Names keep exactly what was spelled or typed. A date, number or choice takes its checked form
    // ("may 10 1990" -> "May 10, 1990"); a place of birth found in the list is written the list's way.
    let value = spelledValue;
    let display = value;
    const checked = !result.methods?.includes('local');   // the backend's list, not the offline check
    if (!SPELLABLE_KEYS.has(field.key)) {
      value = result.value ?? spelledValue;
      display = result.display || value;
    } else if (field.key === 'place_of_birth' && result.ok && checked && !result.warnings?.length) {
      value = result.value || spelledValue;
      display = value;
    } else if (field.key === 'place_of_birth' && typed && result.suggestions?.length) {
      // Typed, not in the list: the closest list entries to tap, or keep it as typed (clearly marked).
      showBirthChoices(fieldIndex, result.suggestions, { typed: spelledValue });
      return;
    } else if (field.key === 'place_of_birth' && typed) {
      display = `${value} (typed${checked ? ', not in the list' : ', not checked'})`;
    }
    const kept = { ...result, ok: true, value, display, needs_confirmation: false };
    if (typed) {
      addChatMessage('user', spelledValue);
      acceptAnswer(fieldIndex, kept);
      return;
    }
    confirmAnswer(fieldIndex, kept);
  }, [speak, confirmAnswer, acceptAnswer, giveUpOnField, showBirthChoices, setConfirmView, addChatMessage, practice]);

  // The Yes / No buttons and the type-it box on the confirmation panel. A tap ends the
  // voice turn in progress (speech and listening), then continues like a spoken reply.
  const tapConfirm = useCallback((choice, typedValue = '') => {
    const pending = pendingConfirmRef.current;
    if (!pending || !conversationActiveRef.current) return;
    confirmTurnRef.current += 1;
    cancelSpeech();
    stopBrowserListening();
    const { fieldIndex, result } = pending;
    if (choice === 'yes' && result) {
      spelledRef.current = '';
      acceptAnswer(fieldIndex, result);
    } else if (choice === 'no') {
      spelledRef.current = '';
      fixAnswer(fieldIndex);
    } else if (choice === 'typed' && typedValue.trim()) {
      spelledRef.current = '';
      finishSpelling(fieldIndex, { typed: typedValue.trim() });
    } else if (choice === 'pick') {
      // A place of birth tapped on the choices screen (always a list entry).
      const pick = onBirthPick(birthRef.current, typedValue);
      birthRef.current = pick.birth;
      if (pick.action === 'town') askQuestion(fieldIndex);
      else if (pick.action === 'accept') {
        practice.rec.heard('place_of_birth', { text: pick.result.value, engine: 'typed' });
        practice.rec.parsed('place_of_birth', pick.result);
        acceptAnswer(fieldIndex, pick.result);
      }
    } else if (choice === 'keep' && typedValue.trim()) {
      // A typed place that is not in the list, kept as typed on purpose.
      const value = typedValue.trim();
      addChatMessage('user', value);
      acceptAnswer(fieldIndex, {
        ok: true, value, display: `${value} (typed, not in the list)`, warnings: ['Typed place of birth, not in the list.'],
      });
    } else if (choice === 'spell') {
      spelledRef.current = '';
      startSpelling(fieldIndex);
    } else if (choice === 'skip') {
      spelledRef.current = '';
      skipField(fieldIndex);
    }
  }, [cancelSpeech, stopBrowserListening, acceptAnswer, fixAnswer, finishSpelling, askQuestion, startSpelling, skipField, addChatMessage, practice]);

  // One place-of-birth step answered (plan 001.8): a province asks its town, a whole place is read back,
  // a miss is asked again once with an example, the second miss shows the closest places to tap.
  const handleBirthResult = useCallback((fieldIndex, result) => {
    if (result.reason === 'offline') {
      // The answer check is down: a spoken place is never taken by the local check; it is typed.
      practice.rec.parsed('place_of_birth', result, { partial: true });
      showBirthChoices(fieldIndex, [], { message: result.message });
      return;
    }
    if (result.reason === 'unclear') {   // "What?" / "Pakiulit": the question again, not a miss
      practice.rec.parsed('place_of_birth', result, { partial: true });
      speak(result.message, () => askQuestion(fieldIndex));
      return;
    }
    const { birth, action } = onBirthResult(birthRef.current, result);
    birthRef.current = { ...birth, suggestions: result.suggestions?.length ? result.suggestions : birth.suggestions };
    practice.rec.parsed('place_of_birth', result, { partial: action !== 'confirm' });
    if (action === 'town') {
      addChatMessage('assistant', `Province: ${result.value}`);
      askQuestion(fieldIndex);
    } else if (action === 'confirm') {
      confirmAnswer(fieldIndex, result);
    } else if (action === 'choose') {
      showBirthChoices(fieldIndex, result.suggestions || []);
    } else {
      setPhase(PHASE.RETRY);
      setStatusMessage(result.message);
      addChatMessage('assistant', result.message);
      speak(result.message, () => listenForAnswer(fieldIndex));
    }
  }, [speak, askQuestion, confirmAnswer, showBirthChoices, listenForAnswer, setPhase, setStatusMessage, addChatMessage, practice]);

  const handleSpokenAnswer = useCallback(async (fieldIndex, transcript, heardBy = {}) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const asked = askedOf(addressRef.current, birthRef.current, fieldIndex);   // the field, or the address part being asked
    const spokenValue = transcript.trim();
    // Practice log: one try = what was heard, by which engine, and the Whisper seconds.
    const recordHeard = () => practice.rec.heard(logKeyOf(asked), {
      text: spokenValue,
      engine: heardBy.engine || engineRef.current,
      seconds: heardBy.seconds,
      reason: spokenValue ? null : (heardBy.reason || 'no-speech'),
    });

    if (!spokenValue && !asked.optional) {
      recordHeard();
      if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
        giveUpOnField(fieldIndex);
        return;
      }
      setPhase(PHASE.RETRY);
      setStatusMessage("I didn't hear an answer. Asking again...");
      speak(pickRandom(RETRY_PHRASES), () => askQuestion(fieldIndex));
      return;
    }

    if (spokenValue && !heardBy.shown) addChatMessage('user', spokenValue);
    if (spokenValue && handleNavigation(spokenValue, fieldIndex)) return;   // "go back to my surname"
    recordHeard();
    setPhase(PHASE.THINKING);
    setStatusMessage('Understanding your answer...');

    let result;
    try {
      result = await interpretAnswer(asked.key, spokenValue, {
        spoken: true,
        town: asked.key === 'address_barangay' ? addressTownOf(addressRef.current) : null,
        province: asked.key === 'place_of_birth_town' ? birthRef.current.province?.code : null,
      });
    } catch {
      return; // session expired: the API client sends the user to the login page
    }
    if (!conversationActiveRef.current) return;
    if (isBirthStepOf(birthRef.current, fieldIndex)) {
      handleBirthResult(fieldIndex, result);
      return;
    }
    practice.rec.parsed(asked.key, result);

    if (!result.ok && result.reason === 'not_a_name' && SPELLABLE_KEYS.has(field.key)) {
      // "It's." / "Or these." is not a name: the name was not heard, so spell it.
      if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) { giveUpOnField(fieldIndex); return; }
      startSpelling(fieldIndex);
      return;
    }
    if (!result.ok) {
      if (result.reason !== 'unclear' && countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
        giveUpOnField(fieldIndex);
        return;
      }
      setPhase(PHASE.RETRY);
      setStatusMessage(result.message);
      addChatMessage('assistant', result.message);
      // "What?" / "Pakiulit" -> repeat the whole question; otherwise say what is needed and listen again.
      if (result.reason === 'unclear') speak(result.message, () => askQuestion(fieldIndex));
      else speak(result.message, () => listenForAnswer(fieldIndex));
      return;
    }

    // "None" for an optional question (no middle name, no ICR, no purok) needs no confirmation.
    if (!result.value && asked.optional) {
      acceptAnswer(fieldIndex, result);
      return;
    }
    confirmAnswer(fieldIndex, result);
  }, [speak, askQuestion, acceptAnswer, confirmAnswer, giveUpOnField, handleBirthResult, setStatusMessage, setPhase, addChatMessage, practice]);

  // Get the microphone and switch the conversation on. Returns false when voice cannot run.
  const activateVoice = useCallback(async () => {
    if (isWhisperCaptureSupported()) {
      try {
        await whisper.prepare();   // ask for the microphone once, before the greeting
        engineRef.current = 'whisper';
        whisperFailuresRef.current = 0;
      } catch {
        setVoiceError('The microphone is blocked. Allow microphone access for this site (the lock icon in the address bar), or type the answers.');
        toast.error('Microphone access is needed for the voice interview.');
        return false;
      }
    } else if (isSpeechSupported()) {
      engineRef.current = 'browser';
    } else {
      setVoiceError('This browser cannot record audio. Please use Chrome or Edge, or type the answers.');
      toast.error('Voice conversation is not supported in this browser.');
      return false;
    }
    setVoiceError('');
    setIsConversationActive(true);
    conversationActiveRef.current = true;
    return true;
  }, [whisper, setVoiceError]);

  const startConversation = useCallback(async () => {
    if (!(await activateVoice())) return;

    const startIndex = currentFieldIndexRef.current;
    const alreadyAnswered = Object.values(answersRef.current).some((v) => String(v || '').trim());
    const greeting = getConversationGreeting();
    // While the greeting plays, prepare every fixed question so each plays without waiting.
    // Also the read-backs that can be known in advance (the choice answers) and the
    // spelling prompts, so "Female. Is that correct?" plays at once instead of after ~1 s.
    const knownReadBacks = ['Male', 'Female', 'Single', 'Married', 'Widowed', 'Separated', 'Filipino']
      .map((v) => `${v}. Is that correct?`);
    const spellPrompts = INTERVIEW_FIELDS.filter((f) => SPELLABLE_KEYS.has(f.key))
      .map((f) => `Please spell your ${f.label.toLowerCase().replace(/\s*\(.*\)/, '')}.`);
    window.setTimeout(() => prefetchSpeech(...INTERVIEW_FIELDS.map((f) => f.question), ...ADDRESS_PARTS.map((p) => p.question),
      BIRTH_PROVINCE_STEP.question, REVIEW_PROMPT), 300);
    window.setTimeout(() => prefetchSpeech(...knownReadBacks, ...spellPrompts, 'Please say yes or no.'), 2500);

    if (!alreadyAnswered && startIndex === 0) {
      setPhase(PHASE.GREETING);
      setStatusMessage('Greeting applicant...');
      addChatMessage('assistant', greeting);
      speak(greeting, () => askQuestion(0));
    } else {
      const field = INTERVIEW_FIELDS[startIndex];
      const resumeMsg = alreadyAnswered
        ? `Welcome back. Let's continue with your ${field.label.toLowerCase()}.`
        : greeting;
      setPhase(PHASE.GREETING);
      addChatMessage('assistant', resumeMsg);
      speak(resumeMsg, () => askQuestion(startIndex));
    }
  }, [activateVoice, speak, askQuestion, setStatusMessage, setPhase, addChatMessage]);

  // ── Missing answers, before the final "yes" (plan 001.3) ──
  // Each required question still blank is offered again, in interview order:
  // "I still need your address. Would you like to type it or say it again?"
  const askMissingField = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    missingTurnRef.current += 1;
    pendingMissingRef.current = fieldIndex;
    clearConfirmView();
    setStep('voice-review');
    setAwaitingConfirmation(false);
    setCurrentFieldIndex(fieldIndex);
    setMissingView({ key: field.key, label: field.label, hint: field.hint, mode: 'choice', allowSay: true, error: '', checking: false });
    setPhase(PHASE.CONFIRMING);
    setStatusMessage(`Still needed: ${field.label}. Type it or say it again.`);
    const prompt = `I still need your ${spokenLabel(field)}. Would you like to type it or say it again?`;
    addChatMessage('assistant', prompt);
    speak(prompt, () => latestRef.current.listenForMissingChoice(fieldIndex));
  }, [speak, clearConfirmView, setStep, setAwaitingConfirmation, setCurrentFieldIndex, setMissingView, setPhase, setStatusMessage, addChatMessage]);

  // The text box for one field. `auto`: speaking failed again, so it opened on its own
  // and "Say it again" is no longer offered (no endless loop).
  const openMissingTyping = useCallback((fieldIndex, { auto = false } = {}) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    practice.rec.asked(field.key);   // practice log: typing a missing answer is timed from here
    missingTurnRef.current += 1;
    pendingMissingRef.current = fieldIndex;
    clearConfirmView();
    stopBrowserListening();
    setStep('voice-review');
    setAwaitingConfirmation(false);
    setCurrentFieldIndex(fieldIndex);
    setMissingView({ key: field.key, label: field.label, hint: field.hint, mode: 'typing', allowSay: !auto, error: '', checking: false });
    setPhase(PHASE.CONFIRMING);
    setStatusMessage(`Type your ${spokenLabel(field)} in the box.`);
    const msg = auto
      ? `Let's type your ${spokenLabel(field)} instead. Please type it in the box on the screen.`
      : `Okay. Please type your ${spokenLabel(field)} in the box on the screen.`;
    addChatMessage('assistant', msg);
    speak(msg);   // no listening: the applicant is typing
  }, [speak, clearConfirmView, stopBrowserListening, setStep, setAwaitingConfirmation, setCurrentFieldIndex, setMissingView, setPhase, setStatusMessage, addChatMessage, practice]);

  // "Say it again": the normal question with its normal retries, then back to the review.
  const sayMissingAgain = useCallback((fieldIndex) => {
    missingTurnRef.current += 1;
    pendingMissingRef.current = null;
    setMissingView(null);
    missingRetryRef.current.add(fieldIndex);
    attemptsRef.current[fieldIndex] = 0;
    spelledRef.current = '';
    resumeIndexRef.current = INTERVIEW_FIELDS.length;   // after this answer, go straight to the review
    setStep('interview');
    askQuestion(fieldIndex);
  }, [setMissingView, setStep, askQuestion]);

  const listenForMissingChoice = useCallback((fieldIndex, tries = 0) => {
    if (!conversationActiveRef.current) return;
    const turn = missingTurnRef.current;
    listenOnce({
      fieldKey: 'missing_choice',
      vad: { noSpeechMs: 6000, silenceMs: 700 },
      onStart: () => {
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening: say "type" or "say it again"...');
      },
      onError: () => {},
      onEnd: (heard) => {
        if (!conversationActiveRef.current || turn !== missingTurnRef.current) return;
        const reply = heard.trim();
        if (reply) addChatMessage('user', reply);
        const choice = parseMissingChoice(reply);
        if (choice === 'type') openMissingTyping(fieldIndex);
        else if (choice === 'say') sayMissingAgain(fieldIndex);
        else if (tries >= 1) openMissingTyping(fieldIndex, { auto: true });   // speech is not getting through
        else {
          const msg = 'Please say type, or say it again. You can also tap a button on the screen.';
          addChatMessage('assistant', msg);
          speak(msg, () => listenForMissingChoice(fieldIndex, tries + 1));
        }
      },
    });
  }, [listenOnce, speak, openMissingTyping, sayMissingAgain, setPhase, setStatusMessage, addChatMessage]);

  // A typed answer is checked by the same /api/extraction rules as a spoken one.
  const submitMissingTyped = useCallback(async (fieldIndex, text) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const typed = String(text || '').trim();
    if (!typed) return;
    const turn = missingTurnRef.current;
    setMissingView((view) => (view ? { ...view, checking: true, error: '' } : view));
    let result;
    try {
      result = await interpretAnswer(field.key, typed);
    } catch {
      return;   // session expired: the API client sends the user to the login page
    }
    if (!conversationActiveRef.current || turn !== missingTurnRef.current) return;
    if (!result.ok || isBlank(result.value)) {
      const msg = result.message || `Please type your ${spokenLabel(field)}.`;
      setMissingView((view) => (view ? { ...view, checking: false, error: msg } : view));
      speak(msg);
      return;
    }
    // Names and places keep exactly what was typed (as with spelling); dates, numbers and
    // choices take the checked form ("female" -> "Female").
    const value = SPELLABLE_KEYS.has(field.key)
      ? (typed !== typed.toLowerCase() && typed !== typed.toUpperCase() ? typed : titleCaseSpelled(typed.toLowerCase()))
      : result.value;
    addChatMessage('user', typed);
    addChatMessage('assistant', `${field.label}: ${SPELLABLE_KEYS.has(field.key) ? value : (result.display || value)}`);
    practice.rec.heard(field.key, { text: typed, engine: 'typed' });
    practice.rec.parsed(field.key, result);
    practice.session.note(practice.rec.accept(field.key, value, 'typed'));
    saveSpokenAnswer(fieldIndex, value);
    attemptsRef.current[fieldIndex] = 0;
    missingRetryRef.current.delete(fieldIndex);
    pendingMissingRef.current = null;
    setMissingView(null);
    latestRef.current.startVoiceReview();
  }, [speak, saveSpokenAnswer, setMissingView, addChatMessage, practice]);

  // The Type it / Say it again buttons and the text box. A tap ends the voice turn in progress.
  const tapMissing = useCallback((choice, typedValue = '') => {
    const fieldIndex = pendingMissingRef.current;
    if (fieldIndex === null || !conversationActiveRef.current) return;
    if (choice === 'typed') {
      submitMissingTyped(fieldIndex, typedValue);
      return;
    }
    missingTurnRef.current += 1;
    cancelSpeech();
    stopBrowserListening();
    if (choice === 'type') openMissingTyping(fieldIndex);
    else if (choice === 'say') sayMissingAgain(fieldIndex);
  }, [cancelSpeech, stopBrowserListening, openMissingTyping, sayMissingAgain, submitMissingTyped]);

  // The details are shown on screen instead of being read aloud (the old read-back of
  // all 14 fields took about 53 seconds). Missing answers are asked for first; "say yes"
  // is offered only when nothing required is blank.
  const startVoiceReview = useCallback(async () => {
    // The "Voice Review" button on the manual review page: switch the microphone on first,
    // or nothing would be listening for the "yes".
    if (!conversationActiveRef.current && !(await activateVoice())) return;
    const missing = missingRequiredIndexes(answersRef.current);
    if (missing.length) {
      askMissingField(missing[0]);
      return;
    }
    missingTurnRef.current += 1;
    pendingMissingRef.current = null;
    setMissingView(null);
    setStep('voice-review');
    setAwaitingConfirmation(true);
    setCurrentFieldIndex(0);
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Please check the details on the screen.');
    addChatMessage('assistant', REVIEW_PROMPT);
    speak(REVIEW_PROMPT, () => listenForReviewCorrections());
  }, [activateVoice, askMissingField, speak, setMissingView, setStep, setAwaitingConfirmation, setCurrentFieldIndex, setStatusMessage, setPhase, addChatMessage]);

  // "Yes": check first ("Checking your details."); issueForm says "Saving your application"
  // only once every check has passed. The microphone stays on until the outcome is known.
  const issueNow = useCallback(async () => {
    if (missingRequiredIndexes(answersRef.current).length) {
      startVoiceReview();
      return;
    }
    setAwaitingConfirmation(false);
    setPhase(PHASE.THINKING);
    setStatusMessage('Checking your details…');
    addChatMessage('assistant', 'Checking your details…');
    speak(CHECKING_LINE);
    const outcome = await issueFormRef.current({
      say: (text, onEnd) => {
        if (text === SAVING_LINE) addChatMessage('assistant', SAVING_LINE);
        speak(text, onEnd);
      },
    });
    if (outcome === 'missing') {
      // A required answer is blank after all: ask for it, with the microphone still on.
      if (conversationActiveRef.current) startVoiceReview();
      return;
    }
    // 'issued' (survey and counter line next), 'review' (moved to the manual review page,
    // which was said aloud) or 'auth' (login expired): the conversation is over.
    endConversation();
  }, [speak, endConversation, startVoiceReview, setAwaitingConfirmation, setStatusMessage, setPhase, addChatMessage]);

  const listenForReviewCorrections = useCallback(() => {
    if (!conversationActiveRef.current) return;

    listenOnce({
      fieldKey: 'review',   // Whisper hint
      onStart: () => {
        setVoiceError('');
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening for corrections or approval...');
      },
      onError: (error) => {
        if (error === 'no-speech') {
          speak("I didn't hear anything. Say yes if everything is correct, or say what needs to be changed.", () =>
            listenForReviewCorrections()
          );
        }
      },
      onEnd: async (heard) => {
        if (!conversationActiveRef.current) return;
        setPhase(PHASE.THINKING);
        const trimmed = heard.trim();

        if (!trimmed) {
          speak("I didn't hear anything. Say yes if everything is correct, or say what needs to be changed.", () =>
            listenForReviewCorrections()
          );
          return;
        }

        if (isYesAnswer(trimmed)) {
          addChatMessage('user', trimmed);
          issueNow();   // asks for any missing answer first instead of saving
          return;
        }

        // "Go back to my address": ask that question again, then come back to this review.
        const nav = parseNavigation(trimmed);
        if (nav) {
          const target = nav.type === 'goto' ? nav.index : INTERVIEW_FIELDS.length - 1;
          addChatMessage('user', trimmed);
          setStep('interview');
          resumeIndexRef.current = INTERVIEW_FIELDS.length;
          askQuestion(target);
          return;
        }

        const corrections = parseVoiceCorrections(trimmed);
        if (!corrections.length) {
          const msg = isNoAnswer(trimmed)
            ? 'Okay. Tell me what to change, for example: change surname to Cruz.'
            : "I didn't understand the correction. Please say it like this: change surname to Cruz.";
          speak(msg, () => listenForReviewCorrections());
          return;
        }

        // Check each corrected value the same way as during the interview.
        let checked;
        try {
          checked = await Promise.all(corrections.map(async (c) => ({ ...c, result: await interpretAnswer(c.key, c.value) })));
        } catch {
          return;
        }
        if (!conversationActiveRef.current) return;
        const accepted = checked.filter((c) => c.result.ok);
        const rejected = checked.filter((c) => !c.result.ok);

        if (accepted.length) {
          setAnswers((prev) => {
            const next = { ...prev };
            accepted.forEach((c) => { next[c.key] = c.result.value || ''; });
            answersRef.current = next;
            return next;
          });
        }

        const readable = accepted.map((c) => `${c.label} to ${c.result.display || c.result.value || 'none'}`).join(', ');
        const problems = rejected.map((c) => `For ${c.label.toLowerCase()}: ${c.result.message}`).join(' ');
        setStatusMessage(`Updated ${accepted.length} field${accepted.length === 1 ? '' : 's'}.`);
        if (readable) addChatMessage('assistant', `Updated: ${readable}`);
        if (problems) {
          addChatMessage('assistant', problems);
          speak(`${readable ? `I updated ${readable}. ` : ''}${problems} Please say the correction again.`, () =>
            listenForReviewCorrections()
          );
          return;
        }
        if (missingRequiredIndexes(answersRef.current).length) {
          // e.g. "change occupation to none" blanked a required answer: ask for it first.
          speak(`I updated ${readable}.`, () => latestRef.current.startVoiceReview());
          return;
        }
        speak(`I updated ${readable}. Is everything correct now? Say yes to issue your Cedula.`, () =>
          listenForReviewCorrections()
        );
      },
    });
  }, [listenOnce, speak, issueNow, setAnswers, setStatusMessage, setPhase, addChatMessage]);

  latestRef.current = { startVoiceReview, openMissingTyping, listenForMissingChoice, confirmAnswer, showBirthChoices };

  return {
    isConversationActive,
    isSpeaking,
    isListening,
    startConversation,
    stopConversation,
    startVoiceReview,
    tapConfirm,
    tapMissing,
  };
}


// ═══════════════════════════════════════════════════════════════
// SECTION 8: Animated Sub-Components (inside same file)
// ═══════════════════════════════════════════════════════════════

/** Full-screen "please wait" while the answers are checked and the application is saved. */
const IssuingOverlay = ({ message }) => createPortal(
  <div
    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    role="alertdialog"
    aria-modal="true"
    aria-live="assertive"
    aria-label="Saving the application"
  >
    <div className="w-full max-w-sm rounded-[var(--radius-xl)] bg-white p-8 text-center shadow-[var(--shadow-lg)]">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
      <h2 className="text-xl font-bold text-[var(--color-neutral-900)]">Please wait</h2>
      <p className="mt-2 text-sm text-[var(--color-neutral-600)] break-words">{message || 'Checking your details…'}</p>
      <p className="mt-4 text-xs text-[var(--color-neutral-500)]">Please don't close this page.</p>
    </div>
  </div>,
  document.body,
);

/**
 * A required answer that is still blank (skipped during the interview), asked for again
 * before the final "yes": Type it / Say it again, then a text box for that field only.
 * The buttons work like saying "type" or "say it again", even if that word was misheard.
 */
const MissingFieldPanel = ({ view, onType, onSay, onTyped }) => {
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTyped(''); }, [view.key]);
  useEffect(() => {
    if (view.mode === 'typing') inputRef.current?.focus();
  }, [view.mode, view.key]);

  const submit = (e) => {
    e.preventDefault();
    if (typed.trim() && !view.checking) onTyped(typed);
  };

  return (
    <Card accent="warning" className="p-5" role="region" aria-live="polite" aria-label={`Still needed: ${view.label}`}>
      <p className="text-sm font-semibold text-[var(--color-warning)]">Still needed</p>
      <p className="mt-1 text-xl font-bold text-[var(--color-neutral-900)] break-words">
        I still need your {view.label.toLowerCase()}.
      </p>

      {view.mode === 'choice' && (
        <>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Say <strong>"type"</strong> or <strong>"say it again"</strong>, or tap a button.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="lg" icon={Keyboard} onClick={onType}>Type it</Button>
            <Button size="lg" variant="secondary" icon={Mic} onClick={onSay}>Say it again</Button>
          </div>
        </>
      )}

      {view.mode === 'typing' && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            ref={inputRef}
            label={`Type your ${view.label.toLowerCase()}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={view.hint}
            error={view.error}
            required
            autoComplete="off"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="lg" loading={view.checking} disabled={!typed.trim() || view.checking}>
              Save answer
            </Button>
            {view.allowSay && (
              <Button variant="ghost" size="lg" icon={Mic} onClick={onSay} disabled={view.checking}>
                Say it again instead
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
};

/**
 * The answer being checked, shown big with its letters, so the applicant can see a
 * misheard name ("Bakus") at a glance instead of listening to it being spelled.
 * Yes / No work like saying them; while spelling, the letters can also be typed.
 * mode 'typing': too many tries, so the answer is typed (or skipped for now). mode 'choose': the
 * place of birth after 2 misses — its closest list entries to tap, or type it (plan 001.8).
 */
const ConfirmPanel = ({ view, onYes, onNo, onTyped, onPick, onKeep, onSpell, onSkip }) => {
  const [typed, setTyped] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const mode = view.mode;
  const spelling = mode === 'spelling';
  const typing = mode === 'typing';
  const choosing = mode === 'choose';
  useEffect(() => { setTyped(''); setShowTyping(spelling || typing || choosing); }, [mode, view.value, spelling, typing, choosing]);

  const letters = String(view.letters || '').toUpperCase().split('');
  const label = view.label.toLowerCase().replace(/\s*\(.*\)/, '');
  const submitTyped = (e) => {
    e.preventDefault();
    if (typed.trim()) onTyped(typed);
  };
  let title = `Is your ${label} correct?`;
  if (spelling) title = `Spell your ${label}`;
  else if (typing) title = `Please type your ${label}`;
  else if (choosing) title = view.choices?.length ? 'Tap your place of birth, or type it' : 'Please type your place of birth';

  return (
    <div
      className="border-b border-[var(--color-neutral-100)] bg-[var(--color-primary-light)] p-5"
      role="region"
      aria-live="polite"
      aria-label="Check your answer"
    >
      <div className="text-sm font-semibold text-[var(--color-primary)]">{title}</div>

      {mode === 'confirm' && (
        <div className="mt-1 break-words text-3xl font-bold text-[var(--color-neutral-900)]">{view.value}</div>
      )}

      {view.note && (
        <div className="mt-2"><Badge tone="warning">{view.note}</Badge></div>
      )}

      {letters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Spelled ${letters.join(' ')}`}>
          {letters.map((ch, i) => (ch === ' '
            ? <span key={i} className="w-3" aria-hidden="true" />
            : (
              <span
                key={i}
                className="flex h-10 min-w-[2.25rem] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-neutral-200)] bg-white px-2 text-xl font-bold text-[var(--color-neutral-900)] shadow-[var(--shadow-xs)]"
              >
                {ch}
              </span>
            )))}
        </div>
      )}

      {spelling && (
        <p className="mt-2 text-sm text-[var(--color-neutral-600)]">
          Say the letters one by one, for example <strong>S, A, N, T, O, S</strong>. For two or more names, say
          {' '}<strong>"space"</strong> between them: <strong>M, A, R, Y, space, A, N, N</strong>.
        </p>
      )}

      {typing && view.hint && <p className="mt-1 text-sm text-[var(--color-neutral-600)]">{view.hint}</p>}

      {choosing && view.choices?.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {view.choices.map((choice) => (
            <Button
              key={`${choice.value}-${choice.province}`}
              variant="secondary"
              size="lg"
              onClick={() => onPick(choice)}
              className="h-auto min-h-[2.75rem] min-w-0 whitespace-normal break-words py-2 text-left text-base"
            >
              {choice.value}{choice.province ? ' (province)' : ''}
            </Button>
          ))}
        </div>
      )}

      {choosing && view.typed && (
        <div className="mt-3">
          <Button variant="ghost" size="lg" onClick={() => onKeep(view.typed)} className="h-auto min-h-[2.75rem] whitespace-normal break-words text-left">
            Use "{view.typed}" as typed (not in the list)
          </Button>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button onClick={onYes} className="btn-success inline-flex items-center justify-center gap-2">
            <FaCheck /> Yes, correct
          </button>
          <button onClick={onNo} className="btn-secondary inline-flex items-center justify-center gap-2">
            <FaTimes /> {view.canSpell ? 'No, spell it' : 'No, say again'}
          </button>
          {view.canSpell && !showTyping && (
            <button
              onClick={() => setShowTyping(true)}
              className="col-span-2 text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline sm:col-span-1"
            >
              Type it instead
            </button>
          )}
        </div>
      )}

      {view.canSpell && showTyping && (
        <form onSubmit={submitTyped} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={choosing ? 'Type the town or city, and province' : `Type the ${label}`}
              aria-label={`Type the ${view.label}`}
              error={view.error || ''}
            />
          </div>
          <Button type="submit" size="lg" disabled={!typed.trim()} icon={FaCheck}>Use this</Button>
        </form>
      )}

      {(typing || choosing) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {choosing && <Button variant="ghost" size="sm" onClick={onSpell}>Spell it instead</Button>}
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip for now</Button>
        </div>
      )}
    </div>
  );
};

const ListeningPulse = React.memo(() => (
  <span className="inline-flex items-center gap-2 text-sm font-medium text-rose-600" aria-live="polite">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
    </span>
    Listening
  </span>
));
ListeningPulse.displayName = 'ListeningPulse';

const SpeakingWave = React.memo(() => (
  <span className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600" aria-live="polite">
    <span className="flex items-end gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-1 bg-indigo-500 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, height: '60%' }}
        />
      ))}
    </span>
    Speaking
  </span>
));
SpeakingWave.displayName = 'SpeakingWave';

const ThinkingDots = React.memo(({ label = 'Thinking' }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500" aria-live="polite">
    <FaBrain className="text-gray-400" size={13} />
    <span className="flex gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
    {label}
  </span>
));
ThinkingDots.displayName = 'ThinkingDots';

/** A single small pill summarizing the assistant's current conversational phase. */
const PhaseIndicator = React.memo(({ phase }) => {
  if (phase === PHASE.LISTENING) return <ListeningPulse />;
  if (phase === PHASE.SPEAKING || phase === PHASE.ASKING || phase === PHASE.GREETING) return <SpeakingWave />;
  if (phase === PHASE.THINKING) return <ThinkingDots label="Understanding..." />;
  if (phase === PHASE.CONFIRMING) return <ThinkingDots label="Verifying your information..." />;
  if (phase === PHASE.ISSUING) return <ThinkingDots label="Preparing your application..." />;
  if (phase === PHASE.RETRY) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
        <FaExclamationTriangle size={12} /> Let's try that again
      </span>
    );
  }
  return null;
});
PhaseIndicator.displayName = 'PhaseIndicator';

const ChatBubble = React.memo(({ role, text, isLatest }) => {
  const isAssistant = role === 'assistant';
  return (
    <div
      className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}
      style={{ animation: isLatest ? 'fadeInUp 0.35s ease-out' : undefined }}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isAssistant ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
        }`}
        aria-hidden="true"
      >
        {isAssistant ? <FaUserTie size={14} /> : <FaMicrophone size={14} />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
          isAssistant
            ? 'rounded-tl-none bg-gray-100 text-gray-900'
            : 'rounded-tr-none bg-indigo-600 text-white'
        }`}
      >
        {text}
      </div>
    </div>
  );
});
ChatBubble.displayName = 'ChatBubble';

/** Conversational summary row used on the review / voice-review screens. */
const SummaryRow = React.memo(({ label, value, onChange, onAskAgain, highlighted, error }) => (
  <div
    className={`rounded-xl border p-3.5 transition-colors ${
      error
        ? 'border-rose-300 bg-rose-50'
        : highlighted ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {error
          ? <FaExclamationTriangle className="text-rose-600" size={12} />
          : String(value || '').trim() ? <FaCheck className="text-emerald-600" size={12} /> : null}
        {onAskAgain && (
          <button
            type="button"
            onClick={onAskAgain}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
          >
            Ask again
          </button>
        )}
      </div>
    </div>
    {onChange ? (
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input-field mt-1.5 w-full"
        aria-label={`Edit ${label}`}
      />
    ) : (
      <div className="mt-1 truncate text-sm text-gray-500">{value || 'No answer yet'}</div>
    )}
    {error && <p className="mt-1.5 text-xs font-medium text-rose-700" role="alert">{error}</p>}
  </div>
));
SummaryRow.displayName = 'SummaryRow';

// ═══════════════════════════════════════════════════════════════
// SECTION 9: Main Component
// ═══════════════════════════════════════════════════════════════

const NewApplication = () => {
  const chatContainerRef = useRef(null);

  // ── Core State ──
  const [step, setStep] = useState('interview');
  // Manual entry is the safe default. Voice controls explicitly change this.
  const [inputMethod, setInputMethod] = useState('manual');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState('');
  // Usability survey offered after the CTC is issued
  const [survey, setSurvey] = useState({ open: false, transactionId: null, features: [] });
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // { mode: 'confirm' | 'spelling', label, value, letters, canSpell } while an answer is checked
  const [confirmView, setConfirmView] = useState(null);
  // { key, label, hint, mode: 'choice' | 'typing', allowSay, error, checking } while a
  // required answer that is still blank is asked for again before the final "yes"
  const [missingView, setMissingView] = useState(null);
  // The address part being asked by voice ({ key, label, question, hint }; plan 001.6), else null
  const [addressPart, setAddressPart] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [voiceError, setVoiceError] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  // ── UI State ──
  const [isRecording, setIsRecording] = useState(false);
  const [isBrowserListening, setIsBrowserListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [fieldError, setFieldError] = useState('');      // why the current answer was not accepted
  const [reviewErrors, setReviewErrors] = useState({});   // per-field problems found before issuing
  const [consentGiven, setConsentGiven] = useState(false); // privacy notice accepted for this applicant

  // ── Refs ──
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const answersRef = useRef({});
  const inputRef = useRef(null);
  const speechAudioRef = useRef(null);
  const speechSequenceRef = useRef(0);
  // Temporary practice log (plan 001.7): the session and the note builder live as long as the page.
  const practiceRef = useRef(null);
  if (!practiceRef.current) {
    practiceRef.current = {
      session: createPracticeSession(practiceLogAPI),
      rec: createPracticeRecorder({ savedForm: practiceSavedForm }),
    };
  }
  const practice = practiceRef.current;

  // ── Memoized Values ──
  const currentField = INTERVIEW_FIELDS[currentFieldIndex];
  const answeredCount = useMemo(
    () => INTERVIEW_FIELDS.filter((f) => String(answers[f.key] || '').trim()).length,
    [answers]
  );
  const progress = Math.round((answeredCount / INTERVIEW_FIELDS.length) * 100);
  const isLastQuestion = currentFieldIndex === INTERVIEW_FIELDS.length - 1;
  const canReview = REQUIRED_KEYS.every((key) => String(answers[key] || '').trim());

  // ── Keep refs in sync ──
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ── Auto-focus input on field change ──
  const currentFieldKeyRef = useRef(currentField.key);
  currentFieldKeyRef.current = currentField.key;
  useEffect(() => {
    setDraftAnswer(answers[currentField.key] || '');
    inputRef.current?.focus();
  }, [answers, currentField.key, currentFieldIndex]);
  useEffect(() => { setFieldError(''); }, [currentField.key]);

  // ── Auto-scroll chat ──
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, statusMessage]);

  // Practice log: closing or reloading the tab does not unmount React, so finish on pagehide too.
  useEffect(() => {
    const onPageHide = () => practice.session.finish({ keepalive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [practice]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      practice.session.finish();   // leaving before the CTC is issued: the practice session is "abandoned"
      speechSequenceRef.current += 1;
      window.speechSynthesis?.cancel();
      speechAudioRef.current?.pause();
      recognitionRef.current?.abort?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [practice]);

  // ── Chat Helpers ──
  const addChatMessage = useCallback((role, text) => {
    setChatHistory((prev) => [...prev, { role, text, id: generateId() }]);
  }, []);

  // ── Speech Synthesis (standalone for non-conversation use) ──
  // Uses the same backend Edge neural TTS voice as the guided conversation,
  // with browser speechSynthesis as an automatic fallback.
  const speakText = useCallback((text, onEnd) => {
    speechSequenceRef.current += 1;
    const sequence = speechSequenceRef.current;
    window.speechSynthesis?.cancel();
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.src = '';
      speechAudioRef.current = null;
    }
    setIsSpeaking(true);
    synthesizeAndPlay(text, {
      audioRef: speechAudioRef,
      onEnd: () => {
        if (speechSequenceRef.current !== sequence) return;
        setIsSpeaking(false);
        onEnd?.();
      },
    });
  }, []);

  const stopSpeakText = useCallback(() => {
    speechSequenceRef.current += 1;
    window.speechSynthesis?.cancel();
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.src = '';
      speechAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── Check & store one answer (typed, dictated, or recorded) ──
  // Returns { value } when the answer was understood and saved, otherwise false.
  const applyAnswer = useCallback(async (field, text, { quiet = false } = {}) => {
    const value = String(text || '').trim();
    if (!value && !field.optional) {
      if (!quiet) setFieldError(`Please answer ${field.label.toLowerCase()} before continuing.`);
      return false;
    }
    setIsChecking(true);
    let result;
    try {
      result = await interpretAnswer(field.key, value);
    } catch {
      return false;
    } finally {
      setIsChecking(false);
    }
    const stillHere = currentFieldKeyRef.current === field.key;  // staff may have moved to another question
    if (!result.ok) {
      if (!quiet && stillHere) {
        setFieldError(result.message);
        setPhase(PHASE.RETRY);
        setStatusMessage(result.message);
      }
      return false;
    }
    // Typed or dictated by staff: an unusual place/occupation is kept as entered (no confirmation prompt).
    setAnswers((prev) => ({ ...prev, [field.key]: result.value || '' }));
    setReviewErrors((prev) => ({ ...prev, [field.key]: undefined }));
    const saved = { value: result.value || '' };
    if (!stillHere) return saved;
    setFieldError('');
    setDraftAnswer(result.value || '');
    setPhase(PHASE.IDLE);
    setStatusMessage(`${field.label} saved.`);
    if (!quiet) addChatMessage('user', `${field.label}: ${result.display || result.value || 'none'}`);
    return saved;
  }, [addChatMessage]);

  // ── Save Answer ──
  const saveAnswer = useCallback(async (options = {}) => {
    const value = draftAnswer.trim();
    if (!value && !options.advance) return true;  // navigating away from an empty field is fine
    // Unchanged answer (already checked): nothing to do unless advancing.
    if (!options.advance && value === String(answers[currentField.key] || '').trim()) return true;
    const saved = await applyAnswer(currentField, value, { quiet: options.quiet });
    if (!saved) {
      if (options.advance) toast.warning(`Please check the ${currentField.label.toLowerCase()}.`);
      return false;
    }
    if (options.advance) {
      const after = { ...answers, [currentField.key]: saved.value };
      const next = nextFieldIndex(currentFieldIndex, after);
      if (next > currentFieldIndex + 1) setAnswers((prev) => ({ ...prev, icr_no: '' }));  // Filipino: no ICR
      if (isLastQuestion || next >= INTERVIEW_FIELDS.length) {
        setStep('review');
      } else {
        setCurrentFieldIndex(next);
      }
    }
    return true;
  }, [draftAnswer, answers, currentField, currentFieldIndex, isLastQuestion, applyAnswer]);

  // ── Manual Voice Input (Browser Dictation) ──
  const startBrowserDictation = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    const field = currentField;
    let heardText = '';
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceError('');
      setFieldError('');
      setIsBrowserListening(true);
      setPhase(PHASE.LISTENING);
      setStatusMessage('Listening...');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      heardText = (finalTranscript || interimTranscript).trim();
      setDraftAnswer(heardText);
    };

    recognition.onerror = (event) => {
      const msg = event.error === 'no-speech'
        ? "I didn't hear speech. Please try again or type the answer."
        : `Browser dictation had an issue: ${event.error}. You can type instead.`;
      setVoiceError(msg);
      toast.error(msg);
    };

    recognition.onend = () => {
      setIsBrowserListening(false);
      recognitionRef.current = null;
      setPhase(PHASE.IDLE);
      setStatusMessage('Ready');
      // Understand what was heard (DistilBERT + regex) and save it, or show why not.
      if (heardText) applyAnswer(field, heardText);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [currentField, applyAnswer]);

  // ── Media Recorder (Backend Transcription) ──
  const transcribeAnswerRef = useRef(null);
  const startRecording = useCallback(async () => {
    try {
      setVoiceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        // Use the latest transcribeAnswer: this callback is created once, and the
        // first-render copy would file every answer under the first question's field.
        await transcribeAnswerRef.current(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setPhase(PHASE.LISTENING);
      setStatusMessage('Recording... Speak now.');
    } catch {
      toast.error('Microphone access was blocked or unavailable.');
    }
  }, []);

  // "Answer by Voice": record and let Whisper transcribe (as in the paper);
  // browser dictation only where the browser cannot record audio.
  const startVoiceAnswer = useCallback(() => {
    if (window.MediaRecorder && navigator.mediaDevices?.getUserMedia) {
      startRecording();
      return;
    }
    startBrowserDictation();
  }, [startBrowserDictation, startRecording]);

  const stopVoiceInput = useCallback(() => {
    if (isBrowserListening) {
      recognitionRef.current?.stop?.();
      setIsBrowserListening(false);
      return;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isBrowserListening]);

  const transcribeAnswer = useCallback(async (blob) => {
    setIsTranscribing(true);
    setPhase(PHASE.THINKING);
    setStatusMessage('Whisper is transcribing your answer...');
    try {
      const wavBlob = await convertRecordingToWav(blob);
      const file = new File([wavBlob], 'answer.wav', { type: 'audio/wav' });
      const response = await speechAPI.transcribe(file, currentField.key);
      const text = (response.data?.transcript || response.data?.text || '').trim();

      if (!text) {
        toast.warning("I didn't catch that. Please try again or type the answer.");
        setPhase(PHASE.RETRY);
        setStatusMessage("I didn't catch that. Please try again.");
        return;
      }

      setDraftAnswer(text);
      // Whisper gave the words; DistilBERT + regex turn them into the field value.
      if (await applyAnswer(currentField, text)) toast.success(`${currentField.label} captured.`);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Voice processing failed. You can type the answer instead.');
      setVoiceError(message);
      toast.error(message);
      setPhase(PHASE.RETRY);
      setStatusMessage('Voice processing failed.');
    } finally {
      setIsTranscribing(false);
    }
  }, [currentField, applyAnswer]);
  transcribeAnswerRef.current = transcribeAnswer;

  // ── Navigation ──
  const goToField = useCallback((index) => {
    if (step === 'interview') saveAnswer({ quiet: true });
    setCurrentFieldIndex(index);
    setStep('interview');
    setStatusMessage(`Let's revisit your ${INTERVIEW_FIELDS[index].label.toLowerCase()}.`);
  }, [saveAnswer, step]);

  // Review-page edits are stored as typed; "Issue CTC" checks and normalizes every field.
  const updateReviewField = useCallback((key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setReviewErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  // ── Play Verification ──
  // Reads the collected answers back using the backend neural voice.
  const playVerification = useCallback(() => {
    const readable = INTERVIEW_FIELDS
      .map((f) => `${f.label}: ${answers[f.key] || 'blank'}`)
      .join('. ');
    speakText(`Please verify the information. ${readable}`);
  }, [answers, speakText]);

  // ── Issue Form ──
  // Returns what happened, so the voice conversation knows what to do next:
  //   'issued'  — saved; survey and counter line follow (nothing is printed here)
  //   'missing' — a required answer is blank (voice: the conversation asks for it)
  //   'review'  — stopped; moved to the manual review page and said so
  //   'auth'    — login expired; the API client goes to the login page
  // `say` (voice only) is the conversation's own speaker, so nothing talks over it.
  const issueForm = useCallback(async ({ say } = {}) => {
    const fromVoice = typeof say === 'function';
    const tell = fromVoice ? say : speakText;
    const latestAnswers = answersRef.current;
    const missingLabels = missingRequiredIndexes(latestAnswers).map((index) => INTERVIEW_FIELDS[index].label);

    if (missingLabels.length) {
      toast.warning(`Please complete: ${missingLabels.join(', ')}`);
      if (fromVoice) return 'missing';
      setStep('review');
      tell(`I still need your ${missingLabels.join(', ').toLowerCase()}. Please fill them in on the screen.`);
      return 'review';
    }

    // Every stop below moves to the manual review page and says so: no dead end.
    const stopAtReview = (message) => {
      setIsIssuing(false);
      setPhase(PHASE.RETRY);
      setStep('review');
      tell(message);
      return 'review';
    };

    setIsIssuing(true);
    setPhase(PHASE.ISSUING);
    setStatusMessage('Checking your details…');
    let payload = null;

    // Re-check all answers (manual edits on the review page included) before issuing.
    let checkedAnswers = latestAnswers;
    try {
      const { data } = await extractionAPI.checkAnswers(latestAnswers);
      if (!data.ok) {
        const problems = Object.fromEntries(
          Object.entries(data.results).filter(([, r]) => !r.ok).map(([key, r]) => [key, r.message])
        );
        const labels = Object.keys(problems).map((key) => FIELD_MAP[key]?.label || key).join(', ');
        setReviewErrors(problems);
        setStatusMessage(`Please check: ${labels}`);
        toast.error(`Please check: ${labels}`);
        return stopAtReview(`Some answers need to be checked: ${labels}. I moved you to the review page. Please look at the screen.`);
      }
      checkedAnswers = Object.fromEntries(Object.entries(data.results).map(([key, r]) => [key, r.value ?? '']));
      answersRef.current = checkedAnswers;
      setAnswers(checkedAnswers);
      setReviewErrors({});
    } catch (error) {
      if (error.response?.status === 401) {
        setIsIssuing(false);
        return 'auth';
      }
      console.warn('Answer check unavailable; using the basic checks only:', error);
    }

    try {
      const formData = buildApplicantData(checkedAnswers);
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        toast.error(`Validation errors:\n${validationErrors.join('\n')}`);
        return stopAtReview('I found some issues with your information. I moved you to the review page. Please check the details on the screen.');
      }

      // Every check passed: only now say that the application is being saved.
      setStatusMessage(SAVING_LINE);
      tell(SAVING_LINE);

      const income = parseFloat(formData.gross_annual_income) || 0;
      const taxResult = await extractionAPI.computeTax(income);
      formData.tax_classification = taxResult.data?.tax_classification || formData.tax_classification;

      payload = {
        applicant_data: formData,
        input_method: inputMethod,
        raw_transcript: null,
        ...(practice.session.id ? { practice_session_id: practice.session.id } : {}),
      };

      const result = await formsAPI.issue(payload);
      const issuedCtc = result.data?.ctc_number;
      if (!issuedCtc) throw new Error('The server did not return a CTC number.');
      practice.session.issued();   // the backend ended the practice session; late notes still go out

      // Saved with its CTC number and PDF, but nothing is downloaded or printed here:
      // the admin prints it at the counter from Records (plan 001.3).
      toast.success('Application saved.');
      setSurvey({
        open: true,
        transactionId: result.data?.id ?? null,
        features: inputMethod === 'voice'
          ? ['voice_input', 'voice_feedback', 'form_generation']
          : ['form_generation'],
      });
      setStep('success');
      setPhase(PHASE.IDLE);
      tell(COUNTER_LINE);
      return 'issued';
    } catch (error) {
      if (error.response?.status === 401) return 'auth';
      console.error('Issue error:', error);
      console.error('Issue response:', error.response?.status, error.response?.data);
      console.error('Request payload:', payload);

      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        // e.g. the server's 422 for a blank required field: mark those fields on the review page.
        const toFormKey = { date_of_birth: 'date', height_cm: 'height', weight_kg: 'weight' };
        const fieldErrors = Object.fromEntries(errorDetail
          .filter((err) => err.loc?.[1] === 'applicant_data' && err.loc?.[2])
          .map((err) => [toFormKey[err.loc[2]] || err.loc[2], err.msg]));
        if (Object.keys(fieldErrors).length) setReviewErrors(fieldErrors);
        toast.error(`Validation errors:\n${errorDetail.map((err) => err.msg).join('\n')}`);
      } else if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else {
        toast.error(getApiErrorMessage(error, 'Unable to save the application. Please check all fields.'));
      }
      return stopAtReview('I could not save your application. I moved you to the review page. Please check the details on the screen and try again.');
    } finally {
      setIsIssuing(false);
      setStatusMessage('Ready');
    }
  }, [speakText, inputMethod, practice]);

  // ── Reset ──
  const resetInterview = useCallback(() => {
    practice.session.finish();   // no-op when the CTC was issued
    practice.rec.reset();
    setStep('interview');
    setCurrentFieldIndex(0);
    setAnswers({});
    setDraftAnswer('');
    setFieldError('');
    setReviewErrors({});
    setConsentGiven(false);   // the next applicant sees the privacy notice again
    setSurvey({ open: false, transactionId: null, features: [] });
    setAwaitingConfirmation(false);
    setConfirmView(null);
    setMissingView(null);
    setChatHistory([]);
    setStatusMessage('Ready');
    setPhase(PHASE.IDLE);
    setVoiceError('');
    window.speechSynthesis?.cancel();
    speechAudioRef.current?.pause();
  }, [practice]);

  // ── Conversation Engine Hook ──
  const {
    isConversationActive,
    startConversation,
    stopConversation,
    startVoiceReview,
    tapConfirm,
    tapMissing,
  } = useConversationEngine({
    answers,
    currentFieldIndex,
    setAnswers,
    setDraftAnswer,
    setCurrentFieldIndex,
    setStep,
    setAwaitingConfirmation,
    setStatusMessage,
    setPhase,
    setVoiceError,
    addChatMessage,
    issueForm,
    setConfirmView,
    setMissingView,
    setAddressPart,
    practice,
  });

  // What the question card shows: during the voice interview the address is asked in 3 parts, the
  // place of birth in steps.
  const askedField = isConversationActive && ['address', 'place_of_birth'].includes(currentField.key) && addressPart
    ? { ...currentField, ...addressPart }
    : currentField;

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (step === 'interview' && !isConversationActive && !isRecording && !isBrowserListening && !isTranscribing) {
          saveAnswer({ advance: true });
        }
      }
      if (e.key === 'Escape') {
        if (isConversationActive) stopConversation();
        else if (isBrowserListening || isRecording) stopVoiceInput();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isConversationActive, isRecording, isBrowserListening, isTranscribing, saveAnswer, stopConversation, stopVoiceInput]);

  const currentPhaseCopy = PHASE_COPY[phase] || PHASE_COPY[PHASE.IDLE];

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Success State
  // ═══════════════════════════════════════════════════════════════
  if (step === 'success') {
    // No CTC number here: at the counter the applicant only gives their name, and the
    // admin prints the Cedula from Records. The line stays after the survey closes.
    return (
      <div className="max-w-lg mx-auto">
        <Card accent="success" className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)]">
            <FaCheck size={32} aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-neutral-900)]">Application Saved</h1>
          <p className="mt-3 text-lg font-medium text-[var(--color-neutral-800)] break-words" role="status">
            {COUNTER_SCREEN_LINE}
          </p>
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            At the counter, just give your name. Pay there and receive your printed Cedula.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" icon={FaRegEdit} onClick={resetInterview}>
              New Application
            </Button>
          </div>
        </Card>
        <SusSurveyDialog
          open={survey.open}
          transactionId={survey.transactionId}
          defaultFeatures={survey.features}
          onClose={() => setSurvey((s) => ({ ...s, open: false }))}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Voice Review State
  // ═══════════════════════════════════════════════════════════════
  if (step === 'voice-review') {
    // The screen matches what the assistant says: missing answers first, and the
    // "please confirm" line only once nothing required is blank.
    const missingLabels = missingRequiredIndexes(answers).map((index) => INTERVIEW_FIELDS[index].label);
    const readyToConfirm = awaitingConfirmation && missingLabels.length === 0 && !missingView;
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {isIssuing && <IssuingOverlay message={statusMessage} />}
        <div className="space-y-5 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-neutral-900)]">Confirming Your Information</h1>
            {missingLabels.length > 0 ? (
              <p className="mt-1.5 text-sm text-[var(--color-neutral-600)] leading-relaxed">
                A few required answers are still missing. Type them, or say them again.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-[var(--color-neutral-600)] leading-relaxed">
                Please check the <strong>Applicant Answers</strong>. Say <strong>"yes"</strong> if everything is
                correct and your application will be saved, or say a change such as <em>"change surname to Cruz."</em>
              </p>
            )}
          </div>

          {missingLabels.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-4 text-sm text-[var(--color-neutral-800)] flex items-start gap-2" role="status">
              <FaExclamationTriangle className="shrink-0 mt-0.5 text-[var(--color-warning)]" aria-hidden="true" />
              <div className="min-w-0">
                <span className="font-semibold">Still needed before saving:</span>{' '}
                <span className="break-words">{missingLabels.join(', ')}</span>
              </div>
            </div>
          )}

          {isConversationActive && missingView && (
            <MissingFieldPanel
              view={missingView}
              onType={() => tapMissing('type')}
              onSay={() => tapMissing('say')}
              onTyped={(text) => tapMissing('typed', text)}
            />
          )}

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div
              ref={chatContainerRef}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4 max-h-[400px] overflow-y-auto"
            >
              {chatHistory.map((msg, i) => (
                <ChatBubble key={msg.id} role={msg.role} text={msg.text} isLatest={i === chatHistory.length - 1} />
              ))}
            </div>
          )}

          {/* Active Status */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 transition-transform ${
                  phase === PHASE.SPEAKING || phase === PHASE.LISTENING ? 'scale-105' : ''
                }`}
              >
                <FaUserTie />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm font-semibold text-indigo-700">Barangay Staff Assistant</div>
                <div className="rounded-xl rounded-tl-none bg-gray-100 p-4 text-base font-medium text-gray-900">
                  {readyToConfirm
                    ? 'Ready to issue your Cedula — please confirm.'
                    : missingLabels.length > 0
                      ? `I still need your ${missingLabels.join(', ').toLowerCase()}.`
                      : "I've collected the following information from our conversation."}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PhaseIndicator phase={phase} />
                  {isIssuing && (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-neutral-600)]">
                      <LoadingSpinner size="sm" /> Please wait...
                    </span>
                  )}
                  <span className="text-sm text-gray-500">{statusMessage}</span>
                </div>
              </div>
            </div>
          </div>

          {voiceError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
              <FaExclamationTriangle className="shrink-0 mt-0.5" />
              {voiceError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => {
                stopConversation();
                setStep('review');
              }}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <FaRegEdit /> Switch to Manual Review
            </button>
          </div>
        </div>

        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900">Applicant Answers</h2>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-auto p-2 space-y-2">
            {INTERVIEW_FIELDS.map((field, index) => (
              <SummaryRow
                key={field.key}
                label={field.label}
                value={answers[field.key]}
                highlighted={index === currentFieldIndex && !awaitingConfirmation}
              />
            ))}
          </div>
        </aside>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Review State
  // ═══════════════════════════════════════════════════════════════
  if (step === 'review') {
    return (
      <div className="space-y-5">
        {isIssuing && <IssuingOverlay message={statusMessage} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verify Applicant Information</h1>
            <p className="mt-1 text-sm text-gray-600">
              I've collected the following information from our conversation. Edit anything that needs a fix.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={playVerification} className="btn-secondary inline-flex items-center justify-center gap-2">
              {isSpeaking ? <FaPause /> : <FaPlay />} Read Back
            </button>
            <button onClick={() => { setInputMethod('voice'); startVoiceReview(); }} className="btn-secondary inline-flex items-center justify-center gap-2">
              <FaMicrophone /> Voice Review
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INTERVIEW_FIELDS.map((field, index) => (
            <SummaryRow
              key={field.key}
              label={field.label}
              value={answers[field.key]}
              onChange={(value) => {
                setInputMethod('manual');
                updateReviewField(field.key, value);
              }}
              onAskAgain={() => goToField(index)}
              error={reviewErrors[field.key]}
            />
          ))}
        </div>

        {!canReview && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
            <FaExclamationTriangle className="shrink-0 mt-0.5" />
            Some required fields are still blank. Fill them in or ask those questions again.
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => setStep('interview')} className="btn-secondary inline-flex items-center gap-2">
            <FaArrowLeft /> Back to Interview
          </button>
          <button
            onClick={() => issueForm()}
            disabled={isIssuing || !canReview}
            className="btn-success inline-flex items-center gap-2 disabled:opacity-50"
          >
            {isIssuing ? <LoadingSpinner size="sm" /> : <FaDownload />} Issue CTC
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Interview State (Main)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      {isIssuing && <IssuingOverlay message={statusMessage} />}
      <ConsentNotice
        open={!consentGiven}
        onAgree={() => {
          setConsentGiven(true);
          practice.rec.reset();
          practice.session.start('manual');   // practice log: answers "off" unless the backend turned it on
        }}
        speak={speakText}
        stopSpeaking={stopSpeakText}
      />
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
                  <FaFileAlt className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
                </span>
                New Cedula Application
              </h1>
              <p className="mt-1 text-sm text-gray-600 inline-flex items-center gap-2">
                Question {currentFieldIndex + 1} of {INTERVIEW_FIELDS.length}
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <span aria-hidden="true">{currentPhaseCopy.icon}</span> {currentPhaseCopy.label}
                </span>
              </p>
            </div>
          <div className="min-w-48">
            <div className="mb-1 flex justify-between text-xs font-medium text-gray-600">
              <span>Completed</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div
            ref={chatContainerRef}
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4 max-h-[320px] overflow-y-auto"
          >
            {chatHistory.map((msg, i) => (
              <ChatBubble key={msg.id} role={msg.role} text={msg.text} isLatest={i === chatHistory.length - 1} />
            ))}
            {phase === PHASE.THINKING && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <FaUserTie size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-none bg-gray-100 px-4 py-2.5">
                  <ThinkingDots label="Understanding your answer..." />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Interaction Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Assistant Message */}
          <div className="border-b border-gray-100 p-5">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 transition-transform duration-300 ${
                  phase === PHASE.SPEAKING || phase === PHASE.ASKING ? 'scale-110' : ''
                }`}
              >
                <FaUserTie />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm font-semibold text-indigo-700">Barangay Staff Assistant</div>
                <div className="rounded-xl rounded-tl-none bg-gray-100 p-4 text-lg font-medium text-gray-900 leading-relaxed">
                  {askedField.question}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!isConversationActive ? (
                    <button
                      onClick={() => {
                        setInputMethod('voice');
                        startConversation();
                      }}
                      disabled={isTranscribing}
                      className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaPlay /> Start Conversation
                    </button>
                  ) : (
                    <button onClick={stopConversation} className="btn-secondary inline-flex items-center gap-2">
                      <FaPause /> Pause Conversation
                    </button>
                  )}
                  <PhaseIndicator phase={phase} />
                  <span className="text-sm text-gray-500">{!isConversationActive ? statusMessage : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {isConversationActive && confirmView && (
            <ConfirmPanel
              view={confirmView}
              onYes={() => tapConfirm('yes')}
              onNo={() => tapConfirm('no')}
              onTyped={(text) => tapConfirm('typed', text)}
              onPick={(choice) => tapConfirm('pick', choice)}
              onKeep={(text) => tapConfirm('keep', text)}
              onSpell={() => tapConfirm('spell')}
              onSkip={() => tapConfirm('skip')}
            />
          )}

          {/* Input Area */}
          <div className="p-5">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="answer-input">
              {askedField.label}
            </label>
            <textarea
              id="answer-input"
              ref={inputRef}
              value={draftAnswer}
              onChange={(e) => {
                setInputMethod('manual');
                setDraftAnswer(e.target.value);
                if (fieldError) setFieldError('');
              }}
              rows={4}
              placeholder={askedField.hint}
              className={`input-field resize-none text-base w-full ${fieldError ? '!border-rose-400' : ''}`}
              aria-label={`Answer for ${askedField.label}`}
              aria-invalid={Boolean(fieldError)}
              disabled={isConversationActive}
            />
            {fieldError && (
              <p className="mt-2 text-sm font-medium text-rose-700 flex items-start gap-1.5" role="alert">
                <FaExclamationTriangle className="shrink-0 mt-0.5" size={13} /> {fieldError}
              </p>
            )}

            {/* Action Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isRecording && !isBrowserListening ? (
                  <button
                    onClick={() => {
                      setInputMethod('voice');
                      startVoiceAnswer();
                    }}
                    disabled={isTranscribing || isConversationActive}
                    className="btn-danger inline-flex items-center gap-2 disabled:opacity-50"
                    aria-label="Answer by voice"
                  >
                    <FaMicrophone /> Answer by Voice
                  </button>
                ) : (
                  <button
                    onClick={stopVoiceInput}
                    className="btn-secondary inline-flex items-center gap-2"
                    aria-label="Stop listening"
                  >
                    <FaStop /> Stop Listening
                  </button>
                )}
                {isBrowserListening && <ListeningPulse />}
                {isRecording && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-rose-600">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                    </span>
                    Recording...
                  </span>
                )}
                {isTranscribing && <ThinkingDots label="Whisper is transcribing..." />}
              </div>

              <button
                onClick={() => saveAnswer({ advance: true })}
                disabled={isConversationActive || isRecording || isBrowserListening || isTranscribing || isChecking}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Save & Continue'} <FaArrowRight />
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1.5">
              <FaCommentDots className="text-gray-400" size={12} />
              Press <strong>Start Conversation</strong> and the assistant will ask every question and show each
              answer on screen to confirm (yes or no, by voice or by tapping), then show the summary before issuing.
              <span className="hidden sm:inline"> Shortcut: Ctrl+Enter to save.</span>
            </p>

            {voiceError && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
                <FaExclamationTriangle className="shrink-0 mt-0.5" />
                {voiceError}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex flex-wrap justify-between gap-3">
          <button
            onClick={() => {
              if (isConversationActive) stopConversation();
              resetInterview();
            }}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaArrowLeft /> Start Over
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                saveAnswer({ quiet: true });
                setCurrentFieldIndex((i) => Math.max(0, i - 1));
              }}
              disabled={currentFieldIndex === 0}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <FaArrowLeft /> Previous
            </button>
            <button
              onClick={() => {
                saveAnswer({ quiet: true });
                setStep('review');
              }}
              className="btn-success inline-flex items-center gap-2"
            >
              <FaCheck /> Review
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900">Applicant Answers</h2>
          <p className="mt-1 text-xs text-gray-500">{answeredCount} of {INTERVIEW_FIELDS.length} fields captured</p>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-auto p-2">
          {INTERVIEW_FIELDS.map((field, index) => {
            const value = answers[field.key];
            const isActive = index === currentFieldIndex;
            return (
              <button
                key={field.key}
                type="button"
                onClick={() => goToField(index)}
                className={`mb-2 w-full rounded-lg border p-3 text-left transition-all duration-200 ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`Go to ${field.label}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700">{field.label}</span>
                  {value ? <FaCheck className="shrink-0 text-emerald-600" size={14} /> : null}
                </div>
                <div className="mt-1 truncate text-sm text-gray-500">{value || 'No answer yet'}</div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default NewApplication;
