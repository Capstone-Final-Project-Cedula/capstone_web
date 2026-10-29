import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SurveyPage from './SurveyPage';
import Sidebar from '../components/common/Sidebar';
import SusSurvey from '../components/sus/SusSurvey';
import { susAPI } from '../api/sus';

jest.mock('../api/sus', () => ({ susAPI: { submit: jest.fn() } }));
let mockUser = { role: 'admin' };
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));

window.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = jest.fn();   // jsdom has none

let container;
let root;

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (re) => [...container.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockUser = { role: 'admin' };
  susAPI.submit.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderSidebar = () => act(() => {
  root.render(<MemoryRouter><Sidebar isCollapsed={false} onToggleCollapse={() => {}} onMobileClose={() => {}} /></MemoryRouter>);
});

describe('Survey menu item (plan 008.1)', () => {
  test('admin sees Survey after Evaluation and before Settings', () => {
    renderSidebar();
    const labels = [...container.querySelectorAll('nav a')].map((a) => a.textContent.trim());
    expect(labels.indexOf('Survey')).toBe(labels.indexOf('Evaluation') + 1);
    expect(labels.indexOf('Settings')).toBe(labels.indexOf('Survey') + 1);
    expect(container.querySelector('a[href="/survey"]')).not.toBeNull();
  });

  test('staff do not see Survey', () => {
    mockUser = { role: 'staff' };
    renderSidebar();
    const labels = [...container.querySelectorAll('nav a')].map((a) => a.textContent.trim());
    expect(labels).toEqual(['New Application', 'QR Scanner']);
  });
});

describe('Survey page (plan 008.1)', () => {
  const renderPage = (entries) => act(() => {
    root.render(
      <MemoryRouter initialEntries={entries}>
        <Where />
        <Routes>
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route path="/records" element={<div>records</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  test('has no "try the system first" hint', () => {
    renderPage(['/survey']);
    expect(container.querySelector('h1').textContent).toBe('Survey');
    expect(container.textContent).not.toMatch(/after you have tried|after trying/i);
  });

  test('submits with no CTC id and platform web, then resets for the next person', async () => {
    susAPI.submit.mockResolvedValue({});
    renderPage(['/survey']);
    click(container.querySelector('[role="checkbox"]'));
    click(button(/^Next/));
    // profile step: pick the first role and experience choice, then continue
    click(container.querySelector('[aria-label="Who are you?"] [role="radio"]'));
    click(container.querySelector('[aria-label^="How much do you use"] [role="radio"]'));
    click(button(/^Next/));
    // statements step: answer every statement with the first option
    const groups = [...container.querySelectorAll('[role="radiogroup"]')];
    groups.forEach((g) => click(g.querySelector('[role="radio"]')));
    click(button(/^Next/));
    await act(async () => { click(button(/^Submit answers/)); });

    expect(susAPI.submit).toHaveBeenCalledTimes(1);
    expect(susAPI.submit.mock.calls[0][0]).toMatchObject({ transaction_id: null, platform: 'web', consent_given: true });
    expect(container.textContent).toMatch(/Thank you/);

    click(button(/Fill in another survey/));
    expect(container.textContent).toMatch(/Before we start/);   // consent step again, old answers gone
  });

  test('"No, thanks" goes back to the previous page and keeps no survey open', () => {
    renderPage(['/records', '/survey']);
    click(button(/No, thanks/));
    expect(container.querySelector('[data-testid="where"]').textContent).toBe('/records');
  });

  test('"No, thanks" with no history goes to the dashboard', () => {
    renderPage(['/survey']);
    click(button(/No, thanks/));
    expect(container.querySelector('[data-testid="where"]').textContent).toBe('/dashboard');
  });
});

describe('SusSurvey decline callback (plan 008.1)', () => {
  test('"No, thanks" calls onDecline; falls back to onClose when none is given', () => {
    const onClose = jest.fn();
    const onDecline = jest.fn();
    act(() => { root.render(<SusSurvey onClose={onClose} onDecline={onDecline} />); });
    click(button(/No, thanks/));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => { root.render(<SusSurvey key="b" onClose={onClose} />); });
    click(button(/No, thanks/));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
