import React, { useEffect, useId, useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import SearchSelect from '../ui/SearchSelect';
import AddressPicker from './AddressPicker';
import { placesAPI } from '../../api/places';
import { CIVIL_STATUS_OPTIONS, SEX_OPTIONS } from '../../utils/requiredFields';
import {
  NUMBER_LIMITS, OCCUPATIONS, dateProblem, fromIsoDate, localTodayIso, numberProblem, pickerKind, toIsoDate,
} from '../../utils/pickers';

const legendClass = 'mb-1.5 block text-sm font-medium text-[var(--color-neutral-700)]';

/** Large tap targets for a fixed set (Male / Female, the 4 civil statuses). */
const ChoiceButtons = ({ label, options, value, onChange, hideLabel = false }) => (
  <fieldset className="min-w-0">
    <legend className={hideLabel ? 'sr-only' : legendClass}>{label}</legend>
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option}
          size="lg"
          variant={value === option ? 'primary' : 'secondary'}
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  </fieldset>
);

/**
 * AnswerPicker (plan 002.1): the control for one answer typed by hand, at the end step, in manual mode,
 * on the review page and the QR page. Fixed sets are buttons, the birth date a date picker, numbers
 * have their units and the voice path's limits, places and towns come from the voice lists. It saves
 * the same text the voice path saves. onChange(text, meta): meta carries the list code of a pick.
 * `fieldKey`: an interview key or the phone's key ("date_of_birth"); `dateFormat`: 'display' or 'iso'.
 */
const AnswerPicker = ({
  fieldKey, value = '', onChange, label, error, dateFormat = 'display', autoFocus = false, hideLabel = false,
}) => {
  const kind = pickerKind(fieldKey);
  // hideLabel: the label is already on screen (a review row); the control keeps it as its accessible name.
  const shown = (text) => (hideLabel ? undefined : text);
  const named = (text) => (hideLabel ? text : undefined);
  const listId = useId();
  const [problem, setProblem] = useState('');
  const isFilipino = !value || /^filipino$/i.test(String(value).trim());
  // "Other" tapped: kept even while its text box is still empty. Otherwise it follows the value, so a
  // first render that still shows the previous question's answer cannot leave it stuck on "Other".
  const [choseOther, setChoseOther] = useState(false);
  const otherCitizenship = choseOther || !isFilipino;

  useEffect(() => {
    // Filipino is preselected while nothing is chosen; never after "Other" was tapped.
    if (kind === 'citizenship' && !value && !choseOther) onChange('Filipino', {});
  }, [kind, value, choseOther, onChange]);

  if (kind === 'sex' || kind === 'civil_status') {
    return (
      <ChoiceButtons
        label={label}
        options={kind === 'sex' ? SEX_OPTIONS : CIVIL_STATUS_OPTIONS}
        value={value}
        hideLabel={hideLabel}
        onChange={(v) => onChange(v, {})}
      />
    );
  }

  if (kind === 'date') {
    return (
      <Input
        label={shown(label)}
        aria-label={named(label)}
        type="date"
        value={toIsoDate(value)}
        max={localTodayIso()}
        autoFocus={autoFocus}
        error={problem || error}
        onChange={(e) => {
          const why = dateProblem(e.target.value);
          setProblem(why);
          if (!why) onChange(fromIsoDate(e.target.value, dateFormat), {});
        }}
      />
    );
  }

  if (kind in NUMBER_LIMITS) {
    const limits = NUMBER_LIMITS[kind];
    const withUnit = `${String(label || '').replace(/\s*\(.*\)$/, '')} (${limits.unit})`;   // "Height (cm)" once
    return (
      <Input
        label={shown(withUnit)}
        aria-label={named(withUnit)}
        placeholder={limits.unit}
        type="number"
        inputMode="decimal"
        min={limits.min}
        max={limits.max ?? undefined}
        step="any"
        value={value ?? ''}
        autoFocus={autoFocus}
        error={problem || error}
        onChange={(e) => { setProblem(numberProblem(kind, e.target.value)); onChange(e.target.value, {}); }}
      />
    );
  }

  if (kind === 'citizenship') {
    return (
      <div className="min-w-0 space-y-2">
        <ChoiceButtons
          label={label}
          options={['Filipino', 'Other']}
          hideLabel={hideLabel}
          value={otherCitizenship ? 'Other' : 'Filipino'}
          onChange={(v) => {
            setChoseOther(v === 'Other');
            onChange(v === 'Other' ? '' : 'Filipino', {});
          }}
        />
        {otherCitizenship && (
          <Input
            label="Citizenship"
            value={isFilipino ? '' : value}
            placeholder="Example: Japanese"
            error={error}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value, {})}
          />
        )}
      </div>
    );
  }

  if (kind === 'place_of_birth') {
    return (
      <SearchSelect
        label={shown(label)}
        ariaLabel={named(label)}
        value={value}
        error={error}
        autoFocus={autoFocus}
        placeholder="Type the town or city, for example Malaybalay"
        search={async (q) => (await placesAPI.birth(q)).data.map((p) => ({ key: p.code, label: p.value, code: p.code }))}
        onPick={(o) => onChange(o.label, { code: o.code })}
        freeText={{
          label: (q) => `Not in the list: use "${q}" as typed`,
          onUse: (q) => onChange(q, { freeText: true }),
        }}
      />
    );
  }

  if (kind === 'address') {
    return <AddressPicker label={label} hideLabel={hideLabel} value={value} onChange={onChange} error={error} />;
  }

  return (
    <>
      <Input
        label={shown(label)}
        aria-label={named(label)}
        value={value ?? ''}
        error={error}
        autoFocus={autoFocus}
        autoComplete="off"
        list={kind === 'occupation' ? listId : undefined}
        placeholder={kind === 'occupation' ? 'Example: Farmer' : undefined}
        onChange={(e) => onChange(e.target.value, {})}
      />
      {kind === 'occupation' && (
        <datalist id={listId}>
          {OCCUPATIONS.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </>
  );
};

export default AnswerPicker;
