import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [position, setPosition] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
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

  // A new query or closing: the old results can no longer be picked, and a late answer is ignored
  // (Codex verify, plan 002.1: Enter could pick a result of the previous search).
  const forget = () => { turn.current += 1; setOptions([]); setLoading(false); };
  const close = () => { forget(); setOpen(false); setQuery(null); setActive(0); };

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

  // Float above clipping cards without moving the form; show four options at a time.
  useLayoutEffect(() => {
    if (!open || !inputRef.current || !listRef.current) return undefined;
    const updatePosition = () => {
      const input = inputRef.current.getBoundingClientRect();
      const list = listRef.current;
      const rows = [...list.querySelectorAll('[role="option"]')].slice(0, 4);
      const rowHeight = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
      const statusHeight = list.querySelector('[role="presentation"]')?.getBoundingClientRect().height || 0;
      const desiredHeight = (rowHeight || rows.length * 44) + statusHeight + 10;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const below = Math.max(0, viewportBottom - input.bottom - 12);
      const above = Math.max(0, input.top - viewportTop - 12);
      const upwards = below < desiredHeight && above > below;
      const maxHeight = Math.min(desiredHeight, upwards ? above : below);
      const width = Math.min(input.width, window.innerWidth - 16);
      const next = {
        top: upwards ? input.top - maxHeight - 4 : input.bottom + 4,
        left: Math.max(8, Math.min(input.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      };
      setPosition((previous) => previous && Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [open, options, status, typed, position?.width]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, options]);

  return (
    <div className="relative min-w-0">
      <Input
        ref={inputRef}
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
        onChange={(e) => { forget(); setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => {
          if (minChars === 0 && query === null) setQuery('');   // a short list: show it all at once
          setOpen(true);
        }}
        onBlur={() => setTimeout(close, 150)}
        onKeyDown={onKeyDown}
      />
      {open && (status || choices.length > 0) && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="fixed z-[110] overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-white py-1 shadow-[var(--shadow-md)]"
          style={position || { visibility: 'hidden' }}
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
        </ul>,
        document.body,
      )}
    </div>
  );
};

export default SearchSelect;
