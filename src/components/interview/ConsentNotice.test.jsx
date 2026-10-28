import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ConsentNotice from './ConsentNotice';
import { settingsAPI } from '../../api/settings';

jest.mock('../../api/settings', () => ({ settingsAPI: { get: jest.fn() } }));

window.IS_REACT_ACT_ENVIRONMENT = true;

const EN_SAVED = 'For this study, the recording is saved so the research team can check the system\'s accuracy. '
  + 'Only the research team can access it, and it will be deleted by the administrator after the study.';
const EN_NOT_SAVED = 'the recording is not saved.';
const FIL_SAVED = 'Para sa pag-aaral na ito, itinatago ang recording upang masuri ng research team ang katumpakan ng sistema.';
const FIL_NOT_SAVED = 'hindi itinatago ang recording.';

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

describe('the consent notice (plan 003)', () => {
  test('evaluation mode off: the original "not saved" lines are shown, in both languages', async () => {
    expect(await render({ recording: false })).toContain(EN_NOT_SAVED);
    expect(document.body.textContent).not.toContain('research team');
    expect(await toFilipino()).toContain(FIL_NOT_SAVED);
  });

  test('evaluation mode on: the recording line says it is saved for the research team, in both languages', async () => {
    const english = await render({ recording: true });
    expect(english).toContain(EN_SAVED);
    expect(english).not.toContain(EN_NOT_SAVED);
    const filipino = await toFilipino();
    expect(filipino).toContain(FIL_SAVED);
    expect(filipino).not.toContain(FIL_NOT_SAVED);
  });

  test('nothing else in the popup changes: same number of points, same buttons', async () => {
    await render({ recording: false });
    const off = document.body.querySelectorAll('li').length;
    await act(async () => root.render(<ConsentNotice open onAgree={jest.fn()} recording />));
    expect(document.body.querySelectorAll('li').length).toBe(off);
    const labels = [...document.body.querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(labels).toEqual(expect.arrayContaining(['I agree, start', 'I do not agree']));
  });

  test('the read-aloud text matches what is shown (study line included)', async () => {
    const speak = jest.fn();
    await render({ recording: true, speak });
    const readAloud = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Read aloud');
    await act(async () => readAloud.click());
    expect(speak.mock.calls[0][0]).toContain(EN_SAVED);
  });
});
