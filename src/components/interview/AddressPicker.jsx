import React, { useEffect, useState } from 'react';
import SearchSelect from '../ui/SearchSelect';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { placesAPI } from '../../api/places';
import { joinAddress } from '../../utils/address';
import { filterOptions } from '../../utils/pickers';

let townsCache = null;   // the Region X towns: fetched once per page load
const loadTowns = async () => {
  if (!townsCache) townsCache = (await placesAPI.towns()).data;
  return townsCache;
};

/**
 * The address by hand (plan 002.1): town -> barangay -> purok, from the same Region X lists the voice
 * questions use, joined exactly like the spoken address. A town outside the list is typed instead.
 * onChange(text, { townCode, barangay }) once a town and a barangay are picked; onChange(text, {}) typed.
 */
const AddressPicker = ({ value = '', onChange, label = 'Address', error, hideLabel = false }) => {
  const [typing, setTyping] = useState(false);
  const [town, setTown] = useState(null);           // { code, value }
  const [barangays, setBarangays] = useState(null);   // null: loading; [] and `failed`: could not load
  const [failed, setFailed] = useState(false);
  const [barangay, setBarangay] = useState(null);   // { name, label }
  const [purok, setPurok] = useState('');

  useEffect(() => {
    if (!town) return undefined;
    let live = true;
    setBarangays(null);
    setFailed(false);
    placesAPI.barangays(town.code)
      .then(({ data }) => { if (live) setBarangays(data); })
      .catch(() => { if (live) { setBarangays([]); setFailed(true); } });
    return () => { live = false; };
  }, [town]);

  const emit = (t, b, p) => {
    if (!t || !b) return;
    const joined = joinAddress({
      address_purok: { value: p },
      address_barangay: { value: b.name, display: b.label },
      address_town: { value: t.value },
    });
    onChange(joined, { townCode: t.code, barangay: b.name });
  };

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-[var(--color-neutral-700)]'}>{label}</legend>
      {value && (
        <p className="text-sm text-[var(--color-neutral-600)] break-words">
          Now: <span className="font-medium text-[var(--color-neutral-800)]">{value}</span>
        </p>
      )}
      {typing ? (
        <>
          <Input
            label="Type the whole address"
            value={value}
            onChange={(e) => onChange(e.target.value, {})}
            placeholder="Purok, barangay, town and province"
            error={error}
            autoComplete="off"
          />
          <Button variant="ghost" size="lg" onClick={() => setTyping(false)}>Pick the town from the list</Button>
        </>
      ) : (
        <>
          <SearchSelect
            label="Town or city"
            value={town?.value || ''}
            placeholder="Type to search, for example Baungon"
            minChars={0}
            search={async (q) => filterOptions(await loadTowns(), q, (t) => t.value)
              .map((t) => ({ key: t.code, label: t.value, code: t.code }))}
            onPick={(o) => {
              setTown({ code: o.code, value: o.label });
              setBarangay(null);
              // Another town: the address is not finished until its barangay is picked, so the old one cannot be
              // saved by mistake (Codex verify round 2, plan 002.1).
              onChange('', {});
            }}
          />
          {town && barangays === null && (
            <p className="text-sm text-[var(--color-neutral-500)]" role="status">Loading the barangays…</p>
          )}
          {town && failed && (
            <p className="text-sm text-[var(--color-error)] break-words" role="alert">
              The barangays could not be loaded. Check the connection, or type the address.
            </p>
          )}
          {town && barangays !== null && !failed && (
            <SearchSelect
              key={town.code}
              label="Barangay"
              value={barangay?.label || ''}
              placeholder="Type to search the barangays"
              minChars={0}
              search={(q) => filterOptions(barangays, q, (b) => b.label).map((b) => ({ key: b.name, label: b.label, name: b.name }))}
              onPick={(o) => { const b = { name: o.name, label: o.label }; setBarangay(b); emit(town, b, purok); }}
              error={error}
            />
          )}
          {town && barangay && (
            <Input
              label="Purok, sitio or street (if any)"
              value={purok}
              onChange={(e) => { setPurok(e.target.value); emit(town, barangay, e.target.value); }}
              placeholder="Example: Purok 2"
              autoComplete="off"
            />
          )}
          <Button variant="ghost" size="lg" onClick={() => setTyping(true)}>Town not in the list? Type the address</Button>
        </>
      )}
    </fieldset>
  );
};

export default AddressPicker;
