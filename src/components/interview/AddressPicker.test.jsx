import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AddressPicker from './AddressPicker';
import { placesAPI } from '../../api/places';

jest.mock('../../api/places', () => ({
  placesAPI: { birth: jest.fn(), towns: jest.fn(), barangays: jest.fn() },
}));

window.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  jest.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

const type = (input, text) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const boxes = () => [...container.querySelectorAll('input[role="combobox"]')];
const choose = async (box, text, label) => {
  act(() => type(box, text));
  await act(async () => { jest.advanceTimersByTime(250); });
  const option = [...container.querySelectorAll('[role="option"]')].find((o) => o.textContent === label);
  act(() => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
};

test('town -> barangay -> purok, joined like the spoken address, and a new town clears it (Codex verify round 2)', async () => {
  placesAPI.towns.mockResolvedValue({ data: [
    { code: '1001301000', value: 'Baungon, Bukidnon' }, { code: '1001315000', value: 'Talakag, Bukidnon' },
  ] });
  let release;
  placesAPI.barangays.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const onChange = jest.fn();
  act(() => root.render(<AddressPicker value="" onChange={onChange} />));

  await choose(boxes()[0], 'baung', 'Baungon, Bukidnon');
  expect(onChange).toHaveBeenLastCalledWith('', {});                     // nothing to save yet
  expect(container.textContent).toMatch(/Loading the barangays/);
  expect(boxes()).toHaveLength(1);                                        // no barangay search on an empty list

  await act(async () => { release({ data: [{ name: 'Imbatug', label: 'Barangay Imbatug' }] }); });
  expect(boxes()).toHaveLength(2);
  await choose(boxes()[1], 'imba', 'Barangay Imbatug');
  expect(onChange).toHaveBeenLastCalledWith('Barangay Imbatug, Baungon, Bukidnon',
    { townCode: '1001301000', barangay: 'Imbatug' });
  const purok = container.querySelectorAll('input:not([role="combobox"])')[0];
  act(() => type(purok, 'Purok 7'));
  expect(onChange).toHaveBeenLastCalledWith('Purok 7, Barangay Imbatug, Baungon, Bukidnon',
    { townCode: '1001301000', barangay: 'Imbatug' });

  // Another town: the previous address is not left ready to save.
  await choose(boxes()[0], 'tala', 'Talakag, Bukidnon');
  expect(onChange).toHaveBeenLastCalledWith('', {});
});
