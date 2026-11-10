import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Evaluation from './Evaluation';
import Sidebar from '../components/common/Sidebar';
import { MemoryRouter } from 'react-router-dom';
import { evalAPI } from '../api/eval';

jest.mock('../api/eval', () => ({
  evalAPI: {
    getStats: jest.fn(), getSessions: jest.fn(), getSession: jest.fn(), getAudio: jest.fn(), exportCsv: jest.fn(),
    getSettings: jest.fn(), saveSettings: jest.fn(), deleteStatus: jest.fn(), deleteAudioBatch: jest.fn(),
    getCards: jest.fn(), generateCard: jest.fn(), cardPdf: jest.fn(), saveHandScore: jest.fn(), clearHandScore: jest.fn(),
  },
}));
const mockUser = { role: 'admin' };
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));

window.IS_REACT_ACT_ENVIRONMENT = true;

const group = (answers, first, ladder, finished, wer) => ({
  answers, field_extraction_pct: ladder, first_try_pct: first, after_ladder_pct: ladder, finished_pct: finished,
  wer_pct: wer, wer_errors: 7, wer_words: 44, substitutions: 5, deletions: 1, insertions: 1, hand_wer_pct: null,
  hand_errors: 7, hand_words: 44, hand_scored: 0, skipped: 1, skip_pct: 0, typed_pct: 0, spelled_pct: 0,
  avg_spoken_tries: 1.2, avg_seconds: 5.5,
});
const STATS = {
  view: 'counted',
  progress: { counted: 18, target: 30 },
  targets: { wer_pct: 15, field_extraction_pct: 90 },
  sessions: { total: 3, issued: 2, abandoned: 1, open: 0 },
  wer: { pct: 15.9, errors: 7, words: 44, substitutions: 5, deletions: 1, insertions: 1, participants: 2,
    hand_pct: 13.6, hand_errors: 6, hand_words: 44, hand_scored: 1 },
  overall: group(28, 71.4, 85.7, 100, 15.9),
  fields: { surname: group(2, 50, 100, 100, 20), middle_name: group(2, 100, 100, 100, 0) },
  address_parts: { address_town: group(2, 100, 100, 100, 0) },
  place_of_birth_steps: { place_of_birth_province: group(2, 50, 50, 100, 25) },
  models: [{ model: 'medium', answers: 28, first_try_pct: 71.4 }],
  timing: { avg_seconds_per_question: 6.1, skipped_questions: 1, avg_seconds_skipped: 40, avg_seconds_per_application: 210.4,
    avg_seconds_qr_to_issued: null, avg_whisper_seconds: 1.8 },
  errors: 1,
  security: { login_failed: 2, unauthorized: 0, forbidden: 1 },
};
const SESSIONS = [{
  id: 1, participant_code: 'P001', round_type: 'uat', round_condition: 'quiet', card_id: 7, card_no: null, counts: true,
  counted: true, input_method: 'voice', outcome: 'issued', app_seconds: 200.5, started_at: '2026-11-10T08:00:00Z',
}];
const CFG = { evaluation_mode: true, round_type: 'uat', round_condition: 'quiet', round_no: 4, counts: true, card_sets: [] };
const LONG = 'Ma. Concepcion Dela Cruz-Villanueva';
const card = (id) => ({
  id, style: 'A', claimed_by: null,
  lines: [{ key: 'surname', label: 'Surname', read: `${LONG}.` }, { key: 'sex', label: 'Sex', read: 'Female.' }],
});

let container;
let root;
beforeEach(() => {
  evalAPI.getStats.mockResolvedValue({ data: STATS });
  evalAPI.getSessions.mockResolvedValue({ data: SESSIONS });
  evalAPI.getSettings.mockResolvedValue({ data: CFG });
  evalAPI.saveSettings.mockImplementation(async (changes) => ({ data: { ...CFG, ...changes } }));
  evalAPI.deleteStatus.mockResolvedValue({ data: { remaining: 0 } });
  evalAPI.getCards.mockResolvedValue({ data: { next: card(3), waiting: 1, recent: [] } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const renderPage = async () => {
  await act(async () => root.render(<MemoryRouter><Evaluation /></MemoryRouter>));
};
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

describe('the Evaluation page (plan 009)', () => {
  test('the headline is the pooled WER with its counts, then field extraction accuracy and the progress', async () => {
    await renderPage();
    const text = container.textContent;
    expect(text).toContain('WER = (S + D + I) ÷ N');
    expect(text).toContain('15.9%');
    expect(text).toContain('7 errors / 44 words / 2 participants');
    expect(text).toContain('S 5 · D 1 · I 1');
    expect(text).toContain('target ≤ 15%: not met');
    expect(text).toContain('hand-scored 13.6% (1 re-scored)');        // the hand value beside Whisper's
    expect(text).toContain('Field extraction accuracy');
    expect(text).toContain('85.7%');
    expect(text).toContain('18 of 30');
    expect(text).toContain('All 14 questions');
    expect(text).not.toMatch(/Hard 5|Easy 9|field accuracy/i);
    expect(text).toContain('Place of birth: province or city');
    expect(text).toContain('P001');
    expect(evalAPI.getStats).toHaveBeenCalledWith({ view: 'counted' });
  });

  test('a filter is sent to the backend, and "All sessions" shows everything', async () => {
    await renderPage();
    const selects = [...container.querySelectorAll('select')];
    const change = async (select, value) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const condition = selects.find((s) => [...s.options].some((o) => o.textContent === 'Any') && [...s.options].some((o) => o.value === 'noisy'));
    await change(condition, 'noisy');
    expect(evalAPI.getStats).toHaveBeenLastCalledWith({ view: 'counted', condition: 'noisy' });
    const view = selects.find((s) => [...s.options].some((o) => o.value === 'all'));
    await change(view, 'all');
    expect(evalAPI.getStats).toHaveBeenLastCalledWith({ view: 'all', condition: 'noisy' });
  });

  test('the switch lives on this page and turning it off keeps the results on screen', async () => {
    await renderPage();
    const toggle = container.querySelector('input[role="switch"]');
    expect(toggle.checked).toBe(true);
    await act(async () => toggle.click());
    expect(evalAPI.saveSettings).toHaveBeenCalledWith({ evaluation_mode: false });
    expect(container.textContent).toContain('OFF');
    expect(container.textContent).toContain('18 of 30');
  });

  test('"Generate card" keeps showing the next card to be read, and long text wraps', async () => {
    evalAPI.generateCard.mockResolvedValue({ data: { next: card(3), waiting: 2, recent: [] } });
    await renderPage();
    expect(container.textContent).toContain('Card #3');
    await act(async () => button('Generate card').click());
    expect(evalAPI.generateCard).toHaveBeenCalled();
    expect(container.textContent).toContain('Card #3');                 // still the oldest unclaimed card
    expect(container.textContent).toContain('2 cards waiting');
    const line = [...container.querySelectorAll('dd')].find((dd) => dd.textContent.includes('Villanueva'));
    expect(line.className).toContain('break-words');
    expect(line.className).toContain('min-w-0');
    expect(button('Download PDF')).toBeTruthy();
  });

  test('the "counts toward evaluation" box is saved for the next run', async () => {
    await renderPage();
    const box = [...container.querySelectorAll('label')].find((l) => l.textContent.includes('This run counts toward evaluation'))
      .querySelector('input');
    await act(async () => box.click());
    expect(evalAPI.saveSettings).toHaveBeenCalledWith({ counts: false });
  });

  test('a result row can be re-scored by hand from the session detail', async () => {
    const detail = { ...SESSIONS[0], has_card: true, answers: [
      { id: 5, field: 'surname', step: 'spoken', attempt_no: 1, engine: 'whisper', model: 'medium', transcript: LONG,
        extracted_value: LONG, has_audio: true, card_read: `${LONG}.` },
      { id: 9, field: 'surname', step: 'final', attempt_no: 0, card_read: `${LONG}.`, wer_errors: 1, wer_words: 4,
        hand_words: null, final_value: LONG, expected_value: LONG },
    ] };
    evalAPI.getSession.mockResolvedValue({ data: detail });
    evalAPI.saveHandScore.mockResolvedValue({ data: {} });
    await renderPage();
    await act(async () => button('Open').click());
    const cell = [...container.querySelectorAll('td')].find((td) => td.textContent.includes('Villanueva'));
    expect(cell.className).toContain('break-words');
    expect(container.textContent).toContain('Play');
    await act(async () => button('Hand score').click());
    await act(async () => button('Save hand score').click());
    expect(evalAPI.saveHandScore).toHaveBeenCalledWith(9, `${LONG}.`, LONG);
  });
});

describe('Codex verify round 1 (plan 009)', () => {
  test('a card claimed from another tab is no longer shown when the admin comes back', async () => {
    await renderPage();
    expect(container.textContent).toContain('Card #3');
    evalAPI.getCards.mockResolvedValue({ data: { next: card(4), waiting: 1, recent: [] } });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(container.textContent).toContain('Card #4');
    expect(container.textContent).not.toContain('Card #3');
  });

  test('Download PDF re-checks the queue and never prints a card that was just taken', async () => {
    await renderPage();
    evalAPI.getCards.mockResolvedValue({ data: { next: card(4), waiting: 1, recent: [] } });
    await act(async () => button('Download PDF').click());
    expect(evalAPI.cardPdf).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Card #4');
  });

  test('the hand score starts from the scored first try, not an "um" before it', async () => {
    const detail = { ...SESSIONS[0], has_card: true, answers: [
      { id: 4, field: 'surname', step: 'spoken', attempt_no: 0, engine: 'whisper', transcript: 'Um.', has_audio: true },
      { id: 5, field: 'surname', step: 'spoken', attempt_no: 1, engine: 'whisper', transcript: 'Abarkes', has_audio: true },
      { id: 9, field: 'surname', step: 'final', attempt_no: 0, card_read: 'Abarquez.', wer_errors: 1, wer_words: 1,
        hand_words: null },
    ] };
    evalAPI.getSession.mockResolvedValue({ data: detail });
    evalAPI.saveHandScore.mockResolvedValue({ data: {} });
    await renderPage();
    await act(async () => button('Open').click());
    await act(async () => button('Hand score').click());
    await act(async () => button('Save hand score').click());
    expect(evalAPI.saveHandScore).toHaveBeenCalledWith(9, 'Abarquez.', 'Abarkes');
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
    mockUser.role = 'admin';
    expect((await sidebarLinks('admin')).join(' ')).toMatch(/Evaluation/);
  });
});
