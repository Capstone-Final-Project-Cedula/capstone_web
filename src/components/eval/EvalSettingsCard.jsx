import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FlaskConical, Trash2 } from 'lucide-react';
import Card, { CardBody } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { evalAPI } from '../../api/eval';
import { getApiErrorMessage } from '../../api/errors';

const ROUND_TYPES = [
  { value: 'practice', label: 'Practice (never counted)' },
  { value: 'scripted', label: 'Scripted test' },
  { value: 'uat', label: 'Real UAT' },
  { value: 'live', label: 'Live (normal days)' },
];
const CONDITIONS = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'noisy', label: 'Noisy' },
];
const BATCH = 100;

const selectClass = 'w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-white '
  + 'text-sm text-[var(--color-neutral-800)] focus:outline-none focus:border-[var(--color-primary)]';

const Field = ({ label, children, hint }) => (
  <label className="block min-w-0">
    <span className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-[var(--color-neutral-500)] mt-1.5">{hint}</span>}
  </label>
);

// Evaluation mode on/off, the round and "Delete evaluation audio now" (plan 003; on the Evaluation page since
// plan 009). The page is admin only, and so is every call made here. `cfg` and `save` come from the page.
const EvalSettingsCard = ({ cfg, saving, save }) => {
  const [pending, setPending] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPending = useCallback(() => evalAPI.deleteStatus()
    .then(({ data }) => setPending(data.remaining))
    .catch(() => setPending(null)), []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const deleteNow = async () => {
    setDeleting(true);
    try {
      let remaining = pending || 1;
      while (remaining > 0) {
        // One batch at a time: never everything at once.
        // eslint-disable-next-line no-await-in-loop
        const { data } = await evalAPI.deleteAudioBatch(BATCH);
        remaining = data.remaining;
        setPending(remaining);
        if (data.failed) {
          // Storage did not confirm some clips: they stay listed, so say so and let the admin try again.
          toast.error(`${data.failed} clip(s) could not be deleted from storage. They are still listed; try again later.`);
          return;
        }
        if (!data.rows) break;
      }
      toast.success('Evaluation audio and text deleted. The numbers were kept.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not finish deleting'));
    } finally {
      setDeleting(false);
      setConfirming(false);
      loadPending();
    }
  };

  if (!cfg) return null;
  const on = cfg.evaluation_mode;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)]">Evaluation mode</h2>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              Staff never see this. Off only stops new logging and recording; past results stay on this page.
            </p>
          </div>
          <Badge tone={on ? 'success' : 'neutral'} dot>{on ? 'ON' : 'OFF'}</Badge>
        </div>

        <div className="space-y-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              role="switch"
              aria-checked={on}
              className="mt-1 h-4 w-4"
              checked={on}
              disabled={saving}
              onChange={(e) => save({ evaluation_mode: e.target.checked },
                e.target.checked ? 'Evaluation mode is on.' : 'Evaluation mode is off. Past results are kept.')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-neutral-800)]">Log and record interviews</span>
              <span className="block text-xs text-[var(--color-neutral-500)] mt-0.5">
                On: every voice interview is logged, its audio is saved for re-scoring and the consent notice says so.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Testing round" hint={`Round ${cfg.round_no}.`}>
              <select
                className={selectClass}
                value={cfg.round_type}
                disabled={saving}
                onChange={(e) => save({ round_type: e.target.value }, 'New round started.')}
              >
                {ROUND_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select
                className={selectClass}
                value={cfg.round_condition}
                disabled={saving}
                onChange={(e) => save({ round_condition: e.target.value }, 'New round started.')}
              >
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          {cfg.round_type === 'practice' && (
            <p className="text-sm text-[var(--color-warning)] break-words" role="status">
              This is a Practice round: new sessions are listed but never counted toward the evaluation.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => save({ new_round: true }, 'New round started: participant codes begin at P001.')}
            >
              Start a new round
            </Button>
            <span className="text-xs text-[var(--color-neutral-500)]">
              Changing the type or condition also starts a new round.
            </span>
          </div>

          <div className="pt-5 border-t border-[var(--color-neutral-100)]">
            <h3 className="text-sm font-semibold text-[var(--color-neutral-800)]">Delete evaluation audio now</h3>
            <p className="text-xs text-[var(--color-neutral-500)] mt-1 break-words">
              Removes every saved recording and the text columns (transcripts, extracted, final and hand-scored text). The
              numbers (correct / incorrect, WER, times) stay. Nothing is ever deleted automatically.
              {pending !== null && ` ${pending} rows still hold audio or text.`}
            </p>
            {confirming ? (
              <div className="mt-3 flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Confirm deletion">
                <span className="text-sm text-[var(--color-error)] font-medium">This cannot be undone.</span>
                <Button variant="danger" icon={Trash2} loading={deleting} disabled={deleting} onClick={deleteNow}>
                  Yes, delete it
                </Button>
                <Button variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                icon={Trash2}
                className="mt-3"
                disabled={!pending}
                onClick={() => setConfirming(true)}
              >
                Delete evaluation audio now
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default EvalSettingsCard;
