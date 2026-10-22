import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSpeechSynthesis } from './NewApplication';
import apiClient from '../api/client';

// Plan 006: two voice lines never play at once; the three closing lines play in order, none cut off.
jest.mock('../api/client', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../api/extraction', () => ({ extractionAPI: {} }));
jest.mock('../api/speech', () => ({ speechAPI: {} }));
jest.mock('../components/interview/ConsentNotice', () => () => null);
jest.mock('../components/sus/SusSurveyDialog', () => () => null);

window.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let voice;
let clips;
let instances;
const originalAudio = window.Audio;
const originalCreateURL = window.URL.createObjectURL;
const originalRevokeURL = window.URL.revokeObjectURL;
let counter = 0;

const Harness = () => {
  voice = useSpeechSynthesis();
  return null;
};

// A voice clip whose download the test finishes by hand.
const clip = (text) => {
  clips[text] = {};
  clips[text].promise = new Promise((resolve, reject) => {
    clips[text].resolve = () => resolve({ data: Object.assign(new Blob(), { label: text }) });
    clips[text].reject = () => reject(new Error('offline'));
  });
  return clips[text];
};
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const played = () => instances.filter((a) => a.playCalled).map((a) => a.url);

beforeEach(async () => {
  counter += 1;
  clips = {};
  instances = [];
  window.Audio = class {
    constructor(url) { this.url = url; this.src = url; instances.push(this); }
    play() { this.playCalled = true; return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  window.URL.createObjectURL = (blob) => `blob:${blob.label}`;
  window.URL.revokeObjectURL = () => {};
  apiClient.post.mockImplementation((url, body) => (clips[body.text] || clip(body.text)).promise);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.Audio = originalAudio;
  window.URL.createObjectURL = originalCreateURL;
  window.URL.revokeObjectURL = originalRevokeURL;
  jest.clearAllMocks();
});

test('a slow line that arrives after a newer one never plays, and its end is not announced', async () => {
  const endA = jest.fn();
  const endB = jest.fn();
  await act(async () => voice.speak(`slow A ${counter}`, endA));
  await act(async () => voice.speak(`fast B ${counter}`, endB));
  await act(async () => clips[`fast B ${counter}`].resolve());
  await settle();
  expect(played()).toEqual([`blob:fast B ${counter}`]);
  await act(async () => clips[`slow A ${counter}`].resolve());
  await settle();
  expect(played()).toEqual([`blob:fast B ${counter}`]);   // A was dropped, not played over B
  expect(endA).not.toHaveBeenCalled();
  await act(async () => instances[0].onended());
  expect(endB).toHaveBeenCalledTimes(1);
});

test('a stale clip whose download fails does not stop the newer clip', async () => {
  await act(async () => voice.speak(`slow A ${counter}`));
  await act(async () => voice.speak(`fast B ${counter}`));
  await act(async () => clips[`fast B ${counter}`].resolve());
  await settle();
  const newer = instances[0];
  expect(newer.playCalled).toBe(true);
  await act(async () => clips[`slow A ${counter}`].reject());
  await settle();
  expect(newer.paused).toBeUndefined();     // not paused by A's cleanup
  expect(newer.src).toBe(`blob:fast B ${counter}`);
  expect(instances).toHaveLength(1);
});

test('the closing lines play in order, each to its end, whichever clip arrives first', async () => {
  const lines = ['Checking', 'Saving', 'Counter'].map((t) => `${t} ${counter}`);
  const ends = [];
  await act(async () => {
    lines.forEach((text) => voice.speakInOrder(text, () => ends.push(text)));
  });
  await settle();
  expect(played()).toEqual([]);                          // the first clip is still downloading
  await act(async () => clips[lines[0]].resolve());
  await settle();
  expect(played()).toEqual([`blob:${lines[0]}`]);        // line 2 waits for line 1 to end
  await act(async () => instances[0].onended());
  await settle();
  await act(async () => (clips[lines[1]] || clip(lines[1])).resolve());   // the save was faster: it still waits its turn
  await settle();
  expect(played()).toEqual([`blob:${lines[0]}`, `blob:${lines[1]}`]);
  await act(async () => instances[1].onended());
  await settle();
  await act(async () => (clips[lines[2]] || clip(lines[2])).resolve());
  await settle();
  await act(async () => instances[2].onended());
  expect(ends).toEqual(lines);
  expect(instances.every((a) => !a.paused)).toBe(true);  // none was cut off
});

test('a newer interview prompt drops the closing lines that are still waiting', async () => {
  const lines = ['Checking', 'Saving'].map((t) => `${t} ${counter}`);
  const ends = [];
  await act(async () => {
    lines.forEach((text) => voice.speakInOrder(text, () => ends.push(text)));
  });
  await act(async () => voice.speak(`New question ${counter}`));
  await act(async () => clips[`New question ${counter}`].resolve());
  await settle();
  await act(async () => (clips[lines[0]] || clip(lines[0])).resolve());
  await settle();
  expect(played()).toEqual([`blob:New question ${counter}`]);
  expect(ends).toEqual([]);
});
