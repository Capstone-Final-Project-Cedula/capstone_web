import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaDownload,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaPrint,
  FaRegEdit,
  FaStop,
  FaUserTie,
  FaExclamationTriangle,
  FaBrain,
  FaCommentDots,
  FaFileAlt,
} from 'react-icons/fa';
import { speechAPI } from '../api/speech';
import { extractionAPI } from '../api/extraction';
import { formsAPI } from '../api/forms';
import apiClient from '../api/client';
import { getApiErrorMessage } from '../api/errors';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SusSurveyDialog from '../components/sus/SusSurveyDialog';
import ConsentNotice from '../components/interview/ConsentNotice';
import { applySpelling, looksSpelled, spellOut, titleCaseSpelled } from '../utils/spelling';

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
    question: "When is your birthday? Please say the month, day, and year.",
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
    question: "If you have an ICR number, please say it. If not, just say none.",
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
    question: "How tall are you? You can say it in centimeters, or in feet and inches.",
    hint: 'Example: 165 cm, or 5 feet 5',
  },
  {
    key: 'weight',
    label: 'Weight (kg)',
    question: "How much do you weigh? You can say it in kilos or pounds.",
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
    question: "How much do you earn? You can tell me the amount per year or per month. If none, say none.",
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
  `${getTimeGreeting()}! I'll help you apply for your Cedula. Please answer each question after the beep.`;

const REVIEW_PROMPT =
  'Please check your details on the screen. If everything is correct, say yes. To change something, say for example: change occupation to teacher.';

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

// Lowercase, drop punctuation and the polite "po"/"opo" so "Yes po." and "Opo" both count.
const normalizeReply = (value) =>
  String(value || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\b(po|ho)\b/g, ' ').replace(/\s+/g, ' ').trim();

const isYesAnswer = (value) =>
  /^(yes|yeah|yep|yup|correct|right|that is correct|that's correct|that's right|spelling is correct|okay|ok|sure|confirm|confirmed|proceed|go ahead|opo|oo|oho|tama|tama yan|sige|yes correct)$/.test(
    normalizeReply(value)
  );

const isNoAnswer = (value) =>
  /^(no|nope|not correct|that is wrong|that's wrong|incorrect|wrong|cancel|stop|don't|do not|nevermind|hindi|mali|hindi tama|di)$/.test(
    normalizeReply(value)
  );

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
const interpretAnswer = async (key, text) => {
  try {
    const { data } = await extractionAPI.understandAnswer(key, String(text || ''));
    return data;
  } catch (error) {
    if (error.response?.status === 401) throw error;
    console.warn('Answer check unavailable, using the local check:', error);
    return localInterpret(key, text);
  }
};

const METHOD_LABELS = { distilbert: 'DistilBERT', regex: 'regex', gazetteer: 'fuzzy matching', local: 'offline check' };

// Which speech-to-text engine heard an answer (shown under the applicant's chat bubble).
const describeEngine = (meta = {}) => {
  if (meta.engine === 'whisper') return `Heard by Whisper${meta.seconds ? ` (${meta.seconds} s)` : ''}`;
  if (meta.engine === 'browser') return 'Heard by browser speech recognition';
  return '';
};
const describeMethods = (methods = [], verb = 'Understood') =>
  methods.length ? `${verb} with ${methods.map((m) => METHOD_LABELS[m] || m).join(' + ')}` : '';

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

const validateFormData = (formData) => {
  const errors = [];
  if (!formData.surname) errors.push('Surname is required');
  if (!formData.given_name) errors.push('Given name is required');
  if (!formData.address) errors.push('Address is required');
  if (!['Male', 'Female'].includes(formData.sex)) {
    errors.push('Sex must be Male or Female');
  }
  if (!['Single', 'Married', 'Widowed', 'Separated'].includes(formData.civil_status)) {
    errors.push('Civil status must be Single, Married, Widowed, or Separated');
  }
  if (!formData.date_of_birth || !/^\d{4}-\d{2}-\d{2}$/.test(formData.date_of_birth)) {
    errors.push('Date of birth is missing or could not be read');
  }
  if (formData.gross_annual_income && formData.gross_annual_income < 0) {
    errors.push('Gross annual income must be a positive number');
  }
  return errors;
};

// ═══════════════════════════════════════════════════════════════
// SECTION 5: PDF & Print Utilities
// ═══════════════════════════════════════════════════════════════

const openPrintWindow = () => {
  try {
    return window.open('', '_blank');
  } catch {
    return null;
  }
};

const downloadAndPrintPdf = (pdfData, ctcNumber, printWindow = null) => {
  const pdfBlob = pdfData instanceof Blob ? pdfData : new Blob([pdfData], { type: 'application/pdf' });
  if (!pdfBlob.size) throw new Error('The downloaded PDF is empty.');

  const url = window.URL.createObjectURL(pdfBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `CTC_${ctcNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const cleanup = () => {
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  };

  if (printWindow && !printWindow.closed) {
    printWindow.location.href = url;
    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        toast.info('PDF opened in a new tab. Use the browser print button if the dialog did not appear.');
      }
    }, 1200);
    cleanup();
    return;
  }

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px',
    opacity: '0', border: '0',
  });
  iframe.src = url;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      toast.info('PDF downloaded. Open the file to print if the print dialog did not appear.');
    }
    window.setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 60000);
  };

  iframe.onerror = () => {
    toast.info('PDF downloaded. Open the file to print if the print dialog did not appear.');
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  document.body.appendChild(iframe);
  cleanup();
};

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Voice Correction Parser
// ═══════════════════════════════════════════════════════════════

const parseVoiceCorrections = (transcript) => {
  const spoken = String(transcript || '').trim();
  if (!spoken || isYesAnswer(spoken) || isNoAnswer(spoken)) return [];

  const fieldAliases = INTERVIEW_FIELDS.map((field) => {
    const baseLabel = field.label.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    const baseKey = field.key.replace(/_/g, ' ');
    const extras = [];
    if (field.key === 'date') extras.push('date of birth', 'birthday', 'birth date', 'birthdate');
    if (field.key === 'sex') extras.push('gender');
    if (field.key === 'gross_annual_income') extras.push('income', 'salary', 'annual income');
    if (field.key === 'icr_no') extras.push('icr number');
    return {
      ...field,
      aliases: Array.from(new Set([
        field.key, baseKey, baseLabel,
        baseLabel.replace('complete ', ''),
        ...extras.filter(Boolean),
      ])),
    };
  });

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
  cueMs: 140,         // short beep, then start listening
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

  const playCue = (ctx) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* no cue is fine */ }
  };

  const listenOnce = useCallback(async ({ fieldKey, onStart, onTranscribing, onEnd, onError, vad }) => {
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

    playCue(ctx);
    await new Promise((r) => setTimeout(r, cfg.cueMs));

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
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - started;
      const current = level();
      if (elapsed < cfg.calibrateMs) {
        noise += current;
        noiseSamples += 1;
        return;
      }
      const threshold = Math.max(0.012, (noise / Math.max(noiseSamples, 1)) * 2.5);
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
        const { data } = await speechAPI.transcribe(file, fieldKey, { timeout: 20000 });
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

    recorder.start(250);
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
  }, [cancelSpeech, stopBrowserListening, whisper, setStatusMessage, setPhase]);

  const moveToNextQuestion = useCallback(() => {
    const index = currentFieldIndexRef.current;
    const nextIndex = nextFieldIndex(index, answersRef.current);
    if (nextIndex >= INTERVIEW_FIELDS.length) {
      setPhase(PHASE.CONFIRMING);
      setStatusMessage('All questions answered. Please check the details.');
      window.setTimeout(() => {
        if (conversationActiveRef.current) startVoiceReview();
      }, 150);
      return;
    }
    if (nextIndex > index + 1 && INTERVIEW_FIELDS[index + 1].key === 'icr_no') {
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

  // How many times each question was answered with something unusable.
  const attemptsRef = useRef({});
  const MAX_ATTEMPTS = 3;
  const countAttempt = (fieldIndex) => {
    attemptsRef.current[fieldIndex] = (attemptsRef.current[fieldIndex] || 0) + 1;
    return attemptsRef.current[fieldIndex];
  };

  const askQuestion = useCallback((fieldIndex = currentFieldIndexRef.current) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    currentFieldIndexRef.current = fieldIndex;
    setCurrentFieldIndex(fieldIndex);
    setDraftAnswer(answersRef.current[field.key] || '');
    setAwaitingConfirmation(false);
    setPhase(PHASE.ASKING);
    setStatusMessage(`Asking about your ${field.label.toLowerCase()}`);
    addChatMessage('assistant', field.question);
    speak(field.question, () => listenForAnswer(fieldIndex));
  }, [speak, setCurrentFieldIndex, setDraftAnswer, setAwaitingConfirmation, setStatusMessage, setPhase, addChatMessage]);

  // Whisper -> (handleSpokenAnswer) DistilBERT + Regex -> voice read-back.
  const listenForAnswer = useCallback((fieldIndex) => {
    if (!conversationActiveRef.current) return;
    const field = INTERVIEW_FIELDS[fieldIndex];
    listenOnce({
      fieldKey: field.key,   // Whisper gets a hint for this question (e.g. Baungon barangays)
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
  }, [listenOnce, speak, setDraftAnswer, setVoiceError, setStatusMessage, setPhase]);

  // Save a confirmed answer and go to the next question.
  const acceptAnswer = useCallback((fieldIndex, result) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    attemptsRef.current[fieldIndex] = 0;
    saveSpokenAnswer(fieldIndex, result.value || '');
    addChatMessage('assistant', `${field.label}: ${result.display || result.value || 'none'}`, describeMethods(result.methods));
    setStatusMessage('Next question...');
    moveToNextQuestion();
  }, [saveSpokenAnswer, moveToNextQuestion, setStatusMessage, addChatMessage]);

  // Too many unusable answers: leave the field blank for the review step instead of looping forever.
  const giveUpOnField = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    attemptsRef.current[fieldIndex] = 0;
    const msg = `Let's skip your ${field.label.toLowerCase()} for now. The staff can fill it in at the review.`;
    addChatMessage('assistant', msg);
    speak(msg, moveToNextQuestion);
  }, [speak, moveToNextQuestion, addChatMessage]);

  // ── Every answer is confirmed: "Dela Cruz. Is that correct?" ──
  // Speech recognition will sometimes get an answer wrong (local names especially), so
  // nothing is saved until the applicant says yes. "No" leads to spelling letter by
  // letter for names and places, or to asking the question again for the rest.
  const confirmAnswer = useCallback((fieldIndex, result, { spelled = '' } = {}) => {
    const shown = result.display || result.value;
    let prompt;
    if (spelled) prompt = `I have ${spellOut(spelled)}. ${result.value}. Is that correct?`;
    else if (result.needs_confirmation && result.message) prompt = result.message;  // "I heard Nails. Is that the place where you were born?"
    else prompt = `${shown}. Is that correct?`;
    setDraftAnswer(result.value || '');
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Say yes if it is correct, or no to fix it.');
    addChatMessage('assistant', prompt, describeMethods(result.methods));
    speak(prompt, () => listenForConfirmation(fieldIndex, result));
  }, [speak, setDraftAnswer, setPhase, setStatusMessage, addChatMessage]);

  // The answer was wrong: spell it (names, places) or ask again (dates, numbers, choices).
  const fixAnswer = useCallback((fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    if (countAttempt(fieldIndex) >= MAX_ATTEMPTS + 1) {
      giveUpOnField(fieldIndex);
      return;
    }
    if (SPELLABLE_KEYS.has(field.key)) {
      startSpelling(fieldIndex);
      return;
    }
    const msg = `Okay. Please say your ${field.label.toLowerCase().replace(/\s*\(.*\)/, '')} again.`;
    addChatMessage('assistant', msg);
    speak(msg, () => listenForAnswer(fieldIndex));
  }, [speak, giveUpOnField, addChatMessage]);

  const listenForConfirmation = useCallback((fieldIndex, result, silentTries = 0) => {
    listenOnce({
      fieldKey: 'confirm',             // Whisper hint: yes / no / opo / hindi
      vad: { noSpeechMs: 5000 },
      onStart: () => {
        setPhase(PHASE.LISTENING);
        setStatusMessage('Listening for yes or no...');
      },
      onError: () => {},
      onEnd: (heard, meta = {}) => {
        if (!conversationActiveRef.current) return;
        const reply = heard.trim();
        if (!reply) {
          if (silentTries >= 1) {
            // Still no reply: keep the answer; it is shown on screen and checked again at the review.
            acceptAnswer(fieldIndex, result);
            return;
          }
          speak('Please say yes or no.', () => listenForConfirmation(fieldIndex, result, silentTries + 1));
          return;
        }
        addChatMessage('user', reply, describeEngine(meta));
        if (isYesAnswer(reply)) {
          acceptAnswer(fieldIndex, result);
        } else if (isNoAnswer(reply)) {
          fixAnswer(fieldIndex);
        } else if (SPELLABLE_KEYS.has(INTERVIEW_FIELDS[fieldIndex].key) && looksSpelled(reply)) {
          startSpelling(fieldIndex, reply);           // they went straight to spelling it
        } else {
          handleSpokenAnswer(fieldIndex, reply, meta); // they simply said the right answer
        }
      },
    });
  }, [listenOnce, speak, acceptAnswer, fixAnswer, setPhase, setStatusMessage, addChatMessage]);

  // ── Letter-by-letter spelling (the fallback) ──
  // The applicant spells at their own pace; letters appear on screen as they are heard.
  // "space" between words, "delete" removes the last letter, "start over" clears, "done" finishes.
  const spelledRef = useRef('');

  const startSpelling = useCallback((fieldIndex, firstChunk = '') => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    spelledRef.current = '';
    if (firstChunk) {
      const { text } = applySpelling('', firstChunk);
      spelledRef.current = text;
      setDraftAnswer(text.toUpperCase());
      finishSpelling(fieldIndex);
      return;
    }
    const prompt = `Please spell your ${field.label.toLowerCase()} letter by letter. Say space between words, and say done when you finish.`;
    setPhase(PHASE.ASKING);
    setStatusMessage('Spell it letter by letter, then say "done".');
    setDraftAnswer('');
    addChatMessage('assistant', prompt);
    speak(prompt, () => listenForLetters(fieldIndex));
  }, [speak, setDraftAnswer, setPhase, setStatusMessage, addChatMessage]);

  const listenForLetters = useCallback((fieldIndex, silentTries = 0) => {
    listenOnce({
      fieldKey: 'spelling',            // Whisper hint: letters spelled one by one
      vad: { silenceMs: 1700, noSpeechMs: 7000, maxMs: 25000 },   // people pause between letters
      onStart: () => {
        setPhase(PHASE.LISTENING);
        const sofar = spelledRef.current.toUpperCase();
        setStatusMessage(sofar ? `Spelled so far: ${sofar}  (say "done" when finished)` : 'Listening for letters...');
      },
      onError: () => {},
      onEnd: (heard, meta = {}) => {
        if (!conversationActiveRef.current) return;
        const reply = heard.trim();
        if (!reply) {
          if (spelledRef.current.trim()) {
            finishSpelling(fieldIndex);       // they stopped spelling: read it back
            return;
          }
          if (silentTries >= 1) {
            giveUpOnField(fieldIndex);
            return;
          }
          speak('Please spell it letter by letter, for example: D, E, L, A.', () => listenForLetters(fieldIndex, silentTries + 1));
          return;
        }
        addChatMessage('user', reply, describeEngine(meta));
        const { text, done } = applySpelling(spelledRef.current, reply);
        spelledRef.current = text;
        setDraftAnswer(text.toUpperCase());
        setStatusMessage(`Spelled so far: ${text.toUpperCase() || '(nothing yet)'}`);
        if (done && text.trim()) finishSpelling(fieldIndex);
        else listenForLetters(fieldIndex);    // keep listening quietly for more letters
      },
    });
  }, [listenOnce, speak, giveUpOnField, setDraftAnswer, setPhase, setStatusMessage, addChatMessage]);

  const finishSpelling = useCallback(async (fieldIndex) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const letters = spelledRef.current.trim();
    if (!letters) {
      startSpelling(fieldIndex);
      return;
    }
    let result;
    try {
      result = await interpretAnswer(field.key, titleCaseSpelled(letters));
    } catch {
      return;
    }
    if (!conversationActiveRef.current) return;
    if (!result.ok || !result.value) {
      const msg = `${result.message || "That doesn't look right."} Let's spell it again.`;
      addChatMessage('assistant', msg);
      speak(msg, () => startSpelling(fieldIndex));
      return;
    }
    // Keep exactly what was spelled (e.g. "Dela Cruz"), not a re-guessed version.
    confirmAnswer(fieldIndex, { ...result, value: result.value, display: result.value }, { spelled: letters });
  }, [speak, confirmAnswer, addChatMessage]);

  const handleSpokenAnswer = useCallback(async (fieldIndex, transcript, heardBy = {}) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const spokenValue = transcript.trim();

    if (!spokenValue && !field.optional) {
      if (countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
        giveUpOnField(fieldIndex);
        return;
      }
      setPhase(PHASE.RETRY);
      setStatusMessage("I didn't hear an answer. Asking again...");
      speak(pickRandom(RETRY_PHRASES), () => askQuestion(fieldIndex));
      return;
    }

    if (spokenValue) addChatMessage('user', spokenValue, describeEngine(heardBy));
    setPhase(PHASE.THINKING);
    setStatusMessage('Understanding your answer...');

    let result;
    try {
      result = await interpretAnswer(field.key, spokenValue);
    } catch {
      return; // session expired: the API client sends the user to the login page
    }
    if (!conversationActiveRef.current) return;

    if (!result.ok) {
      if (result.reason !== 'unclear' && countAttempt(fieldIndex) >= MAX_ATTEMPTS) {
        giveUpOnField(fieldIndex);
        return;
      }
      setPhase(PHASE.RETRY);
      setStatusMessage(result.message);
      addChatMessage('assistant', result.message, result.reason === 'unclear' ? '' : describeMethods(result.methods, 'Checked'));
      // "What?" / "Pakiulit" -> repeat the whole question; otherwise say what is needed and listen again.
      if (result.reason === 'unclear') speak(result.message, () => askQuestion(fieldIndex));
      else speak(result.message, () => listenForAnswer(fieldIndex));
      return;
    }

    // "None" for an optional question (no middle name, no ICR) needs no confirmation.
    if (!result.value && field.optional) {
      acceptAnswer(fieldIndex, result);
      return;
    }
    confirmAnswer(fieldIndex, result);
  }, [speak, askQuestion, acceptAnswer, confirmAnswer, giveUpOnField, setStatusMessage, setPhase, addChatMessage]);

  const startConversation = useCallback(async () => {
    if (isWhisperCaptureSupported()) {
      try {
        await whisper.prepare();   // ask for the microphone once, before the greeting
        engineRef.current = 'whisper';
        whisperFailuresRef.current = 0;
      } catch {
        setVoiceError('The microphone is blocked. Allow microphone access for this site (the lock icon in the address bar), or type the answers.');
        toast.error('Microphone access is needed for the voice interview.');
        return;
      }
    } else if (isSpeechSupported()) {
      engineRef.current = 'browser';
    } else {
      setVoiceError('This browser cannot record audio. Please use Chrome or Edge, or type the answers.');
      toast.error('Voice conversation is not supported in this browser.');
      return;
    }
    setVoiceError('');
    setIsConversationActive(true);
    conversationActiveRef.current = true;

    const startIndex = currentFieldIndexRef.current;
    const alreadyAnswered = Object.values(answersRef.current).some((v) => String(v || '').trim());
    const greeting = getConversationGreeting();
    // While the greeting plays, prepare every fixed question so each plays without waiting.
    window.setTimeout(() => prefetchSpeech(...INTERVIEW_FIELDS.map((f) => f.question), REVIEW_PROMPT), 300);

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
  }, [speak, askQuestion, setVoiceError, setStatusMessage, setPhase, addChatMessage]);

  // The details are shown on screen instead of being read aloud (the old read-back of
  // all 14 fields took about 53 seconds). One "yes" here issues the Cedula.
  const startVoiceReview = useCallback(() => {
    setStep('voice-review');
    setAwaitingConfirmation(true);
    setCurrentFieldIndex(0);
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Please check the details on the screen.');
    addChatMessage('assistant', REVIEW_PROMPT);
    speak(REVIEW_PROMPT, () => listenForReviewCorrections());
  }, [speak, setStep, setAwaitingConfirmation, setCurrentFieldIndex, setStatusMessage, setPhase, addChatMessage]);

  const issueNow = useCallback(() => {
    setIsConversationActive(false);
    conversationActiveRef.current = false;
    whisper.releaseMicrophone();
    setPhase(PHASE.ISSUING);
    setStatusMessage('Issuing Cedula...');
    addChatMessage('assistant', 'Thank you. Issuing your Cedula now, please wait.');
    speak('Thank you. Issuing your Cedula now, please wait.');
    issueForm();
  }, [speak, whisper, issueForm, setStatusMessage, setPhase, addChatMessage]);

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
          issueNow();
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
        speak(`I updated ${readable}. Is everything correct now? Say yes to issue your Cedula.`, () =>
          listenForReviewCorrections()
        );
      },
    });
  }, [listenOnce, speak, issueNow, setAnswers, setStatusMessage, setPhase, addChatMessage]);

  return {
    isConversationActive,
    isSpeaking,
    isListening,
    startConversation,
    stopConversation,
    startVoiceReview,
  };
}


// ═══════════════════════════════════════════════════════════════
// SECTION 8: Animated Sub-Components (inside same file)
// ═══════════════════════════════════════════════════════════════

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

const ChatBubble = React.memo(({ role, text, meta, isLatest }) => {
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
        {meta && (
          <div className={`mt-1 text-[11px] font-medium ${isAssistant ? 'text-gray-500' : 'text-indigo-100'}`}>{meta}</div>
        )}
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
  const navigate = useNavigate();
  const chatContainerRef = useRef(null);

  // ── Core State ──
  const [step, setStep] = useState('interview');
  // Manual entry is the safe default. Voice controls explicitly change this.
  const [inputMethod, setInputMethod] = useState('manual');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState('');
  const [ctcNumber, setCtcNumber] = useState('');
  // Usability survey offered after the CTC is issued
  const [survey, setSurvey] = useState({ open: false, transactionId: null, features: [] });
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
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

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      speechSequenceRef.current += 1;
      window.speechSynthesis?.cancel();
      speechAudioRef.current?.pause();
      recognitionRef.current?.abort?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Chat Helpers ──
  const addChatMessage = useCallback((role, text, meta = '') => {
    setChatHistory((prev) => [...prev, { role, text, meta, id: generateId() }]);
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
    if (!quiet) addChatMessage('user', `${field.label}: ${result.display || result.value || 'none'}`, describeMethods(result.methods));
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
  const issueForm = useCallback(async (event = null) => {
    const printWindow = event?.type === 'click' ? openPrintWindow() : null;
    const latestAnswers = answersRef.current;
    const hasRequired = REQUIRED_KEYS.every((key) => String(latestAnswers[key] || '').trim());

    if (!hasRequired) {
      printWindow?.close?.();
      toast.warning('Please complete the required information first.');
      speakText('Some required information is still missing. Let us review your answers again.', () =>
        startVoiceReview?.()
      );
      return;
    }

    setIsIssuing(true);
    setPhase(PHASE.ISSUING);
    setStatusMessage('Checking every answer...');
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
        printWindow?.close?.();
        setReviewErrors(problems);
        setIsIssuing(false);
        setPhase(PHASE.RETRY);
        setStatusMessage(`Please check: ${labels}`);
        setStep('review');
        toast.error(`Please check: ${labels}`);
        speakText(`Some answers need to be checked: ${labels}. Please look at the screen.`);
        return;
      }
      checkedAnswers = Object.fromEntries(Object.entries(data.results).map(([key, r]) => [key, r.value ?? '']));
      answersRef.current = checkedAnswers;
      setAnswers(checkedAnswers);
      setReviewErrors({});
    } catch (error) {
      if (error.response?.status === 401) {
        printWindow?.close?.();
        setIsIssuing(false);
        return;
      }
      console.warn('Answer check unavailable; using the basic checks only:', error);
    }
    setStatusMessage('Issuing your Cedula...');

    try {
      const formData = buildApplicantData(checkedAnswers);
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        printWindow?.close?.();
        toast.error(`Validation errors:\n${validationErrors.join('\n')}`);
        setIsIssuing(false);
        setPhase(PHASE.RETRY);
        speakText('I found some issues with your information. Please check the details below.');
        return;
      }

      const income = parseFloat(formData.gross_annual_income) || 0;
      const taxResult = await extractionAPI.computeTax(income);
      formData.tax_classification = taxResult.data?.tax_classification || formData.tax_classification;

      payload = {
        applicant_data: formData,
        input_method: inputMethod,
        raw_transcript: null,
      };

      const result = await formsAPI.issue(payload);
      const issuedCtc = result.data?.ctc_number;
      if (!issuedCtc) throw new Error('The server did not return a CTC number.');

      setCtcNumber(issuedCtc);
      const pdfResponse = await formsAPI.download(issuedCtc);
      downloadAndPrintPdf(pdfResponse.data, issuedCtc, printWindow);

      toast.success(`CTC ${issuedCtc} issued successfully.`);
      setSurvey({
        open: true,
        transactionId: result.data?.id ?? null,
        features: inputMethod === 'voice'
          ? ['voice_input', 'voice_feedback', 'form_generation']
          : ['form_generation'],
      });
      setStep('success');
      setPhase(PHASE.IDLE);
      speakText('Your Community Tax Certificate has been issued and downloaded. Thank you, and have a good day.');
    } catch (error) {
      printWindow?.close?.();
      console.error('Issue error:', error);
      console.error('Issue response:', error.response?.status, error.response?.data);
      console.error('Request payload:', payload);

      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        const msgs = errorDetail.map((err) => `${err.loc?.join('.') || 'unknown'}: ${err.msg}`);
        toast.error(`Validation errors:\n${msgs.join('\n')}`);
      } else if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else {
        toast.error(getApiErrorMessage(error, 'Unable to issue the Cedula. Please check all fields.'));
      }
      setPhase(PHASE.RETRY);
      speakText("I ran into a problem issuing the certificate. Let's check the details, or ask staff for help.");
    } finally {
      setIsIssuing(false);
      setStatusMessage('Ready');
    }
  }, [speakText, inputMethod]);

  const printIssuedCtc = useCallback(async (numberToPrint) => {
    const printWindow = openPrintWindow();
    try {
      const pdfResponse = await formsAPI.download(numberToPrint);
      downloadAndPrintPdf(pdfResponse.data, numberToPrint, printWindow);
      toast.success('PDF opened for printing.');
    } catch (error) {
      printWindow?.close?.();
      console.error('Print error:', error);
      toast.error('Unable to open the Cedula PDF for printing.');
    }
  }, []);

  // ── Reset ──
  const resetInterview = useCallback(() => {
    setStep('interview');
    setCurrentFieldIndex(0);
    setAnswers({});
    setDraftAnswer('');
    setCtcNumber('');
    setFieldError('');
    setReviewErrors({});
    setConsentGiven(false);   // the next applicant sees the privacy notice again
    setSurvey({ open: false, transactionId: null, features: [] });
    setAwaitingConfirmation(false);
    setChatHistory([]);
    setStatusMessage('Ready');
    setPhase(PHASE.IDLE);
    setVoiceError('');
    window.speechSynthesis?.cancel();
    speechAudioRef.current?.pause();
  }, []);

  // ── Conversation Engine Hook ──
  const {
    isConversationActive,
    startConversation,
    stopConversation,
    startVoiceReview,
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
  });

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
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <FaCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Cedula Issued</h1>
          <p className="mt-3 text-gray-600 text-lg">
            CTC number{' '}
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{ctcNumber}</span>{' '}
            was saved and the PDF was downloaded.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {/* Records: the Dashboard is admin-only, so staff were bounced back here. */}
            <button onClick={() => navigate('/records')} className="btn-secondary inline-flex items-center gap-2">
              <FaArrowLeft /> Records
            </button>
            <button
              onClick={() => printIssuedCtc(ctcNumber)}
              disabled={!ctcNumber}
              className="btn-success inline-flex items-center gap-2 disabled:opacity-50"
            >
              <FaPrint /> Print PDF
            </button>
            <button onClick={resetInterview} className="btn-primary inline-flex items-center gap-2">
              <FaRegEdit /> New Application
            </button>
          </div>
        </div>
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
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confirming Your Information</h1>
            <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
              Please check the <strong>Applicant Answers</strong>. Say <strong>"yes"</strong> if everything is
              correct and the Cedula will be issued, or say a change such as <em>"change surname to Cruz."</em>
            </p>
          </div>

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div
              ref={chatContainerRef}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4 max-h-[400px] overflow-y-auto"
            >
              {chatHistory.map((msg, i) => (
                <ChatBubble key={msg.id} role={msg.role} text={msg.text} meta={msg.meta} isLatest={i === chatHistory.length - 1} />
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
                  {awaitingConfirmation
                    ? 'Ready to issue your Cedula — please confirm.'
                    : "I've collected the following information from our conversation."}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PhaseIndicator phase={phase} />
                  {isIssuing && (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                      <LoadingSpinner size="sm" /> Issuing...
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
            onClick={issueForm}
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <ConsentNotice
        open={!consentGiven}
        onAgree={() => setConsentGiven(true)}
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
              <ChatBubble key={msg.id} role={msg.role} text={msg.text} meta={msg.meta} isLatest={i === chatHistory.length - 1} />
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
                  {currentField.question}
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

          {/* Input Area */}
          <div className="p-5">
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="answer-input">
              {currentField.label}
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
              placeholder={currentField.hint}
              className={`input-field resize-none text-base w-full ${fieldError ? '!border-rose-400' : ''}`}
              aria-label={`Answer for ${currentField.label}`}
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
              Press <strong>Start Conversation</strong> and the assistant will ask every question, check each
              answer, confirm name spelling, read back the full summary once, and confirm before issuing.
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
