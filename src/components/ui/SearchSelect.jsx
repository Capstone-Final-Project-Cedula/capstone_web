import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import Input from './Input';

/**
 * SearchSelect — type to search a list, pick one (plan 002.1). The one shared picker for places,
 * towns and barangays. Presentational: the caller gives `search(query)` (sync or async, returns
 * [{ key, label }]) and handles `onPick(option)`. `freeText` adds a clearly marked
 * "not in the list" choice that hands the typed text to `freeText.onUse(text)`.
 * Keyboard: arrows move, Enter picks, Escape closes. Each option is at least 44px tall.
 */
const SearchSelect = ({
  label, value = '', placeholder, error, search, onPick, freeText = null, minChars = 1, autoFocus = false, ariaLabel,
}) => {
  const listId = useId();
  const [query, setQuery] = useState(null);       // null: not typing, the input shows `value`
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const turn = useRef(0);
  const searchRef = useRef(search);   // callers may pass a new function every render
  searchRef.current = search;

  const typed = query ?? '';
  const showFree = Boolean(freeText) && typed.trim().length >= minChars;
  const choices = [...options, ...(showFree ? [{ key: '__free__', label: freeText.label(typed.trim()), free: true }] : [])];

  useEffect(() => {
    if (query === null || query.trim().length < minChars) {
      setOptions([]);
      return undefined;
    }
    const mine = ++turn.current;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(async () => {
      try {
        const found = await searchRef.current(query.trim());
        if (mine === turn.current) setOptions(found.slice(0, 20));
      } catch {
        if (mine === turn.current) { setOptions([]); setFailed(true); }
      } finally {
        if (mine === turn.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, minChars]);

  const close = () => { setOpen(false); setQuery(null); setActive(0); };

  const choose = (option) => {
    if (!option) return;
    if (option.free) freeText.onUse(typed.trim());
    else onPick(option);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, choices.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && choices.length) { e.preventDefault(); choose(choices[active]); }
    else if (e.key === 'Escape') close();
  };

  const optionId = (i) => `${listId}-opt-${i}`;
  let status = '';
  if (open && typed.trim().length >= minChars) {
    if (loading) status = 'Searching…';
    else if (failed) status = 'The list could not be loaded. Check the connection.';
    else if (!options.length) status = 'No match in the list.';
  }

  return (
    <div className="relative min-w-0">
      <Input
        label={label}
        icon={Search}
        value={query ?? value}
        placeholder={placeholder}
        error={error}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && choices.length ? optionId(active) : undefined}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => {
          if (minChars === 0 && query === null) setQuery('');   // a short list: show it all at once
          setOpen(true);
        }}
        onBlur={() => setTimeout(close, 150)}
        onKeyDown={onKeyDown}
      />
      {open && (status || choices.length > 0) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-white py-1 shadow-[var(--shadow-md)]"
        >
          {status && <li className="px-3.5 py-2.5 text-sm text-[var(--color-neutral-500)]" role="presentation">{status}</li>}
          {choices.map((option, i) => (
            <li
              key={option.key}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(option); }}
              onMouseEnter={() => setActive(i)}
              className={[
                'flex min-h-[2.75rem] cursor-pointer items-center px-3.5 py-2 text-[15px] break-words',
                i === active ? 'bg-[var(--color-primary-light)] text-[var(--color-neutral-900)]' : 'text-[var(--color-neutral-800)]',
                option.free ? 'border-t border-[var(--color-neutral-100)] italic' : '',
              ].join(' ')}
            >
              <span className="min-w-0">{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
