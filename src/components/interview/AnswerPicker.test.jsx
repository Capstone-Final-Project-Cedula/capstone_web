import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AnswerPicker from './AnswerPicker';
import { placesAPI } from '../../api/places';

jest.mock('../../api/places', () => ({
  placesAPI: { birth: jest.fn(), towns: jest.fn(), barangays: jest.fn() },
}));

window.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

const render = (props) => act(() => root.render(<AnswerPicker label="Answer" value="" onChange={() => {}} {...props} />));
const button = (name) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
// A typed value the way a browser fires it on a React-controlled input.
const type = (input, text) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('AnswerPicker saves what the voice path saves (plan 002.1)', () => {
  test('sex and civil status are buttons with the backend values', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'sex', onChange });
    act(() => button('Female').click());
    expect(onChange).toHaveBeenLastCalledWith('Female', {});
    render({ fieldKey: 'civil_status', onChange });
    expect(['Single', 'Married', 'Widowed', 'Separated'].every((v) => button(v))).toBe(true);
    act(() => button('Widowed').click());
    expect(onChange).toHaveBeenLastCalledWith('Widowed', {});
  });

  test('the birth date: written like a spoken date in the interview, ISO on the QR page, never in the future', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'date', onChange });
    const input = container.querySelector('input[type="date"]');
    expect(input.max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    act(() => type(input, '1990-05-10'));
    expect(onChange).toHaveBeenLastCalledWith('May 10, 1990', {});
    act(() => type(input, '2999-01-01'));
    expect(onChange).toHaveBeenCalledTimes(1);                       // refused, not saved
    expect(container.textContent).toMatch(/cannot be in the future/);

    const iso = jest.fn();
    render({ fieldKey: 'date_of_birth', dateFormat: 'iso', onChange: iso });
    act(() => type(container.querySelector('input[type="date"]'), '1995-06-20'));
    expect(iso).toHaveBeenLastCalledWith('1995-06-20', {});
  });

  test('height shows its unit and the voice limits', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'height', onChange });
    const input = container.querySelector('input[type="number"]');
    expect(container.textContent).toMatch(/\(cm\)/);
    expect([input.min, input.max]).toEqual(['50', '250']);
    act(() => type(input, '400'));
    expect(container.textContent).toMatch(/50 to 250 cm/);
    act(() => type(input, '160'));
    expect(onChange).toHaveBeenLastCalledWith('160', {});
  });

  test('citizenship: Filipino preselected once, "Other" opens a text box and is not undone', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'citizenship', onChange });
    expect(onChange).toHaveBeenCalledWith('Filipino', {});
    act(() => button('Other').click());
    expect(onChange).toHaveBeenLastCalledWith('', {});
    render({ fieldKey: 'citizenship', value: '', onChange });          // the parent saved the empty value
    expect(onChange).toHaveBeenLastCalledWith('', {});                 // not set back to Filipino
    expect(container.querySelector('input')).not.toBeNull();
  });

  test('citizenship is not stuck on "Other" when the first render still shows the previous answer', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'citizenship', value: 'Single', onChange });     // manual mode, one render behind
    render({ fieldKey: 'citizenship', value: '', onChange });
    expect(onChange).toHaveBeenLastCalledWith('Filipino', {});
    render({ fieldKey: 'citizenship', value: 'Filipino', onChange });
    expect(button('Filipino').getAttribute('aria-checked')).toBe('true');
    expect(container.querySelectorAll('input')).toHaveLength(0);         // no "Other" text box
  });

  test('place of birth: pick from the list (with its code) or use the typed text, marked', async () => {
    jest.useFakeTimers();
    placesAPI.birth.mockResolvedValue({ data: [{ code: '1031210000', value: 'Malaybalay City, Bukidnon' }] });
    const onChange = jest.fn();
    render({ fieldKey: 'place_of_birth', onChange });
    const input = container.querySelector('input[role="combobox"]');
    act(() => type(input, 'malay'));
    await act(async () => { jest.advanceTimersByTime(250); });
    const options = [...container.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual([
      'Malaybalay City, Bukidnon', 'Not in the list: use "malay" as typed',
    ]);
    act(() => options[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith('Malaybalay City, Bukidnon', { code: '1031210000' });

    act(() => type(input, 'Tokyo'));
    await act(async () => { jest.advanceTimersByTime(250); });
    const free = [...container.querySelectorAll('[role="option"]')].pop();
    act(() => free.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith('Tokyo', { freeText: true });
  });

  test('names stay free text; occupation suggests but allows any text', () => {
    const onChange = jest.fn();
    render({ fieldKey: 'surname', onChange });
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    render({ fieldKey: 'occupation', onChange });
    const input = container.querySelector('input');
    const suggestions = document.getElementById(input.getAttribute('list'));
    expect(suggestions.tagName).toBe('DATALIST');
    expect(suggestions.querySelector('option[value="Farmer"]')).not.toBeNull();
    act(() => type(input, 'Beekeeper'));
    expect(onChange).toHaveBeenLastCalledWith('Beekeeper', {});
  });
});
