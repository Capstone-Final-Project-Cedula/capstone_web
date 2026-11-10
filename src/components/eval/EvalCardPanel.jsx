import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, FilePlus2, IdCard } from 'lucide-react';
import Card, { CardBody } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { evalAPI } from '../../api/eval';
import { getApiErrorMessage } from '../../api/errors';

// Plan 009: "Generate card" and the card the participant reads. The card shown is always the NEXT card to be
// claimed (the oldest one nobody has read yet), never simply the newest one, so what the participant reads is
// exactly what their session is scored against (Codex plan review round 1, #2).
const EvalCardPanel = ({ cfg, saving, save }) => {
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => evalAPI.getCards()
    .then(({ data }) => setCards(data))
    .catch((error) => toast.error(getApiErrorMessage(error, 'Could not load the evaluation cards'))), []);

  // An interview in another tab claims the card: reload when the admin comes back to this tab, so a claimed
  // card is never shown as the next one (Codex verify round 1).
  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const { data } = await evalAPI.generateCard();
      setCards(data);
      toast.success(data.waiting > 1 ? `Card added. ${data.waiting} cards are waiting; the oldest is shown.` : 'Card ready.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not generate a card'));
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (cardId) => {
    try {
      // Check the card is still the next one first: if it was claimed meanwhile, show the new next card instead.
      const { data: fresh } = await evalAPI.getCards();
      setCards(fresh);
      if (fresh.next?.id !== cardId) {
        toast.info(fresh.next ? `Card #${cardId} was just taken. Card #${fresh.next.id} is next now.`
          : `Card #${cardId} was just taken. Generate a new card.`);
        return;
      }
      const { data } = await evalAPI.cardPdf(cardId);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluation-card-${cardId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not download the card'));
    }
  };

  const next = cards?.next;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
            <IdCard className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)]">Run a test</h2>
            <p className="text-sm text-[var(--color-neutral-500)] mt-1">
              1. Generate a card. 2. Show it (or print it) to the participant. 3. Open New Application and run the
              normal interview: the next session reads the card shown here.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button icon={FilePlus2} loading={busy} disabled={busy} onClick={generate}>Generate card</Button>
          {next && (
            <Button variant="secondary" icon={Download} onClick={() => downloadPdf(next.id)}>Download PDF</Button>
          )}
          <Link
            to="/new-application"
            className="text-sm font-medium text-[var(--color-primary)] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-sm)]"
          >
            Open New Application
          </Link>
        </div>

        {cfg && (
          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={cfg.counts}
              disabled={saving}
              onChange={(e) => save({ counts: e.target.checked },
                e.target.checked ? 'The next run counts toward the evaluation.' : 'The next run is a test run (not counted).')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-neutral-800)]">This run counts toward evaluation</span>
              <span className="block text-xs text-[var(--color-neutral-500)] mt-0.5">
                Untick it for a practice run. The next session reads this box when it takes the card.
              </span>
            </span>
          </label>
        )}

        <div className="mt-5">
          {cards && !next && (
            <EmptyState
              icon={IdCard}
              title="No card waiting"
              description="Generate a card before the next participant. A session started with no card is listed but has no WER."
            />
          )}
          {next && (
            <section aria-labelledby="eval-next-card" className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 id="eval-next-card" className="font-display text-lg font-bold text-[var(--color-neutral-900)]">
                  Card #{next.id}
                </h3>
                <Badge tone="info">Next to be read</Badge>
                {cards.waiting > 1 && <Badge tone="neutral">{cards.waiting} cards waiting</Badge>}
              </div>
              <p className="text-xs text-[var(--color-neutral-500)] mb-3">
                A made-up person, not a real resident. When the system asks, read the words on the right exactly.
              </p>
              <dl className="divide-y divide-[var(--color-neutral-200)]">
                {next.lines.map((line) => (
                  <div key={line.key} className="py-2 grid grid-cols-1 sm:grid-cols-[12rem_minmax(0,1fr)] gap-1 sm:gap-4">
                    <dt className="text-sm text-[var(--color-neutral-500)] min-w-0 break-words">{line.label}</dt>
                    <dd className="text-lg font-semibold text-[var(--color-neutral-900)] min-w-0 break-words">{line.read}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default EvalCardPanel;
