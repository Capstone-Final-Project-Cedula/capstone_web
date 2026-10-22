import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import NewApplication from './NewApplication';
import apiClient from '../api/client';
import { extractionAPI } from '../api/extraction';
import { speechAPI } from '../api/speech';

jest.mock('../api/client', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../api/extraction', () => ({ extractionAPI: { understandAnswer: jest.fn() } }));
jest.mock('../api/speech', () => ({ speechAPI: { transcribe: jest.fn() } }));
jest.mock('../components/interview/ConsentNotice', () => ({ open, onAgree }) => (
  open ? <button onClick={onAgree}>Agree for test</button> : null
));
jest.mock('../components/sus/SusSurveyDialog', () => () => null);

window.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let recordings;
let audio;
const originalAudio = window.Audio;
const originalRecognition = window.SpeechRecognition;
const originalCreateURL = window.URL.createObjectURL;
const originalRevokeURL = window.URL.revokeObjectURL;
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalRecorder = window.MediaRecorder;
const originalContext = window.AudioContext;
const originalOfflineContext = window.OfflineAudioContext;
const originalBlobBuffer = Blob.prototype.arrayBuffer;
let microphoneLevel;
let captures;

const button = (label) => [...container.querySelectorAll('button')]
  .find((element) => element.textContent.trim() === label);
const finishSpeech = async () => {
  await act(async () => audio.onended());
};
const reply = async (text = '') => {
  const recognition = recordings[recordings.length - 1];
  await act(async () => {
    if (text) {
      const result = [{ transcript: text }];
      result.isFinal = true;
      recognition.onresult({ resultIndex: 0, results: [result] });
    }
    recognition.onend();
  });
};

const listenAtField = async (label) => {
  await act(async () => button('Pause Conversation').click());
  await act(async () => container.querySelector(`[aria-label="Go to ${label}"]`).click());
  await act(async () => button('Start Conversation').click());
  await finishSpeech();
  await finishSpeech();
  extractionAPI.understandAnswer.mockClear();
};

const waitWithoutAnswer = async () => {
  const questionAudio = audio;
  const listens = recordings.length;
  for (let turn = 0; turn < 4; turn += 1) {
    await reply();
    await act(async () => jest.advanceTimersByTime(150));
    expect(audio).toBe(questionAudio); // No repeat question or "I missed that" before anyone speaks.
    expect(recordings).toHaveLength(listens + turn + 1);
    expect(extractionAPI.understandAnswer).not.toHaveBeenCalled();
  }
};

const listenWithWhisper = async () => {
  await act(async () => button('Pause Conversation').click());
  await act(async () => container.querySelector('[aria-label="Go to Weight (kg)"]').click());
  microphoneLevel = 0;
  captures = [];
  const track = { readyState: 'live', stop: jest.fn() };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue({ getAudioTracks: () => [track], getTracks: () => [track] }) },
  });
  window.MediaRecorder = class {
    static isTypeSupported() { return true; }
    state = 'inactive';
    start() { this.state = 'recording'; captures.push(this); }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new Blob(['test audio']) });
      this.onstop?.();
    }
  };
  window.AudioContext = class {
    state = 'running';
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { getFloatTimeDomainData: (buffer) => buffer.fill(microphoneLevel) }; }
    decodeAudioData() { return Promise.resolve({ duration: 1 }); }
    close() {}
  };
  window.OfflineAudioContext = class {
    createBufferSource() { return { connect() {}, start() {} }; }
    startRendering() {
      return Promise.resolve({ numberOfChannels: 1, length: 16000, sampleRate: 16000, getChannelData: () => new Float32Array(16000) });
    }
  };
  Blob.prototype.arrayBuffer = () => Promise.resolve(new ArrayBuffer(16));
  speechAPI.transcribe.mockResolvedValue({ data: { transcript: '65' } });
  extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value: '65' } });
  await act(async () => button('Start Conversation').click());
  await finishSpeech();
  await finishSpeech();
  extractionAPI.understandAnswer.mockClear();
};

beforeEach(async () => {
  jest.useFakeTimers();
  recordings = [];
  window.SpeechRecognition = class {
    start() { recordings.push(this); this.onstart(); }
    abort() {}
  };
  window.Audio = class {
    constructor() { audio = this; }
    play() { return Promise.resolve(); }
    pause() {}
  };
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  apiClient.post.mockResolvedValue({ data: new Blob() });
  extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value: 'Testname' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<NewApplication />));
  await act(async () => button('Agree for test').click());
  await act(async () => button('Start Conversation').click());
  await finishSpeech(); // Greeting ends; the surname question starts.
  await finishSpeech(); // Surname question ends; listening starts.
  await reply('Testname');
  expect(button('Yes, correct')).toBeDefined();
  await finishSpeech(); // Read-back ends; listening for confirmation starts.
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllTimers();
  jest.useRealTimers();
  window.Audio = originalAudio;
  window.SpeechRecognition = originalRecognition;
  window.URL.createObjectURL = originalCreateURL;
  window.URL.revokeObjectURL = originalRevokeURL;
  if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  else delete navigator.mediaDevices;
  window.MediaRecorder = originalRecorder;
  window.AudioContext = originalContext;
  window.OfflineAudioContext = originalOfflineContext;
  if (originalBlobBuffer) Blob.prototype.arrayBuffer = originalBlobBuffer;
  else delete Blob.prototype.arrayBuffer;
  jest.clearAllMocks();
});

test('repeated silence keeps the answer pending until a spoken yes', async () => {
  for (let turn = 0; turn < 2; turn += 1) {
    await reply();
    expect(button('Yes, correct')).toBeDefined();
    expect(container.textContent).not.toContain('Surname: Testname');
    expect(container.textContent).not.toContain('What is your given name?');
    await finishSpeech();
  }
  await reply('Yes');
  expect(container.textContent).toContain('Surname: Testname');
  expect(button('Yes, correct')).toBeUndefined();
  await act(async () => jest.advanceTimersByTime(150));
  expect(container.textContent).toContain('What is your given name?');
});

test('3 silences in a row at the yes/no step pause the listening and leave the Yes / No buttons', async () => {
  for (let turn = 0; turn < 3; turn += 1) {
    await reply();
    await finishSpeech();
  }
  const listens = recordings.length;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(recordings).toHaveLength(listens);
  expect(container.textContent).toContain('I did not hear a yes or no. Please tap Yes or No below.');
  expect(button('Yes, correct')).toBeDefined();
  await act(async () => button('Yes, correct').click());
  expect(container.textContent).toContain('Surname: Testname');
});

test('a filler at the yes/no step is not a yes and not a try', async () => {
  const readBack = audio;
  await reply('Um.');
  expect(audio).not.toBe(readBack);   // a new line is spoken ("Please say yes or no."), nothing is accepted
  expect(container.textContent).not.toContain('Surname: Testname');
  expect(button('No, say again')).toBeDefined();   // the ladder did not move
});

test('a spoken no after silence asks for the surname again without saving it', async () => {
  await reply();
  await finishSpeech();
  await reply('No');
  expect(container.textContent).toContain('Please say your surname again.');
  expect(container.textContent).not.toContain('Surname: Testname');
  expect(container.textContent).not.toContain('What is your given name?');
});

test('a Yes tap after silence accepts once and ignores the old listening callback', async () => {
  await reply();
  await finishSpeech();
  const oldRecognition = recordings[recordings.length - 1];
  await act(async () => button('Yes, correct').click());
  await act(async () => oldRecognition.onend());
  expect(container.textContent.match(/Surname: Testname/g)).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(150));
  expect(container.textContent).toContain('What is your given name?');
});

test('a recognition error keeps the answer pending and allows a button confirmation', async () => {
  const recognition = recordings[recordings.length - 1];
  const listens = recordings.length;
  await act(async () => {
    recognition.onerror({ error: 'network' });
    recognition.onend();
  });
  expect(recordings).toHaveLength(listens);
  expect(container.textContent).toContain('Please tap Yes or No below.');
  expect(container.textContent).not.toContain('Surname: Testname');
  expect(button('Yes, correct')).toBeDefined();
  await act(async () => button('Yes, correct').click());
  expect(container.textContent).toContain('Surname: Testname');
});

test('a browser no-speech event retries confirmation without accepting it', async () => {
  const recognition = recordings[recordings.length - 1];
  await act(async () => {
    recognition.onerror({ error: 'no-speech' });
    recognition.onend();
  });
  expect(button('Yes, correct')).toBeDefined();
  expect(container.textContent).not.toContain('Surname: Testname');
  await finishSpeech();
  expect(recordings).toHaveLength(3);
});

test('pausing after silence prevents the old confirmation callback from advancing', async () => {
  await reply();
  await finishSpeech();
  const recognition = recordings[recordings.length - 1];
  await act(async () => button('Pause Conversation').click());
  await act(async () => recognition.onend());
  await act(async () => jest.advanceTimersByTime(150));
  expect(button('Start Conversation')).toBeDefined();
  expect(container.textContent).not.toContain('Surname: Testname');
  expect(container.textContent).not.toContain('What is your given name?');
});

test.each(['Middle name', 'Weight (kg)'])(
  '%s keeps waiting through empty listening turns and accepts a later spoken answer',
  async (label) => {
    await listenAtField(label);
    await waitWithoutAnswer();
    extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value: 'Test answer' } });
    await reply('Test answer');
    expect(button('Yes, correct')).toBeDefined();
    expect(button('No, say again')).toBeDefined(); // Waiting did not consume the answer's spoken attempts.
  },
);

test('the birthplace town keeps waiting after the province has been answered', async () => {
  await listenAtField('Place of birth');
  extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value: 'Sample Province', normalized: '123' } });
  await reply('Sample Province');
  await finishSpeech();
  expect(container.textContent).toContain('Sample Province. Is that correct?');   // read back first (plan 006)
  expect(container.textContent).not.toContain('Which town or city in Sample Province');
  await reply('Yes');
  await finishSpeech();
  expect(container.textContent).toContain('Which town or city in Sample Province were you born in?');
  extractionAPI.understandAnswer.mockClear();
  await waitWithoutAnswer();
});

test('purok is left pending during silence; only saying none saves an empty answer', async () => {
  await listenAtField('Complete address');
  for (const value of ['Sample Town', 'Barangay Sample']) {
    extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value } });
    await reply(value);
    await finishSpeech();
    await reply('Yes');
    await act(async () => jest.advanceTimersByTime(150));
    await finishSpeech();
  }
  extractionAPI.understandAnswer.mockResolvedValue({ data: { ok: true, value: '' } });
  extractionAPI.understandAnswer.mockClear();
  await waitWithoutAnswer();
  expect(container.textContent).not.toContain('Purok or street: none');
  await reply('None');
  expect(container.textContent).toContain('Purok or street: none');
});

test('pausing during the quiet retry delay does not reopen the microphone', async () => {
  await listenAtField('Weight (kg)');
  const listens = recordings.length;
  await reply();
  await act(async () => button('Pause Conversation').click());
  await act(async () => jest.advanceTimersByTime(150));
  expect(recordings).toHaveLength(listens);
  expect(button('Start Conversation')).toBeDefined();
});

test('a previous listener cannot submit an answer after pausing and resuming the same question', async () => {
  await listenAtField('Weight (kg)');
  const previous = recordings[recordings.length - 1];
  await act(async () => button('Pause Conversation').click());
  await act(async () => button('Start Conversation').click());
  const greetingAudio = audio;
  extractionAPI.understandAnswer.mockClear();
  await act(async () => {
    const result = [{ transcript: '65' }];
    result.isFinal = true;
    previous.onresult({ resultIndex: 0, results: [result] });
    previous.onend();
  });
  expect(audio).toBe(greetingAudio);
  expect(extractionAPI.understandAnswer).not.toHaveBeenCalled();
});

test('Whisper keeps waiting through silent recording windows, then transcribes a real answer', async () => {
  await listenWithWhisper();
  const questionAudio = audio;
  for (let turn = 0; turn < 3; turn += 1) {
    await act(async () => jest.advanceTimersByTime(7300));
    expect(audio).toBe(questionAudio);
    expect(captures).toHaveLength(turn + 2);
    expect(speechAPI.transcribe).not.toHaveBeenCalled();
    expect(extractionAPI.understandAnswer).not.toHaveBeenCalled();
  }
  microphoneLevel = 0.1;
  await act(async () => jest.advanceTimersByTime(400));
  microphoneLevel = 0;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(speechAPI.transcribe).toHaveBeenCalledTimes(1);
  expect(button('Yes, correct')).toBeDefined();
});

test('a brief microphone click does not end the answer turn or trigger a spoken retry', async () => {
  await listenWithWhisper();
  const questionAudio = audio;
  await act(async () => jest.advanceTimersByTime(400));
  microphoneLevel = 0.1;
  await act(async () => jest.advanceTimersByTime(80));
  microphoneLevel = 0;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(captures).toHaveLength(1);
  expect(captures[0].state).toBe('recording');
  expect(audio).toBe(questionAudio);
  expect(speechAPI.transcribe).not.toHaveBeenCalled();
  expect(extractionAPI.understandAnswer).not.toHaveBeenCalled();
});

// ── Plan 006 ──────────────────────────────────────────────────────────────────

const BUKIDNON = { ok: true, value: 'Bukidnon', display: 'Bukidnon', normalized: '1001300000' };
const SAN_JOSE = [
  { value: 'San Jose, Batangas', town: 'San Jose', province: 'Batangas', province_psgc: '10' },
  { value: 'San Jose, Bohol', town: 'San Jose', province: 'Bohol', province_psgc: '20' },
  { value: 'San Jose, Tarlac', town: 'San Jose', province: 'Tarlac', province_psgc: '30' },
  { value: 'San Jose, Nueva Ecija', town: 'San Jose', province: 'Nueva Ecija', province_psgc: '40' },
];

// Serve /answer by field key: map[key](transcript, provinceCode) -> the backend's result.
const serve = (map) => extractionAPI.understandAnswer.mockImplementation(async (key, text, spoken, town, province) => ({
  data: (map[key] || (() => ({ ok: true, value: text })))(text, province),
}));
const say = async (text) => {
  await finishSpeech();
  await reply(text);
};
const yes = async () => {
  await finishSpeech();
  await reply('Yes');
  await act(async () => jest.advanceTimersByTime(150));
};

describe('place of birth in two read-back steps', () => {
  test('province, its read-back, town, its read-back; no "Were you born in" shortcut', async () => {
    await listenAtField('Place of birth');
    serve({
      place_of_birth_province: () => BUKIDNON,
      place_of_birth_town: () => ({ ok: true, value: 'Baungon, Bukidnon', normalized: '' }),
    });
    await reply('Bukidnon');
    expect(container.textContent).toContain('Bukidnon. Is that correct?');
    expect(container.textContent).not.toContain('Which town or city');
    await yes();
    expect(container.textContent).toContain('Which town or city in Bukidnon were you born in?');
    await say('Baungon');
    expect(container.textContent).toContain('Baungon, Bukidnon. Is that correct?');
    await yes();
    expect(container.textContent).toContain('Place of birth: Baungon, Bukidnon');
    expect(container.textContent).not.toContain('Were you born in');
  });

  test('a city with no province is read back and is the whole answer', async () => {
    await listenAtField('Place of birth');
    serve({ place_of_birth_province: () => ({ ok: true, value: 'Iligan City', normalized: '' }) });
    await reply('Iligan');
    expect(container.textContent).toContain('Iligan City. Is that correct?');
    await yes();
    expect(container.textContent).toContain('Place of birth: Iligan City');
    expect(container.textContent).not.toContain('Which town or city');
  });

  test('a town in several provinces asks "Which province is San Jose in?" (not a try); any candidate resolves it', async () => {
    await listenAtField('Place of birth');
    serve({
      place_of_birth_province: (text) => (/jose/i.test(text)
        ? { ok: false, reason: 'ambiguous_town', message: 'There is more than one San Jose.', candidates: SAN_JOSE }
        : { ok: true, value: text, normalized: '40' }),
    });
    await reply('San Jose');
    expect(container.textContent).toContain('Which province is San Jose in?');
    expect(button('No, say again')).toBeUndefined();   // nothing to read back yet
    await say('Nueva Ecija');    // the 4th candidate, beyond the 3 closest
    expect(container.textContent).toContain('San Jose, Nueva Ecija. Is that correct?');
    expect(button('No, say again')).toBeDefined();     // the clarification used no try
    await yes();
    expect(container.textContent).toContain('Place of birth: San Jose, Nueva Ecija');
  });

  test('a "no" to the read-back is a try and forgets the pending town', async () => {
    await listenAtField('Place of birth');
    serve({
      place_of_birth_province: (text) => (/jose/i.test(text)
        ? { ok: false, reason: 'ambiguous_town', message: 'More than one.', candidates: SAN_JOSE }
        : { ok: true, value: text, normalized: '20' }),
    });
    await reply('San Jose');
    await say('Bohol');
    await finishSpeech();
    const pendingQuestions = () => container.textContent.match(/Which province is San Jose in\?/g).length;
    const before = pendingQuestions();
    await reply('No');
    expect(container.textContent).toContain('Okay. Please say your place of birth again.');
    await finishSpeech();
    expect(container.textContent).not.toContain('Place of birth: San Jose');
    expect(pendingQuestions()).toBeLessThan(before);   // forgotten: the screen shows the province question again
    expect(container.textContent.match(/Which province were you born in\?/g).length).toBeGreaterThanOrEqual(2);
  });
});

// ── The ladder, question by question (plan 006 E) ─────────────────────────────
// 3 failed spoken tries, then (spellable questions only) 2 failed spellings, then the question is skipped.
const MISS = 'Not usable.';
const countCalls = () => extractionAPI.understandAnswer.mock.calls.length;
const failEverything = () => extractionAPI.understandAnswer.mockImplementation(
  async () => ({ data: { ok: false, reason: 'invalid', message: MISS } }),
);
const failedSpoken = async (times) => {
  for (let i = 0; i < times; i += 1) {
    await reply('zzz');
    await finishSpeech();
    await act(async () => jest.advanceTimersByTime(150));
  }
};
const failedSpelling = async (times) => {
  for (let i = 0; i < times; i += 1) {
    await finishSpeech();
    await finishSpeech();
    await reply('Z Z Z');
    await act(async () => jest.advanceTimersByTime(150));
  }
};

// [label shown on the "Go to" button, spellable]
const LADDER_QUESTIONS = [
  ['Surname', true], ['Given name', true], ['Middle name', true], ['Date of birth', false], ['Sex', false],
  ['Civil status', false], ['Citizenship', true], ['Height (cm)', false], ['Weight (kg)', false],
  ['Occupation', true], ['Gross annual income', false],
];

test.each(LADDER_QUESTIONS)('%s: 3 spoken tries, then spelling is %s, then skipped', async (label, spellable) => {
  await listenAtField(label);
  failEverything();
  await failedSpoken(3);
  if (spellable) {
    expect(container.textContent).toContain('Please spell your');
    await failedSpelling(2);
  } else {
    expect(container.textContent).not.toContain('Please spell your');
  }
  expect(container.textContent).toContain("for now. We will come back to it at the end.");
  expect(countCalls()).toBe(spellable ? 5 : 3);   // never a 4th spoken or a 3rd spelled try
  expect(container.textContent.match(/Please spell your/g) || []).toHaveLength(spellable ? 2 : 0);
});

test.each([[0, 'address_town'], [1, 'address_barangay'], [2, 'address_purok']])(
  'address part %s (%s): 3 spoken tries, no spelling, then the address is skipped',
  async (part, key) => {
    await listenAtField('Complete address');
    extractionAPI.understandAnswer.mockImplementation(async (askedKey, text) => ({
      data: askedKey === key ? { ok: false, reason: 'invalid', message: MISS } : { ok: true, value: text, normalized: '1' },
    }));
    for (let done = 0; done < part; done += 1) {
      await reply('Sample');
      await yes();
      await finishSpeech();
    }
    extractionAPI.understandAnswer.mockClear();
    await failedSpoken(3);
    expect(container.textContent).not.toContain('Please spell your');
    expect(container.textContent).toContain("Let's skip your complete address for now.");
    expect(countCalls()).toBe(3);
  },
);

describe.each([['province', 1], ['town', 2]])('place of birth, %s step', (name, step) => {
  test('3 spoken tries, 2 spelled, then the whole place is skipped', async () => {
    await listenAtField('Place of birth');
    if (step === 2) {
      serve({ place_of_birth_province: () => BUKIDNON });
      await reply('Bukidnon');
      await yes();
      await finishSpeech();
      extractionAPI.understandAnswer.mockClear();
    }
    failEverything();
    await failedSpoken(3);
    expect(container.textContent).toContain('Please spell your');
    await failedSpelling(2);
    expect(container.textContent).toContain("Let's skip your place of birth for now.");
    expect(countCalls()).toBe(5);
    expect(container.textContent.match(/Please spell your/g)).toHaveLength(2);
  });
});

describe.each([['Surname', true], ['Sex', false]])('what a "no" says, %s', (label, spellable) => {
  test('say it again after the 1st and 2nd no; spell (or skip) only after the 3rd', async () => {
    await listenAtField(label);
    extractionAPI.understandAnswer.mockImplementation(async (key, text) => ({ data: { ok: true, value: spellable ? 'Cruz' : 'Male' } }));
    const again = `Okay. Please say your ${label.toLowerCase()} again.`;
    for (let no = 1; no <= 2; no += 1) {
      await reply('Cruz');          // the answer, read back
      await finishSpeech();
      await reply('No');
      expect(container.textContent.match(new RegExp(again.replace(/[.]/g, '[.]'), 'g'))).toHaveLength(no);
      expect(container.textContent).not.toContain('Please spell your');
      expect(container.textContent).not.toContain('for now. We will come back');
      await finishSpeech();
    }
    await reply('Cruz');
    await finishSpeech();
    await reply('No');
    if (spellable) {
      expect(container.textContent).toContain("Let's spell it instead.");
      expect(container.textContent).toContain(`Please spell your ${label.toLowerCase()} letter by letter.`);
    } else {
      expect(container.textContent).toContain(`Let's skip your ${label.toLowerCase()} for now. We will come back to it at the end.`);
    }
  });
});

// ── The final approval is a whole-reply yes (plan 006 A) ─────────────────────
const CANNED = {
  surname: 'Cruz', given_name: 'Juan', middle_name: 'Reyes', address_barangay: 'Imbatug', address_purok: 'Purok 2',
  date: 'May 10, 1990', sex: 'Male', civil_status: 'Single', citizenship: 'Filipino', height: '165', weight: '60',
  occupation: 'Farmer', gross_annual_income: '0',
};
const serveCanned = () => extractionAPI.understandAnswer.mockImplementation(async (key, text) => {
  let data;
  if (key === 'address_town') data = { ok: true, value: 'Baungon, Bukidnon', normalized: '1001301000' };
  else if (key === 'place_of_birth_province') data = BUKIDNON;
  else if (key === 'place_of_birth_town') data = { ok: true, value: 'Baungon, Bukidnon', normalized: '' };
  else if (key in CANNED && !(key === 'surname' && /cruz/i.test(text) === false && text !== 'answer')) data = { ok: true, value: CANNED[key] };
  else data = { ok: true, value: text };
  return { data };
});

// Answer every question and say yes to every read-back until the review prompt is spoken.
const interviewToReview = async () => {
  await listenAtField('Surname');
  serveCanned();
  for (let step = 0; step < 150 && !container.textContent.includes('Please check your details on the screen'); step += 1) {
    await finishSpeech();
    await reply(button('Yes, correct') ? 'Yes' : 'answer');
    await act(async () => jest.advanceTimersByTime(200));
  }
  expect(container.textContent).toContain('Please check your details on the screen');
  await finishSpeech();   // the review prompt ends: listening for corrections
};

describe('final approval', () => {
  test('"Yes, my surname is Cruz" is a correction, not an approval', async () => {
    await interviewToReview();
    await reply('Yes, my surname is Cruz');
    expect(container.textContent).toContain('Updated: Surname to Cruz');
    expect(container.textContent).not.toContain('Checking your details');
    expect(container.textContent).not.toContain('Verify Applicant Information');   // issuing never started
  });

  test('a plain yes ("yes po") approves and starts issuing', async () => {
    await interviewToReview();
    await reply('Yes po');
    // The issue call is not mocked here, so it stops at the manual review page: proof that issuing started.
    expect(container.textContent).toContain('Verify Applicant Information');
  });

  test('"Um." is not an approval', async () => {
    await interviewToReview();
    await reply('Um.');
    expect(container.textContent).not.toContain('Checking your details');
  });
});

// ── Codex verify, round 1: every non-answer path is bounded and is not a try ─────────────────
describe('non-answers while spelling and at the final approval', () => {
  test('"Um." while spelling the place of birth is not a spelled try; 3 in a row pause the listening', async () => {
    await listenAtField('Place of birth');
    failEverything();
    await failedSpoken(3);                     // the spoken tries are used up: spelling starts
    await finishSpeech();
    await finishSpeech();
    const calls = countCalls();
    for (let turn = 0; turn < 2; turn += 1) {
      await reply('Um.');
      await finishSpeech();
      await act(async () => jest.advanceTimersByTime(150));
    }
    expect(container.textContent).not.toContain("Let's skip your place of birth");
    expect(countCalls()).toBe(calls);          // no answer check, no try
    await reply('Um.');
    expect(container.textContent).toContain('I did not hear any letters. Press Start Conversation');
    expect(container.textContent).not.toContain("Let's skip your place of birth");
    expect(button('Start Conversation')).toBeDefined();
  });

  test('3 fillers in a row at the final approval stop the automatic listening', async () => {
    await interviewToReview();
    const listens = () => recordings.length;
    for (let turn = 0; turn < 2; turn += 1) {
      await reply('Um.');
      await finishSpeech();
      await act(async () => jest.advanceTimersByTime(150));
    }
    await reply('Um.');
    const after = listens();
    await finishSpeech();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(listens()).toBe(after);             // no 4th listening turn
    expect(container.textContent).toContain('I did not hear you. Please use the buttons on the screen');
  });

  test('a real reply resets the run: two fillers, a correction, then fillers start counting again', async () => {
    await interviewToReview();
    for (let turn = 0; turn < 2; turn += 1) {
      await reply('Um.');
      await finishSpeech();
      await act(async () => jest.advanceTimersByTime(150));
    }
    await reply('Yes, my surname is Cruz');
    await finishSpeech();
    await finishSpeech();
    await reply('Um.');
    expect(container.textContent).not.toContain('I did not hear you. Please use the buttons');
  });
});
