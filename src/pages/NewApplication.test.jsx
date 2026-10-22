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
