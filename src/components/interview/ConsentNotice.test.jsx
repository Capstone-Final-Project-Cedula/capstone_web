import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ConsentNotice from './ConsentNotice';
import { settingsAPI } from '../../api/settings';

jest.mock('../../api/settings', () => ({ settingsAPI: { get: jest.fn() } }));

window.IS_REACT_ACT_ENVIRONMENT = true;

const EN_NOT_SAVED = 'Your voice is turned into text by our speech system and the recording is not saved.';
const FIL_NOT_SAVED = 'Ginagawang teksto ng aming speech system ang iyong boses at hindi itinatago ang recording.';

let container;
let root;

const render = async (props) => {
  await act(async () => {
    root.render(<ConsentNotice open onAgree={jest.fn()} {...props} />);
  });
  return document.body.textContent;
};
const toFilipino = async () => {
  const toggle = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Filipino');
  await act(async () => toggle.click());
  return document.body.textContent;
};

beforeEach(() => {
  settingsAPI.get.mockResolvedValue({ data: { barangay_name: 'Barangay Imbatug' } });   // CRA resets mocks between tests
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the consent notice', () => {
  test('says the recording is not saved, in both languages, and never mentions a study', async () => {
    const english = await render();
    expect(english).toContain(EN_NOT_SAVED);
    expect(english).not.toContain('research team');
    const filipino = await toFilipino();
    expect(filipino).toContain(FIL_NOT_SAVED);
    expect(filipino).not.toContain('research team');
  });

  test('an old `recording` prop changes nothing (plan 012: evaluation mode is gone)', async () => {
    const plain = await render();
    expect(await render({ recording: true })).toBe(plain);
  });

  test('shows the two items and five privacy points, and both buttons', async () => {
    await render();
    expect(document.body.querySelectorAll('li').length).toBe(7);
    const labels = [...document.body.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toEqual(expect.arrayContaining(['I agree, start', 'I do not agree']));
  });

  test('the read-aloud text matches what is shown', async () => {
    const speak = jest.fn();
    await render({ speak });
    const readAloud = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Read aloud');
    await act(async () => readAloud.click());
    expect(speak.mock.calls[0][0]).toContain(EN_NOT_SAVED);
    expect(speak.mock.calls[0][0]).not.toContain('research team');
  });
});
