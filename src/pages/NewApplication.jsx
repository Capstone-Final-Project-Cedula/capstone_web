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
import LoadingSpinner from '../components/common/LoadingSpinner';

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Constants & Configuration
// ═══════════════════════════════════════════════════════════════

const INTERVIEW_FIELDS = [
  {
    key: 'surname',
    label: 'Surname',
    question: "What is your surname?",
    hint: 'Example: Santos',
    requiresSpellingCheck: true,
  },
  {
    key: 'given_name',
    label: 'Given name',
    question: "Thank you. What is your given name?",
    hint: 'Example: Maria',
    requiresSpellingCheck: true,
  },
  {
    key: 'middle_name',
    label: 'Middle name',
    question: "What is your middle name?",
    hint: 'Leave blank if none',
    optional: true,
    requiresSpellingCheck: true,
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
    question: "What is your date of birth? Please say it in this format: month-day-year, like 01-15-1990.",
    hint: 'Example: 01-15-1990 (Month-Day-Year)',
  },
  {
    key: 'sex',
    label: 'Sex',
    question: "Could you tell me your sex?",
    hint: 'Say Male or Female',
  },
  {
    key: 'civil_status',
    label: 'Civil status',
    question: "What is your current civil status?",
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
    question: "Do you have an ICR number?",
    hint: 'Leave blank if not applicable',
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
    question: "What is your height in centimeters?",
    hint: 'Example: 165',
  },
  {
    key: 'weight',
    label: 'Weight (kg)',
    question: "What is your weight in kilograms?",
    hint: 'Example: 60',
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
    question: "What is your gross annual income in pesos?",
    hint: 'Example: 240000',
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

const getConversationGreeting = () =>
  `${getTimeGreeting()}! I am your barangay staff assistant. I will help you apply for your Community Tax Certificate. Please answer each question after you hear it, speaking naturally.`;

const CONVERSATION_TRANSITIONS = [
  "Great, thanks.",
  "Noted.",
  "Got it.",
  "Thank you.",
  "Appreciate that.",
  "Perfect, thank you.",
  "All set.",
  "Understood.",
];

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

const getApiErrorMessage = (error, fallback = "Something didn't go through. Let's try that again.") => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(' ');
  }
  if (error.response?.data) return JSON.stringify(error.response.data);
  return fallback;
};

const getSpeechRecognition = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const isSpeechSupported = () => Boolean(getSpeechRecognition());

const isBlankAnswer = (value) =>
  /^(none|no|not applicable|n\/a|blank|skip)$/i.test(String(value || '').trim());

const isYesAnswer = (value) =>
  /^(yes|yeah|yep|correct|right|that is correct|that's correct|spelling is correct|okay|ok|sure|confirm|confirmed|proceed|go ahead)$/i.test(
    String(value || '').trim()
  );

const isNoAnswer = (value) =>
  /^(no|nope|not correct|that is wrong|that's wrong|incorrect|wrong|cancel|stop|don't|do not|nevermind)$/i.test(
    String(value || '').trim()
  );

const normalizeSpelledName = (value) => {
  const text = String(value || '').trim();
  const singleLetters = text.match(/\b[a-z]\b/gi);
  if (singleLetters && singleLetters.length >= 2) {
    return singleLetters.join('');
  }
  return text.replace(/[^a-z]/gi, '');
};

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
    const response = await apiClient.post(
      '/speech/synthesize',
      { text: spoken, rate: SPEECH_RATE },
      { responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(response.data);
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
    sex: sex || 'Male',
    civil_status: civilStatus || 'Single',
    citizenship: titleCaseWords(answers.citizenship || 'Filipino'),
    place_of_birth: cleanText(titleCaseWords(answers.place_of_birth)),
    occupation: cleanText(titleCaseWords(answers.occupation)),
    gross_annual_income: cleanNumber(answers.gross_annual_income) || 0,
    tax_classification: answers.tax_classification || 'A',
    date_of_birth: dob || '2000-01-01',
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
  if (formData.sex && !['Male', 'Female'].includes(formData.sex)) {
    errors.push('Sex must be Male or Female');
  }
  if (formData.civil_status && !['Single', 'Married', 'Widowed', 'Separated'].includes(formData.civil_status)) {
    errors.push('Civil status must be Single, Married, Widowed, or Separated');
  }
  if (formData.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(formData.date_of_birth)) {
    errors.push('Date of birth must be in YYYY-MM-DD format');
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
    if (field.key === 'date') extras.push('date of birth');
    if (field.key === 'gross_annual_income') extras.push('income');
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

/**
 * Hook: useMediaRecorder
 * Records audio from microphone for backend transcription.
 */
function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async (onStop) => {
    try {
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
        await onStop?.(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      return true;
    } catch {
      toast.error('Microphone access was blocked or unavailable.');
      return false;
    }
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  return { isRecording, startRecording, stopRecording };
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
  const { isListening, listenOnce, stopListening: stopBrowserListening } = useBrowserSpeechRecognition();
  const [isConversationActive, setIsConversationActive] = useState(false);

  const answersRef = useRef(answers);
  const currentFieldIndexRef = useRef(currentFieldIndex);
  const conversationActiveRef = useRef(false);
  const capturedSpeechRef = useRef('');

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
  }, [cancelSpeech, stopBrowserListening, setStatusMessage, setPhase]);

  const moveToNextQuestion = useCallback(() => {
    const index = currentFieldIndexRef.current;
    if (index >= INTERVIEW_FIELDS.length - 1) {
      setPhase(PHASE.CONFIRMING);
      setStatusMessage('All questions answered. Reviewing your information.');
      window.setTimeout(() => {
        if (conversationActiveRef.current) startVoiceReview();
      }, 400);
      return;
    }
    const nextIndex = index + 1;
    currentFieldIndexRef.current = nextIndex;
    setCurrentFieldIndex(nextIndex);
    window.setTimeout(() => {
      if (conversationActiveRef.current) askQuestion(nextIndex);
    }, 450);
  }, [setCurrentFieldIndex, setStatusMessage, setPhase]);

  const saveSpokenAnswer = useCallback((fieldIndex, value) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const finalValue = validateFieldValue(field.key, value);
    setDraftAnswer(finalValue);
    setAnswers((prev) => {
      const next = { ...prev, [field.key]: finalValue };
      answersRef.current = next;
      return next;
    });
    addChatMessage('user', finalValue || '(blank)');
  }, [setAnswers, setDraftAnswer, addChatMessage]);

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

  const listenForAnswer = useCallback((fieldIndex) => {
    if (!conversationActiveRef.current) return;
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError('Browser voice conversation is not supported here. Please type the answer or use Chrome or Edge.');
      setIsConversationActive(false);
      conversationActiveRef.current = false;
      setPhase(PHASE.IDLE);
      return;
    }

    const recognition = new SpeechRecognition();
    capturedSpeechRef.current = '';
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceError('');
      setPhase(PHASE.LISTENING);
      setStatusMessage('Listening for your answer...');
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
        capturedSpeechRef.current = heard;
        setDraftAnswer(heard);
      }
    };

    recognition.onerror = (event) => {
      const msg = event.error === 'no-speech'
        ? "I didn't catch that. Let me ask again."
        : `Voice recognition had a hiccup: ${event.error}. Please type if it keeps happening.`;
      setVoiceError(msg);
    };

    recognition.onend = () => {
      if (!conversationActiveRef.current) return;
      setPhase(PHASE.THINKING);
      const transcript = capturedSpeechRef.current.trim();
      handleSpokenAnswer(fieldIndex, transcript);
    };

    recognition.start();
  }, [setDraftAnswer, setVoiceError, setStatusMessage, setPhase]);

  const handleSpokenAnswer = useCallback((fieldIndex, transcript) => {
    const field = INTERVIEW_FIELDS[fieldIndex];
    const isOptional = field.optional;
    const spokenValue = transcript.trim();

    if (!spokenValue && !isOptional) {
      setPhase(PHASE.RETRY);
      setStatusMessage("I didn't hear an answer. Asking again...");
      speak(pickRandom(RETRY_PHRASES), () => askQuestion(fieldIndex));
      return;
    }

    const finalValue = isBlankAnswer(spokenValue) && isOptional ? '' : spokenValue;
    saveSpokenAnswer(fieldIndex, finalValue);

    if (field.requiresSpellingCheck && finalValue) {
      setStatusMessage(`I heard "${finalValue}". Checking the spelling...`);
      speak(
        `I heard ${finalValue}. Is the spelling correct? Say yes, or spell your ${field.label.toLowerCase()} letter by letter.`,
        () => listenForSpelling(fieldIndex, finalValue)
      );
      return;
    }

    const transition = pickRandom(CONVERSATION_TRANSITIONS);
    setStatusMessage(`${transition} Moving to the next question.`);
    speak(transition, moveToNextQuestion);
  }, [speak, saveSpokenAnswer, moveToNextQuestion, askQuestion, setStatusMessage, setPhase]);

  const listenForSpelling = useCallback((fieldIndex, baseAnswer) => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    capturedSpeechRef.current = '';
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setPhase(PHASE.LISTENING);
      setStatusMessage('Listening for letter-by-letter spelling...');
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
      if (heard) capturedSpeechRef.current = heard;
    };

    recognition.onend = () => {
      if (!conversationActiveRef.current) return;
      setPhase(PHASE.THINKING);
      const transcript = capturedSpeechRef.current.trim();
      const spelledName = isYesAnswer(transcript) ? '' : normalizeSpelledName(transcript);
      const finalValue = spelledName || baseAnswer;
      saveSpokenAnswer(fieldIndex, finalValue);
      setStatusMessage(`Saved ${INTERVIEW_FIELDS[fieldIndex].label}: ${finalValue || 'blank'}.`);
      speak(`Thank you. I've saved that. Let's continue.`, moveToNextQuestion);
    };

    recognition.start();
  }, [saveSpokenAnswer, moveToNextQuestion, setStatusMessage, setPhase, speak]);

  const startConversation = useCallback(() => {
    if (!isSpeechSupported()) {
      setVoiceError('Hands-free conversation needs Chrome or Edge browser speech recognition. You can still type answers manually.');
      toast.error('Voice conversation is not supported in this browser.');
      return;
    }
    setIsConversationActive(true);
    conversationActiveRef.current = true;

    const startIndex = currentFieldIndexRef.current;
    const alreadyAnswered = Object.values(answersRef.current).some((v) => String(v || '').trim());
    const greeting = getConversationGreeting();

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

  const getReviewSummary = useCallback(() =>
    INTERVIEW_FIELDS.map((f) => `${f.label}: ${answersRef.current[f.key] || 'blank'}`).join('. '),
  []);

  const startVoiceReview = useCallback(() => {
    setStep('voice-review');
    setAwaitingConfirmation(false);
    setCurrentFieldIndex(0);
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Reading back all answers for confirmation.');
    const summary = getReviewSummary();
    const msg = `Please listen to the full summary. ${summary}. If everything is correct, say yes. If something needs changing, say the field and the new value. For example, say change surname to Cruz and occupation to teacher.`;
    addChatMessage('assistant', "Here's everything I've collected. I'll read it back once.");
    speak(msg, () => listenForReviewCorrections());
  }, [speak, setStep, setAwaitingConfirmation, setCurrentFieldIndex, setStatusMessage, setPhase, getReviewSummary, addChatMessage]);

  const listenForReviewCorrections = useCallback(() => {
    if (!conversationActiveRef.current) return;

    listenOnce({
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
      onEnd: (heard) => {
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
          confirmIssue();
          return;
        }

        const corrections = parseVoiceCorrections(trimmed);
        if (!corrections.length) {
          speak(
            "I didn't understand the correction. Please say it like this: change surname to Cruz and address to Barangay One.",
            () => listenForReviewCorrections()
          );
          return;
        }

        setAnswers((prev) => {
          const next = { ...prev };
          corrections.forEach((c) => {
            const field = FIELD_MAP[c.key];
            const isOptional = field?.optional;
            let finalValue = isBlankAnswer(c.value) && isOptional ? '' : c.value;
            finalValue = validateFieldValue(c.key, finalValue);
            next[c.key] = finalValue;
          });
          answersRef.current = next;
          return next;
        });

        const readable = corrections.map((c) => `${c.label} to ${c.value}`).join(', ');
        setStatusMessage(`Updated ${corrections.length} field${corrections.length > 1 ? 's' : ''}.`);
        addChatMessage('assistant', `Updated: ${readable}`);
        speak(`Got it, I updated ${readable}. Shall I proceed to issue the Cedula now?`, () =>
          listenForIssueConfirmation()
        );
      },
    });
  }, [listenOnce, speak, setAnswers, setStatusMessage, setPhase, addChatMessage]);

  const confirmIssue = useCallback(() => {
    setStep('voice-review');
    setAwaitingConfirmation(true);
    setPhase(PHASE.CONFIRMING);
    setStatusMessage('Ready to issue. Awaiting confirmation.');
    const msg = 'Thank you. I have confirmed all your information. Shall I proceed to issue and print your Community Tax Certificate now? Please say yes to confirm, or no to cancel.';
    addChatMessage('assistant', msg);
    speak(msg, () => listenForIssueConfirmation());
  }, [speak, setStep, setAwaitingConfirmation, setStatusMessage, setPhase, addChatMessage]);

  const listenForIssueConfirmation = useCallback(() => {
    listenOnce({
      onStart: () => {
        setVoiceError('');
        setPhase(PHASE.LISTENING);
      },
      onError: () => {},
      onEnd: (heard) => {
        if (!conversationActiveRef.current) return;
        setPhase(PHASE.THINKING);
        const trimmed = heard.trim();

        if (isYesAnswer(trimmed)) {
          setIsConversationActive(false);
          conversationActiveRef.current = false;
          setPhase(PHASE.ISSUING);
          setStatusMessage('Issuing Cedula...');
          addChatMessage('assistant', 'Confirmed. Issuing your Cedula now, please wait.');
          speak('Confirmed. Issuing your Cedula now, please wait.');
          issueForm();
        } else if (isNoAnswer(trimmed)) {
          speak("Okay, I won't issue it yet. Let's review your answers again.", () => {
            startVoiceReview();
          });
        } else {
          speak("Sorry, I didn't understand. Please say yes to confirm, or no to cancel.", () =>
            listenForIssueConfirmation()
          );
        }
      },
    });
  }, [listenOnce, speak, setStatusMessage, setPhase, issueForm, startVoiceReview, addChatMessage]);

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
const SummaryRow = React.memo(({ label, value, onChange, onAskAgain, highlighted }) => (
  <div
    className={`rounded-xl border p-3.5 transition-colors ${
      highlighted ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {String(value || '').trim() ? <FaCheck className="text-emerald-600" size={12} /> : null}
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
  useEffect(() => {
    setDraftAnswer(answers[currentField.key] || '');
    inputRef.current?.focus();
  }, [answers, currentField.key, currentFieldIndex]);

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

  // ── Save Answer ──
  const saveAnswer = useCallback((options = {}) => {
    const value = draftAnswer.trim();
    const isOptional = currentField.optional;

    if (!value && !isOptional) {
      toast.warning(`Please answer ${currentField.label.toLowerCase()} before continuing.`);
      return;
    }

    const finalValue = validateFieldValue(currentField.key, value);
    setAnswers((prev) => ({ ...prev, [currentField.key]: finalValue }));
    addChatMessage('user', finalValue || '(blank)');

    if (options.advance) {
      if (isLastQuestion) {
        setStep('review');
      } else {
        setCurrentFieldIndex((i) => i + 1);
      }
    }
  }, [draftAnswer, currentField, isLastQuestion, addChatMessage]);

  // ── Manual Voice Input (Browser Dictation) ──
  const startBrowserDictation = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    const startingAnswer = draftAnswer.trim();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceError('');
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
      const nextAnswer = [startingAnswer, finalTranscript || interimTranscript].filter(Boolean).join(' ').trim();
      setDraftAnswer(nextAnswer);
      if (finalTranscript.trim()) {
        setAnswers((prev) => ({ ...prev, [currentField.key]: validateFieldValue(currentField.key, nextAnswer) }));
      }
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
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [draftAnswer, currentField.key, setDraftAnswer, setAnswers, setVoiceError, setStatusMessage]);

  // ── Media Recorder (Backend Transcription) ──
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
        await transcribeAnswer(blob);
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

  const startVoiceAnswer = useCallback(() => {
    if (startBrowserDictation()) return;
    startRecording();
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
    setStatusMessage('Processing your answer...');
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

      const finalText = validateFieldValue(currentField.key, text);
      setDraftAnswer(finalText);
      setAnswers((prev) => ({ ...prev, [currentField.key]: finalText }));
      addChatMessage('user', finalText);
      toast.success(`${currentField.label} captured.`);
      setPhase(PHASE.IDLE);
      setStatusMessage(`${currentField.label} captured.`);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Voice processing failed. You can type the answer instead.');
      setVoiceError(message);
      toast.error(message);
      setPhase(PHASE.RETRY);
      setStatusMessage('Voice processing failed.');
    } finally {
      setIsTranscribing(false);
    }
  }, [currentField, addChatMessage]);

  // ── Navigation ──
  const goToField = useCallback((index) => {
    saveAnswer();
    setCurrentFieldIndex(index);
    setStep('interview');
    setStatusMessage(`Let's revisit your ${INTERVIEW_FIELDS[index].label.toLowerCase()}.`);
  }, [saveAnswer]);

  const updateReviewField = useCallback((key, value) => {
    const finalValue = validateFieldValue(key, value);
    setAnswers((prev) => ({ ...prev, [key]: finalValue }));
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
    setStatusMessage('Issuing your Cedula...');
    let payload = null;

    try {
      const formData = buildApplicantData(latestAnswers);
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
    isSpeaking: isConversationSpeaking,
    isListening: isConversationListening,
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
            <button onClick={() => navigate('/dashboard')} className="btn-secondary inline-flex items-center gap-2">
              <FaArrowLeft /> Dashboard
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
              I'm reading back everything I've collected. Say <strong>"yes"</strong> if it all looks right,
              or say one or more changes such as <em>"change surname to Cruz and occupation to teacher."</em>
            </p>
          </div>

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
              }}
              rows={4}
              placeholder={currentField.hint}
              className="input-field resize-none text-base w-full"
              aria-label={`Answer for ${currentField.label}`}
              disabled={isConversationActive}
            />

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
                {isTranscribing && <ThinkingDots label="Processing your answer..." />}
              </div>

              <button
                onClick={() => saveAnswer({ advance: true })}
                disabled={isConversationActive || isRecording || isBrowserListening || isTranscribing}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                Save & Continue <FaArrowRight />
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1.5">
              <FaCommentDots className="text-gray-400" size={12} />
              Press <strong>Start Conversation</strong> and the assistant will ask every question, check name
              spelling, read back the full summary once, and confirm before issuing.
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
          <button onClick={() => navigate('/dashboard')} className="btn-secondary inline-flex items-center gap-2">
            <FaArrowLeft /> Cancel
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                saveAnswer();
                setCurrentFieldIndex((i) => Math.max(0, i - 1));
              }}
              disabled={currentFieldIndex === 0}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <FaArrowLeft /> Previous
            </button>
            <button
              onClick={() => {
                saveAnswer();
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
