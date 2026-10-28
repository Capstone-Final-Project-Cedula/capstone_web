import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FlaskConical, Trash2 } from 'lucide-react';
import Card, { CardBody } from '../ui/Card';
import Button from '../ui/Button';
import { evalAPI } from '../../api/eval';
import { getApiErrorMessage } from '../../api/errors';

const ROUND_TYPES = [
  { value: 'practice', label: 'Practice' },
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

// Settings → Evaluation (plan 003). The Settings page is admin only, and so is every call made here.
const EvalSettingsCard = () => {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPending = useCallback(() => evalAPI.deleteStatus()
    .then(({ data }) => setPending(data.remaining))
    .catch(() => setPending(null)), []);

  useEffect(() => {
    evalAPI.getSettings()
      .then(({ data }) => setCfg(data))
      .catch((error) => toast.error(getApiErrorMessage(error, 'Could not load the evaluation settings')));
    loadPending();
  }, [loadPending]);

  const save = async (changes, message) => {
    setSaving(true);
    try {
      const { data } = await evalAPI.saveSettings(changes);
      setCfg(data);
      toast.success(message || 'Evaluation settings saved.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the evaluation settings'));
    } finally {
      setSaving(false);
    }
  };

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
  const scripted = cfg.round_type === 'scripted';

  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)]">Evaluation</h2>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              Logs every voice interview for Chapter 4. Staff never see this. Round {cfg.round_no}.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={cfg.evaluation_mode}
              disabled={saving}
              onChange={(e) => save({ evaluation_mode: e.target.checked },
                e.target.checked ? 'Evaluation mode is on.' : 'Evaluation mode is off.')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-neutral-800)]">Evaluation mode</span>
              <span className="block text-xs text-[var(--color-neutral-500)] mt-0.5">
                On: recordings are saved for the research team and the consent notice says so. Off: nothing is logged.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Testing round">
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

          {scripted && (
            <Field label="Card set" hint="Volunteers read cards in order (P001 card 1, P002 card 2 ...), wrapping after the last.">
              <select
                className={selectClass}
                value={cfg.card_set || ''}
                disabled={saving}
                onChange={(e) => save({ card_set: e.target.value || null }, 'New round started.')}
              >
                <option value="">All cards</option>
                {(cfg.card_sets || []).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
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
              Changing the type, condition or card set also starts a new round.
            </span>
          </div>

          <div className="pt-5 border-t border-[var(--color-neutral-100)]">
            <h3 className="text-sm font-semibold text-[var(--color-neutral-800)]">Delete evaluation audio now</h3>
            <p className="text-xs text-[var(--color-neutral-500)] mt-1 break-words">
              Removes every saved recording and the text columns (transcripts, extracted and final values). The
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
