import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  FaRegEdit,
  FaStop,
  FaUserTie,
} from 'react-icons/fa';
import { speechAPI } from '../api/speech';
import { extractionAPI } from '../api/extraction';
import { formsAPI } from '../api/forms';
import LoadingSpinner from '../components/common/LoadingSpinner';

const interviewFields = [
  {
    key: 'surname',
    label: 'Surname',
    question: 'Good day. What is your surname?',
    hint: 'Example: Santos',
  },
  {
    key: 'given_name',
    label: 'Given name',
    question: 'Thank you. What is your given name?',
    hint: 'Example: Maria',
  },
  {
    key: 'middle_name',
    label: 'Middle name',
    question: 'What is your middle name?',
    hint: 'Leave blank if none',
  },
  {
    key: 'address',
    label: 'Complete address',
    question: 'Please tell me your complete address.',
    hint: 'House number, street, barangay, city or municipality',
  },
  {
    key: 'date',
    label: 'Date of birth',
    question: 'What is your date of birth? Please say it in year-month-day format, like 1990-01-15.',
    hint: 'Example: 1990-01-15',
  },
  {
    key: 'sex',
    label: 'Sex',
    question: 'What is your sex? Please say Male or Female.',
    hint: 'Say Male or Female',
  },
  {
    key: 'civil_status',
    label: 'Civil status',
    question: 'What is your civil status? Please say Single, Married, Widowed, or Separated.',
    hint: 'Single, Married, Widowed, or Separated',
  },
  {
    key: 'citizenship',
    label: 'Citizenship',
    question: 'What is your citizenship?',
    hint: 'Example: Filipino',
  },
  {
    key: 'icr_no',
    label: 'ICR number',
    question: 'Do you have an ICR number?',
    hint: 'Leave blank if not applicable',
  },
  {
    key: 'place_of_birth',
    label: 'Place of birth',
    question: 'Where were you born?',
    hint: 'City or municipality and province',
  },
  {
    key: 'height',
    label: 'Height (cm)',
    question: 'What is your height in centimeters?',
    hint: 'Example: 165',
  },
  {
    key: 'weight',
    label: 'Weight (kg)',
    question: 'What is your weight in kilograms?',
    hint: 'Example: 60',
  },
  {
    key: 'occupation',
    label: 'Occupation',
    question: 'What is your occupation?',
    hint: 'Example: Teacher',
  },
  {
    key: 'gross_annual_income',
    label: 'Gross annual income',
    question: 'What is your gross annual income in pesos?',
    hint: 'Example: 240000',
  },
];

const requiredKeys = interviewFields
  .filter((field) => field.key !== 'middle_name' && field.key !== 'icr_no')
  .map((field) => field.key);

const spellingKeys = ['surname', 'given_name', 'middle_name'];

const cleanText = (value) => String(value || '').trim() || null;

const cleanNumber = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  return cleaned ? Number(cleaned) : null;
};

const getApiErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(' ');
  }
  return fallback;
};

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

const isBlankAnswer = (value) => /^(none|no|not applicable|n\/a|blank)$/i.test(String(value || '').trim());

const isYesAnswer = (value) =>
  /^(yes|yeah|yep|correct|right|that is correct|that's correct|spelling is correct|okay|ok|sure|confirm|confirmed)$/i.test(
    String(value || '').trim()
  );

const isNoAnswer = (value) =>
  /^(no|nope|not correct|that is wrong|that's wrong|incorrect|wrong|cancel|stop)$/i.test(String(value || '').trim());

const normalizeSpelledName = (value) => {
  const text = String(value || '').trim();
  const singleLetters = text.match(/\b[a-z]\b/gi);

  if (singleLetters && singleLetters.length >= 2) {
    return singleLetters.join('');
  }

  return text.replace(/[^a-z]/gi, '');
};

const fieldAliases = interviewFields.map((field) => {
  const baseLabel = field.label.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  const baseKey = field.key.replace(/_/g, ' ');

  return {
    ...field,
    aliases: Array.from(
      new Set([
        field.key,
        baseKey,
        baseLabel,
        baseLabel.replace('complete ', ''),
        field.key === 'date' ? 'date of birth' : '',
        field.key === 'gross_annual_income' ? 'income' : '',
        field.key === 'icr_no' ? 'icr number' : '',
      ].filter(Boolean))
    ),
  };
});

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseVoiceCorrections = (transcript) => {
  const spoken = String(transcript || '').trim();
  if (!spoken || isYesAnswer(spoken) || isNoAnswer(spoken)) return [];

  const matches = [];

  fieldAliases.forEach((field) => {
    field.aliases.forEach((alias) => {
      const pattern = new RegExp(
        `\\b(?:change|update|correct|set)?\\s*(?:my\\s+)?${escapeRegExp(alias)}\\s*(?:is|to|as|into|equals)\\s*`,
        'gi'
      );
      let match = pattern.exec(spoken);

      while (match) {
        matches.push({
          key: field.key,
          label: field.label,
          start: match.index,
          valueStart: pattern.lastIndex,
        });
        match = pattern.exec(spoken);
      }
    });
  });

  const uniqueMatches = matches
    .sort((a, b) => a.start - b.start || b.valueStart - a.valueStart)
    .filter((match, index, sorted) => index === 0 || match.start !== sorted[index - 1].start);

  return uniqueMatches
    .map((match, index) => {
      const next = uniqueMatches[index + 1];
      const rawValue = spoken.slice(match.valueStart, next ? next.start : spoken.length);
      const value = rawValue
        .replace(/^\s*(and|also|then|please)\s+/i, '')
        .replace(/[,.!?;:]+$/g, '')
        .trim();

      return value ? { key: match.key, label: match.label, value } : null;
    })
    .filter(Boolean);
};

// ✅ IMPROVED: Validate date format
const validateDate = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
};

// ✅ IMPROVED: Validate civil status
const validateCivilStatus = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  const validStatuses = ['single', 'married', 'widowed', 'separated'];
  const found = validStatuses.find((s) => trimmed.includes(s) || s.includes(trimmed));
  if (found) {
    return found.charAt(0).toUpperCase() + found.slice(1);
  }
  return null;
};

// ✅ IMPROVED: Validate sex
const validateSex = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (trimmed === 'male' || trimmed === 'm') return 'Male';
  if (trimmed === 'female' || trimmed === 'f') return 'Female';
  return null;
};

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
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
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
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));

  for (let sampleIndex = 0; sampleIndex < samplesPerChannel; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

// Resamples to 16kHz mono, which is what Whisper expects — browsers don't
// reliably honor a forced sampleRate on a plain AudioContext, so we render
// through an OfflineAudioContext instead.
const convertRecordingToWav = async (blob) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return blob;

  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);

    const targetSampleRate = 16000;
    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = decoded;

    if (decoded.numberOfChannels > 1) {
      const merger = offlineContext.createChannelMerger(1);
      const splitter = offlineContext.createChannelSplitter(decoded.numberOfChannels);
      source.connect(splitter);
      for (let i = 0; i < decoded.numberOfChannels; i += 1) {
        splitter.connect(merger, i, 0);
      }
      merger.connect(offlineContext.destination);
    } else {
      source.connect(offlineContext.destination);
    }

    source.start(0);
    const rendered = await offlineContext.startRendering();
    return audioBufferToWavBlob(rendered);
  } finally {
    audioContext.close?.();
  }
};

// ✅ CORRECTED: Build applicant data with proper validation
const buildApplicantData = (answers) => {
  return {
    surname: String(answers.surname || '').trim(),
    given_name: String(answers.given_name || '').trim(),
    middle_name: cleanText(answers.middle_name),
    address: String(answers.address || '').trim(),
    sex: validateSex(answers.sex),
    civil_status: validateCivilStatus(answers.civil_status),
    citizenship: String(answers.citizenship || 'Filipino').trim(),
    place_of_birth: cleanText(answers.place_of_birth),
    occupation: cleanText(answers.occupation),
    gross_annual_income: cleanNumber(answers.gross_annual_income),
    tax_classification: answers.tax_classification || 'A',
    date_of_birth: validateDate(answers.date),
    icr_number: cleanText(answers.icr_no),
    height_cm: cleanNumber(answers.height),
    weight_kg: cleanNumber(answers.weight),
  };
};

// ✅ Validate form data before sending
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

  if (formData.date_of_birth) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(formData.date_of_birth)) {
      errors.push('Date of birth must be in YYYY-MM-DD format');
    }
  }

  if (formData.gross_annual_income && formData.gross_annual_income < 0) {
    errors.push('Gross annual income must be a positive number');
  }

  return errors;
};

const downloadAndPrintPdf = (pdfData, ctcNumber) => {
  const url = window.URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = `CTC_${ctcNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.src = url;

  printFrame.onload = () => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch (error) {
      toast.info('PDF downloaded. Open the file to print if the print dialog did not appear.');
    }

    window.setTimeout(() => {
      document.body.removeChild(printFrame);
      window.URL.revokeObjectURL(url);
    }, 60000);
  };

  document.body.appendChild(printFrame);
};

// Generic one-shot voice listener. Used both for capturing answers and for
// yes/no confirmations during the review pass.
const listenOnce = ({ onStart, onResult, onError, onEnd }) => {
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

  recognition.onstart = () => onStart?.();

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const heardText = (finalTranscript || interimTranscript).trim();
    if (heardText) {
      finalText = heardText;
      onResult?.(heardText, Boolean(finalTranscript));
    }
  };

  recognition.onerror = (event) => onError?.(event.error);

  recognition.onend = () => onEnd?.(finalText);

  recognition.start();
  return recognition;
};

const NewApplication = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('interview');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draftAnswer, setDraftAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isBrowserListening, setIsBrowserListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [conversationStatus, setConversationStatus] = useState('Ready');
  const [voiceError, setVoiceError] = useState('');
  const [ctcNumber, setCtcNumber] = useState('');
  const [awaitingFinalConfirmation, setAwaitingFinalConfirmation] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const answersRef = useRef({});
  const capturedSpeechRef = useRef('');
  const currentFieldIndexRef = useRef(0);
  const conversationActiveRef = useRef(false);

  const currentField = interviewFields[currentFieldIndex];
  const answeredCount = useMemo(
    () => interviewFields.filter((field) => String(answers[field.key] || '').trim()).length,
    [answers]
  );
  const progress = Math.round((answeredCount / interviewFields.length) * 100);
  const isLastQuestion = currentFieldIndex === interviewFields.length - 1;
  const canReview = requiredKeys.every((key) => String(answers[key] || '').trim());

  useEffect(() => {
    setDraftAnswer(answers[currentField.key] || '');
    currentFieldIndexRef.current = currentFieldIndex;
  }, [answers, currentField.key, currentFieldIndex]);

  useEffect(() => {
    currentFieldIndexRef.current = currentFieldIndex;
  }, [currentFieldIndex]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speakText = (text, onEnd) => {
    if (!window.speechSynthesis) {
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const saveAnswer = (options = {}) => {
    const value = draftAnswer.trim();
    const isOptional = currentField.key === 'middle_name' || currentField.key === 'icr_no';

    if (!value && !isOptional) {
      toast.warning(`Please answer ${currentField.label.toLowerCase()} before continuing.`);
      return;
    }

    setAnswers((prev) => ({ ...prev, [currentField.key]: value }));

    if (options.advance) {
      if (isLastQuestion) {
        setStep('review');
      } else {
        setCurrentFieldIndex((index) => index + 1);
      }
    }
  };

  const moveToNextQuestion = () => {
    const index = currentFieldIndexRef.current;

    if (index >= interviewFields.length - 1) {
      setConversationStatus('All questions answered. Reviewing your information.');
      window.setTimeout(() => {
        if (conversationActiveRef.current) {
          startVoiceReview();
        }
      }, 400);
      return;
    }

    const nextIndex = index + 1;
    currentFieldIndexRef.current = nextIndex;
    setCurrentFieldIndex(nextIndex);

    window.setTimeout(() => {
      if (conversationActiveRef.current) {
        askQuestion(nextIndex);
      }
    }, 450);
  };

  const saveSpokenAnswer = (fieldIndex, value) => {
    const field = interviewFields[fieldIndex];
    setDraftAnswer(value);
    setAnswers((prev) => {
      const nextAnswers = { ...prev, [field.key]: value };
      answersRef.current = nextAnswers;
      return nextAnswers;
    });
  };

  const handleSpokenAnswer = (fieldIndex, transcript) => {
    const field = interviewFields[fieldIndex];
    const isOptional = field.key === 'middle_name' || field.key === 'icr_no';
    const spokenValue = transcript.trim();

    if (!spokenValue && !isOptional) {
      setConversationStatus('No answer heard. Asking again.');
      speakText('I did not hear your answer. Let me ask again.', () => askQuestion(fieldIndex));
      return;
    }

    const finalValue = isBlankAnswer(spokenValue) && isOptional ? '' : spokenValue;
    saveSpokenAnswer(fieldIndex, finalValue);

    if (spellingKeys.includes(field.key) && finalValue) {
      setConversationStatus(`Captured "${finalValue}". Checking spelling.`);
      speakText(
        `I heard ${finalValue}. Is the spelling correct? Say yes, or spell your ${field.label.toLowerCase()} letter by letter.`,
        () => {
          listenForSpeech('spelling', fieldIndex, finalValue);
        }
      );
      return;
    }

    setConversationStatus(`Saved ${field.label}. Moving to next question.`);
    speakText('Thank you. Let us continue.', moveToNextQuestion);
  };

  const handleSpelledAnswer = (fieldIndex, baseAnswer, transcript) => {
    const field = interviewFields[fieldIndex];
    const spelledName = isYesAnswer(transcript) ? '' : normalizeSpelledName(transcript);
    const finalValue = spelledName || baseAnswer;

    saveSpokenAnswer(fieldIndex, finalValue);
    setConversationStatus(`Saved ${field.label}: ${finalValue || 'blank'}.`);
    speakText(`Thank you. I saved ${finalValue || 'blank'}. Let us continue.`, moveToNextQuestion);
  };

  const listenForSpeech = (mode, fieldIndex, baseAnswer = '') => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setVoiceError('Browser voice conversation is not supported here. Please type the answer or use Chrome or Edge.');
      setIsConversationActive(false);
      conversationActiveRef.current = false;
      return;
    }

    const recognition = new SpeechRecognition();
    capturedSpeechRef.current = '';
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceError('');
      setIsBrowserListening(true);
      setConversationStatus(mode === 'spelling' ? 'Listening for letter-by-letter spelling...' : 'Listening for the answer...');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const heardText = (finalTranscript || interimTranscript).trim();
      if (heardText) {
        capturedSpeechRef.current = heardText;
        setDraftAnswer(mode === 'spelling' ? baseAnswer : heardText);
      }
    };

    recognition.onerror = (event) => {
      const message =
        event.error === 'no-speech'
          ? 'I did not hear speech. Asking again.'
          : `Voice recognition failed: ${event.error}. Please type the answer if it continues.`;
      setVoiceError(message);
      toast.error(message);
    };

    recognition.onend = () => {
      setIsBrowserListening(false);
      recognitionRef.current = null;

      if (!conversationActiveRef.current) {
        return;
      }

      const transcript = capturedSpeechRef.current.trim();
      if (mode === 'spelling') {
        handleSpelledAnswer(fieldIndex, baseAnswer, transcript);
      } else {
        handleSpokenAnswer(fieldIndex, transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const askQuestion = (fieldIndex = currentFieldIndexRef.current) => {
    const field = interviewFields[fieldIndex];
    currentFieldIndexRef.current = fieldIndex;
    setCurrentFieldIndex(fieldIndex);
    setDraftAnswer(answers[field.key] || '');
    setAwaitingFinalConfirmation(false);
    setConversationStatus(`Asking: ${field.label}`);
    speakText(field.question, () => listenForSpeech('answer', fieldIndex));
  };

  // Starts (or resumes) the hands-free conversation. On a genuine first
  // start it greets the applicant before asking the first question.
  const startConversation = () => {
    if (!getSpeechRecognition()) {
      setVoiceError('Hands-free conversation needs Chrome or Edge browser speech recognition. You can still type answers manually.');
      toast.error('Voice conversation is not supported in this browser.');
      return;
    }

    setIsConversationActive(true);
    conversationActiveRef.current = true;

    const startIndex = currentFieldIndexRef.current;
    const alreadyAnswered = Object.values(answers).some((value) => String(value || '').trim());

    if (!alreadyAnswered && startIndex === 0 && step === 'interview') {
      setConversationStatus('Greeting applicant...');
      speakText(
        'Good day! I am the barangay staff assistant. I will help you apply for your Community Tax Certificate. Please answer each question after you hear it, speaking naturally.',
        () => askQuestion(0)
      );
    } else {
      askQuestion(startIndex);
    }
  };

  const stopConversation = () => {
    setIsConversationActive(false);
    conversationActiveRef.current = false;
    setConversationStatus('Conversation paused');
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
    setIsBrowserListening(false);
    setIsSpeaking(false);
  };

  const getReviewSummary = () =>
    interviewFields.map((field) => `${field.label}: ${answersRef.current[field.key] || 'blank'}`).join('. ');

  // Voice review pass: read all answers once, then let the applicant name one
  // or more fields to update in a single response.
  const startVoiceReview = () => {
    setStep('voice-review');
    setAwaitingFinalConfirmation(false);
    setCurrentFieldIndex(0);
    setConversationStatus('Reading back all answers for confirmation.');
    speakText(
      `Please listen to the full summary. ${getReviewSummary()}. If everything is correct, say yes. If something needs changing, say the field and the new value. For example, say change surname to Cruz and occupation to teacher.`,
      () => listenForReviewCorrections()
    );
  };

  const listenForReviewCorrections = () => {
    if (!conversationActiveRef.current) return;

    recognitionRef.current = listenOnce({
      onStart: () => {
        setVoiceError('');
        setIsBrowserListening(true);
        setConversationStatus('Listening for corrections or approval...');
      },
      onError: (error) => {
        setIsBrowserListening(false);
        if (error === 'no-speech') {
          speakText('I did not hear anything. Say yes if everything is correct, or say what needs to be changed.', () =>
            listenForReviewCorrections()
          );
        }
      },
      onEnd: (heard) => {
        setIsBrowserListening(false);
        recognitionRef.current = null;
        if (!conversationActiveRef.current) return;

        const trimmed = heard.trim();

        if (!trimmed) {
          speakText('I did not hear anything. Say yes if everything is correct, or say what needs to be changed.', () =>
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
          speakText(
            'I did not understand the correction. Please say it like this: change surname to Cruz and address to Barangay One.',
            () => listenForReviewCorrections()
          );
          return;
        }

        setAnswers((prev) => {
          const nextAnswers = { ...prev };
          corrections.forEach((correction) => {
            const isOptional = correction.key === 'middle_name' || correction.key === 'icr_no';
            nextAnswers[correction.key] = isBlankAnswer(correction.value) && isOptional ? '' : correction.value;
          });
          answersRef.current = nextAnswers;
          return nextAnswers;
        });

        const readableCorrections = corrections
          .map((correction) => `${correction.label} to ${correction.value}`)
          .join(', ');

        setConversationStatus(`Updated ${corrections.length} field${corrections.length > 1 ? 's' : ''}.`);
        speakText(`Got it, I updated ${readableCorrections}. Shall I proceed to issue the Cedula now?`, () =>
          listenForIssueConfirmation()
        );
      },
    });
  };

  const confirmIssue = () => {
    setStep('voice-review');
    setAwaitingFinalConfirmation(true);
    setConversationStatus('Ready to issue. Awaiting confirmation.');
    speakText(
      'Thank you. I have confirmed all your information. Shall I proceed to issue and print your Community Tax Certificate now? Please say yes to confirm, or no to cancel.',
      () => listenForIssueConfirmation()
    );
  };

  const listenForIssueConfirmation = () => {
    recognitionRef.current = listenOnce({
      onStart: () => {
        setVoiceError('');
        setIsBrowserListening(true);
      },
      onError: () => {
        setIsBrowserListening(false);
      },
      onEnd: (heard) => {
        setIsBrowserListening(false);
        recognitionRef.current = null;
        if (!conversationActiveRef.current) return;

        const trimmed = heard.trim();

        if (isYesAnswer(trimmed)) {
          setIsConversationActive(false);
          conversationActiveRef.current = false;
          setConversationStatus('Issuing Cedula...');
          speakText('Confirmed. Issuing your Cedula now, please wait.');
          issueForm();
        } else if (isNoAnswer(trimmed)) {
          speakText("Okay, I will not issue it yet. Let's review your answers again.", () => {
            startVoiceReview();
          });
        } else {
          speakText('Sorry, I did not understand. Please say yes to confirm, or no to cancel.', () =>
            listenForIssueConfirmation()
          );
        }
      },
    });
  };

  const startBrowserDictation = () => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      return false;
    }

    const recognition = new SpeechRecognition();
    const startingAnswer = draftAnswer.trim();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceError('');
      setIsBrowserListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const nextAnswer = [startingAnswer, finalTranscript || interimTranscript]
        .filter(Boolean)
        .join(' ')
        .trim();

      setDraftAnswer(nextAnswer);
      if (finalTranscript.trim()) {
        setAnswers((prev) => ({ ...prev, [currentField.key]: nextAnswer }));
      }
    };

    recognition.onerror = (event) => {
      const message =
        event.error === 'no-speech'
          ? 'I did not hear speech. Please try again or type the answer.'
          : `Browser dictation failed: ${event.error}. You can type the answer instead.`;
      setVoiceError(message);
      toast.error(message);
    };

    recognition.onend = () => {
      setIsBrowserListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  };

  const startRecording = async () => {
    try {
      setVoiceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        await transcribeAnswer(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error('Microphone access was blocked or unavailable.');
    }
  };

  const startVoiceAnswer = () => {
    if (startBrowserDictation()) {
      return;
    }

    startRecording();
  };

  const stopVoiceInput = () => {
    if (isConversationActive) {
      stopConversation();
      return;
    }

    if (isBrowserListening) {
      recognitionRef.current?.stop?.();
      setIsBrowserListening(false);
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAnswer = async (blob) => {
    setIsTranscribing(true);
    try {
      const wavBlob = await convertRecordingToWav(blob);
      const file = new File([wavBlob], 'answer.wav', { type: 'audio/wav' });
      const response = await speechAPI.transcribe(file, currentField.key);
      const text = (response.data?.transcript || response.data?.text || '').trim();

      if (!text) {
        toast.warning('I did not catch that. Please try again or type the answer.');
        return;
      }

      setDraftAnswer(text);
      setAnswers((prev) => ({ ...prev, [currentField.key]: text }));
      toast.success(`${currentField.label} captured.`);
    } catch (error) {
      const message = getApiErrorMessage(error, 'Voice processing failed. You can type the answer instead.');
      setVoiceError(message);
      toast.error(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const goToField = (index) => {
    stopConversation();
    saveAnswer();
    setCurrentFieldIndex(index);
    currentFieldIndexRef.current = index;
    setStep('interview');
  };

  const updateReviewField = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const playVerification = async () => {
    const readable = interviewFields
      .map((field) => `${field.label}: ${answers[field.key] || 'blank'}`)
      .join('. ');

    if (!window.speechSynthesis) {
      try {
        await speechAPI.verify(answers);
        toast.success('Verification sent to backend voice service.');
      } catch (error) {
        toast.error('Unable to play verification.');
      }
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Please verify the information. ${readable}`);
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // ✅ Issue form with payload declared outside try block, validation, and voice feedback
  const issueForm = async () => {
    const latestAnswers = answersRef.current;
    const hasRequiredAnswers = requiredKeys.every((key) => String(latestAnswers[key] || '').trim());

    if (!hasRequiredAnswers) {
      toast.warning('Please complete the required information first.');
      speakText('Some required information is still missing. Let us review your answers again.', () =>
        startVoiceReview()
      );
      return;
    }

    setIsIssuing(true);
    let payload = null;

    try {
      const formData = buildApplicantData(latestAnswers);

      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        toast.error(`Validation errors:\n${validationErrors.join('\n')}`);
        setIsIssuing(false);
        speakText('I found some issues with your information. Please check the details below.');
        return;
      }

      const income = parseFloat(formData.gross_annual_income) || 0;
      const taxResult = await extractionAPI.computeTax(income);
      formData.tax_classification = taxResult.data?.tax_classification || formData.tax_classification;

      payload = {
        applicant_data: formData,
        input_method: 'voice',
        raw_transcript: null,
      };

      const result = await formsAPI.issue(payload);
      const issuedCtc = result.data?.ctc_number;
      if (!issuedCtc) {
        throw new Error('The server did not return a CTC number.');
      }
      setCtcNumber(issuedCtc);

      const pdfResponse = await formsAPI.download(issuedCtc);
      downloadAndPrintPdf(pdfResponse.data, issuedCtc);

      toast.success(`CTC ${issuedCtc} issued successfully.`);
      setStep('success');
      speakText('Your Community Tax Certificate has been issued and downloaded. Thank you, and have a good day.');
    } catch (error) {
      console.error('Issue error:', error);
      console.error('Request payload:', payload);

      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        const errorMessages = errorDetail.map((err) => {
          const field = err.loc?.join('.') || 'unknown';
          return `${field}: ${err.msg}`;
        });
        toast.error(`Validation errors:\n${errorMessages.join('\n')}`);
        console.error('Validation errors:', errorMessages);
      } else if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else {
        toast.error('Unable to issue the Cedula. Please check all fields.');
      }
      speakText('I ran into a problem issuing the certificate. Please check the details, or ask staff for help.');
    } finally {
      setIsIssuing(false);
    }
  };

  const resetInterview = () => {
    setStep('interview');
    setCurrentFieldIndex(0);
    setAnswers({});
    setDraftAnswer('');
    setCtcNumber('');
    setAwaitingFinalConfirmation(false);
  };

  if (step === 'success') {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <FaCheck />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Cedula issued</h1>
        <p className="mt-2 text-gray-600">
          CTC number <span className="font-semibold text-indigo-700">{ctcNumber}</span> was saved and the PDF was downloaded.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary inline-flex items-center gap-2">
            <FaArrowLeft /> Dashboard
          </button>
          <button onClick={resetInterview} className="btn-primary inline-flex items-center gap-2">
            <FaRegEdit /> New application
          </button>
        </div>
      </div>
    );
  }

  if (step === 'voice-review') {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confirming your information</h1>
            <p className="mt-1 text-sm text-gray-600">
              I'm reading back all captured answers once. Say "yes" if everything is correct, or say one or more
              changes such as "change surname to Cruz and occupation to teacher."
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <FaUserTie />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm font-semibold text-indigo-700">Barangay staff assistant</div>
                <div className="rounded-lg rounded-tl-none bg-gray-100 p-4 text-lg font-medium text-gray-900">
                  {awaitingFinalConfirmation
                    ? 'Ready to issue your Cedula — please confirm.'
                    : 'Reviewing all answers — please listen to the full summary.'}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {isSpeaking && (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600">
                      <FaPlay /> Speaking...
                    </span>
                  )}
                  {isBrowserListening && (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" /> Listening now
                    </span>
                  )}
                  {isIssuing && (
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                      <LoadingSpinner size="sm" /> Issuing...
                    </span>
                  )}
                  <span className="text-sm text-gray-600">{conversationStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {voiceError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
              <FaRegEdit /> Switch to manual review
            </button>
          </div>
        </div>

        <aside className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900">Applicant answers</h2>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-auto p-2">
            {interviewFields.map((field, index) => {
              const value = answers[field.key];
              const isActive = index === currentFieldIndex && !awaitingFinalConfirmation;

              return (
                <div
                  key={field.key}
                  className={`mb-2 w-full rounded-lg border p-3 text-left ${
                    isActive ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">{field.label}</span>
                    {value ? <FaCheck className="shrink-0 text-emerald-600" /> : null}
                  </div>
                  <div className="mt-1 truncate text-sm text-gray-500">{value || 'No answer yet'}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verify applicant information</h1>
            <p className="mt-1 text-sm text-gray-600">Confirm the details with the applicant before issuing the Cedula.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={playVerification} className="btn-secondary inline-flex items-center justify-center gap-2">
              {isSpeaking ? <FaPause /> : <FaPlay />} Read back
            </button>
            <button
              onClick={() => {
                setIsConversationActive(true);
                conversationActiveRef.current = true;
                startVoiceReview();
              }}
              className="btn-secondary inline-flex items-center justify-center gap-2"
            >
              <FaMicrophone /> Voice review
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {interviewFields.map((field, index) => (
              <div key={field.key} className="border-b border-gray-100 p-4 md:odd:border-r">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-600">{field.label}</label>
                  <button
                    type="button"
                    onClick={() => goToField(index)}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    Ask again
                  </button>
                </div>
                <input
                  value={answers[field.key] || ''}
                  onChange={(event) => updateReviewField(field.key, event.target.value)}
                  placeholder={field.hint}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>

        {!canReview && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Some required fields are still blank. Fill them in or ask those questions again.
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => setStep('interview')} className="btn-secondary inline-flex items-center gap-2">
            <FaArrowLeft /> Back to interview
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

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Cedula application</h1>
            <p className="mt-1 text-sm text-gray-600">Question {currentFieldIndex + 1} of {interviewFields.length}</p>
          </div>
          <div className="min-w-48">
            <div className="mb-1 flex justify-between text-xs font-medium text-gray-600">
              <span>Completed</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <FaUserTie />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm font-semibold text-indigo-700">Barangay staff assistant</div>
                <div className="rounded-lg rounded-tl-none bg-gray-100 p-4 text-lg font-medium text-gray-900">
                  {currentField.question}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!isConversationActive ? (
                    <button
                      onClick={startConversation}
                      disabled={isTranscribing}
                      className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaPlay /> Start conversation
                    </button>
                  ) : (
                    <button onClick={stopConversation} className="btn-secondary inline-flex items-center gap-2">
                      <FaPause /> Pause conversation
                    </button>
                  )}
                  <span className="text-sm text-gray-600">{conversationStatus}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">{currentField.label}</label>
            <textarea
              value={draftAnswer}
              onChange={(event) => setDraftAnswer(event.target.value)}
              rows={4}
              placeholder={currentField.hint}
              className="input-field resize-none text-base"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {!isRecording && !isBrowserListening ? (
                  <button
                    onClick={startVoiceAnswer}
                    disabled={isTranscribing}
                    className="btn-danger inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <FaMicrophone /> Answer once by voice
                  </button>
                ) : (
                  <button onClick={stopVoiceInput} className="btn-secondary inline-flex items-center gap-2">
                    <FaStop /> Stop listening
                  </button>
                )}
                {isBrowserListening && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" /> Listening now
                  </span>
                )}
                {isTranscribing && (
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                    <LoadingSpinner size="sm" /> Sending audio to backend
                  </span>
                )}
              </div>

              <button
                onClick={() => saveAnswer({ advance: true })}
                disabled={isConversationActive || isRecording || isBrowserListening || isTranscribing}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                Save typed answer <FaArrowRight />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Press Start conversation when the applicant is ready. The assistant will ask every question, check
              name spelling, read back the full summary once, and ask before issuing.
            </p>
            {voiceError && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {voiceError}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary inline-flex items-center gap-2">
            <FaArrowLeft /> Cancel
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                saveAnswer();
                setCurrentFieldIndex((index) => Math.max(0, index - 1));
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

      <aside className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900">Applicant answers</h2>
          <p className="mt-1 text-xs text-gray-500">{answeredCount} of {interviewFields.length} fields captured</p>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-auto p-2">
          {interviewFields.map((field, index) => {
            const value = answers[field.key];
            const isActive = index === currentFieldIndex;

            return (
              <button
                key={field.key}
                type="button"
                onClick={() => goToField(index)}
                className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700">{field.label}</span>
                  {value ? <FaCheck className="shrink-0 text-emerald-600" /> : null}
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
