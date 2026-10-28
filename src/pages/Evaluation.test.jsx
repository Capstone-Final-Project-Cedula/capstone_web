import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Evaluation from './Evaluation';
import Sidebar from '../components/common/Sidebar';
import { MemoryRouter } from 'react-router-dom';
import { evalAPI } from '../api/eval';

jest.mock('../api/eval', () => ({
  evalAPI: { getStats: jest.fn(), getSessions: jest.fn(), getSession: jest.fn(), getAudio: jest.fn(), exportCsv: jest.fn() },
}));
const mockUser = { role: 'admin' };
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));

window.IS_REACT_ACT_ENVIRONMENT = true;

const group = (answers, first, ladder, finished, wer) => ({
  answers, first_try_pct: first, after_ladder_pct: ladder, finished_pct: finished, wer_pct: wer, wer_words: answers * 3,
  skip_pct: 0, typed_pct: 0, spelled_pct: 0, avg_spoken_tries: 1.2,
});
const STATS = {
  sessions: { total: 3, issued: 2, abandoned: 1, open: 0 },
  overall: group(28, 71.4, 85.7, 100, 15.9),
  hard5: group(10, 40, 70, 100, 30.1),
  easy9: group(18, 88.9, 94.4, 100, 5.5),
  fields: { surname: group(2, 50, 100, 100, 20), middle_name: group(2, 100, 100, 100, 0) },
  address_parts: { address_town: group(2, 100, 100, 100, 0) },
  place_of_birth_steps: { place_of_birth_province: group(2, 50, 50, 100, 25) },
  models: [{ model: 'medium', answers: 28, first_try_pct: 71.4 }],
  timing: { avg_seconds_per_question: 6.1, avg_seconds_per_application: 210.4, avg_seconds_qr_to_issued: null, avg_whisper_seconds: 1.8 },
  errors: 1,
  security: { login_failed: 2, unauthorized: 0, forbidden: 1 },
};
const SESSIONS = [{
  id: 1, participant_code: 'P001', round_type: 'scripted', round_condition: 'quiet', card_no: 7, input_method: 'voice',
  outcome: 'issued', app_seconds: 200.5, started_at: '2026-10-28T08:00:00Z',
}];

let container;
let root;
beforeEach(() => {
  evalAPI.getStats.mockResolvedValue({ data: STATS });
  evalAPI.getSessions.mockResolvedValue({ data: SESSIONS });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

describe('the Evaluation page (plan 003)', () => {
  test('shows the overall numbers first, then hard 5 / easy 9 and each field, from the backend\'s aggregates', async () => {
    await act(async () => root.render(<Evaluation />));
    const text = container.textContent;
    expect(text).toContain('All 14 fields');
    expect(text).toContain('71.4%');
    expect(text).toContain('15.9%');
    expect(text).toContain('Hard 5');
    expect(text).toContain('Easy 9');
    expect(text).toContain('Surname');
    expect(text).toContain('Place of birth: province or city');
    expect(text).toContain('Failed logins');
    expect(text).toContain('P001');
    expect(evalAPI.getStats).toHaveBeenCalledWith({});
  });

  test('a filter is sent to the backend', async () => {
    await act(async () => root.render(<Evaluation />));
    const select = [...container.querySelectorAll('select')][1];
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'noisy');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(evalAPI.getStats).toHaveBeenLastCalledWith({ condition: 'noisy' });
  });

  test('a long name stays inside its cell (break-words)', async () => {
    const detail = { ...SESSIONS[0], answers: [{
      id: 5, field: 'surname', step: 'spoken', attempt_no: 1, model: 'medium', transcript: 'Ma. Concepcion Dela Cruz-Villanueva',
      extracted_value: 'Ma. Concepcion Dela Cruz-Villanueva', has_audio: true,
    }] };
    evalAPI.getSession.mockResolvedValue({ data: detail });
    await act(async () => root.render(<Evaluation />));
    const open = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open');
    await act(async () => open.click());
    const cell = [...container.querySelectorAll('td')].find((td) => td.textContent.includes('Villanueva'));
    expect(cell.className).toContain('break-words');
    expect(container.textContent).toContain('Play');
  });
});

describe('staff see nothing of evaluation', () => {
  const sidebarLinks = async (role) => {
    mockUser.role = role;
    await act(async () => root.render(<MemoryRouter><Sidebar isCollapsed={false} onToggleCollapse={() => {}} onMobileClose={() => {}} /></MemoryRouter>));
    return [...container.querySelectorAll('a')].map((a) => a.textContent.trim());
  };

  test('the staff sidebar has no Evaluation link', async () => {
    const links = await sidebarLinks('staff');
    expect(links.join(' ')).not.toMatch(/evaluation/i);
    expect(links).toEqual(expect.arrayContaining(['New Application']));
  });

  test('the admin sidebar has it', async () => {
    expect((await sidebarLinks('admin')).join(' ')).toMatch(/Evaluation/);
  });
});
