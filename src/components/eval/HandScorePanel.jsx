import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, Play } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import { evalAPI } from '../../api/eval';
import { getApiErrorMessage } from '../../api/errors';

const PARENTS = ['address', 'place_of_birth'];
const errorsOf = (a) => (a.wer_words === null || a.wer_words === undefined ? null : a.wer_errors);
const count = (errors, words) => (words === null || words === undefined ? '—' : `${errors} / ${words}`);

/**
 * Plan 009: re-score a question by hand from its saved clip. Each result row of a question (or of one address /
 * birthplace step) shows the card's words, Whisper's first spoken try and its count; "Hand score" opens two
 * boxes: what the participant really said and what Whisper heard. The backend counts them with the card's rule.
 */
const HandScorePanel = ({ detail, labels, onPlay, onSaved }) => {
  const [editing, setEditing] = useState(null);
  const [reference, setReference] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [saving, setSaving] = useState(false);

  const firstTry = (field) => detail.answers.find((a) => a.field === field && a.step === 'spoken' && a.engine === 'whisper');
  const hasParts = new Set(detail.answers.filter((a) => a.step === 'final').map((a) => a.field));
  const rows = detail.answers.filter((a) => a.step === 'final' && a.card_read
    && !(PARENTS.includes(a.field) && [...hasParts].some((f) => f.startsWith(`${a.field}_`))));

  const open = (row) => {
    setEditing(row.id);
    setReference(row.hand_reference ?? row.card_read ?? '');
    setHypothesis(row.hand_hypothesis ?? firstTry(row.field)?.transcript ?? '');
  };

  const submit = async (row, clear = false) => {
    setSaving(true);
    try {
      if (clear) await evalAPI.clearHandScore(row.id);
      else await evalAPI.saveHandScore(row.id, reference, hypothesis);
      toast.success(clear ? 'Hand score removed.' : 'Hand score saved.');
      setEditing(null);
      onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the hand score'));
    } finally {
      setSaving(false);
    }
  };

  if (!detail.has_card) {
    return <p className="text-sm text-[var(--color-neutral-500)]">No card: this session has no WER to re-score.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--color-neutral-100)]">
      {rows.map((row) => {
        const heard = firstTry(row.field);
        return (
          <li key={row.id} className="py-3 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 md:gap-4 items-start">
              <div className="text-sm font-medium text-[var(--color-neutral-800)] min-w-0 break-words">
                {labels[row.field] || row.field}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-[var(--color-neutral-500)]">Card says</div>
                <div className="text-sm text-[var(--color-neutral-800)] break-words">{row.card_read}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-[var(--color-neutral-500)]">Whisper heard (first try)</div>
                <div className="text-sm text-[var(--color-neutral-800)] break-words">{heard?.transcript || '—'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className="text-sm text-[var(--color-neutral-700)] whitespace-nowrap">
                  {count(errorsOf(row), row.wer_words)}
                </span>
                {row.hand_words !== null && row.hand_words !== undefined && (
                  <Badge tone="info">hand-scored {count(row.hand_errors, row.hand_words)}</Badge>
                )}
                {heard?.has_audio && (
                  <Button size="sm" variant="ghost" icon={Play} onClick={() => onPlay(heard.id)}>Play</Button>
                )}
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open(row)}>Hand score</Button>
              </div>
            </div>
            {editing === row.id && (
              <form
                className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"
                onSubmit={(e) => { e.preventDefault(); submit(row); }}
              >
                <Input label="What the participant really said" value={reference} maxLength={500}
                  onChange={(e) => setReference(e.target.value)} />
                <Input label="What Whisper heard" value={hypothesis} maxLength={500}
                  onChange={(e) => setHypothesis(e.target.value)} />
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit" size="sm" loading={saving} disabled={saving}>Save hand score</Button>
                  {row.hand_words !== null && row.hand_words !== undefined && (
                    <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => submit(row, true)}>
                      Remove hand score
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default HandScorePanel;
