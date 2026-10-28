import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SusSurvey from './SusSurvey';

jest.mock('../../api/sus', () => ({ susAPI: { submit: jest.fn() } }));

global.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = jest.fn();   // jsdom has none

let container;
let root;

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

const openProfileStep = () => {
  act(() => { root.render(<SusSurvey onClose={() => {}} />); });
  click(container.querySelector('[role="checkbox"]'));
  click([...container.querySelectorAll('button')].find((b) => /^Next/.test(b.textContent.trim())));
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the SUS name box (plan 007 B)', () => {
  test('says it is optional in the label and the box itself', () => {
    openProfileStep();
    expect(container.querySelector('h3').textContent).toBe('Name (optional)');
    const box = container.querySelector('input[autocomplete="name"]');
    expect(box.getAttribute('placeholder')).toBe('Name (optional)');
    expect(box.getAttribute('maxlength')).toBe('120');
    expect(container.textContent).not.toMatch(/stay anonymous|leave this blank/i);
  });
});
