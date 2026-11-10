import React, { useCallback, useEffect, useState } from 'react';
import { Download, FlaskConical, Play } from 'lucide-react';
import { toast } from 'react-toastify';
import { evalAPI } from '../api/eval';
import { getApiErrorMessage } from '../api/errors';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonLine } from '../components/ui/Skeleton';
import EvalSettingsCard from '../components/eval/EvalSettingsCard';
import EvalCardPanel from '../components/eval/EvalCardPanel';
import HandScorePanel from '../components/eval/HandScorePanel';

export const FIELD_LABELS = {
  surname: 'Surname', given_name: 'Given name', middle_name: 'Middle name', address: 'Address',
  place_of_birth: 'Place of birth', date: 'Date of birth', sex: 'Sex', civil_status: 'Civil status',
  citizenship: 'Citizenship', icr_no: 'ICR number', height: 'Height', weight: 'Weight',
  occupation: 'Occupation', gross_annual_income: 'Gross annual income',
  address_town: 'Address: town or city', address_barangay: 'Address: barangay', address_purok: 'Address: purok or street',
  place_of_birth_province: 'Place of birth: province or city', place_of_birth_town: 'Place of birth: town',
};
const ROUND_LABELS = { practice: 'Practice', scripted: 'Scripted test', uat: 'Real UAT', live: 'Live' };
const OUTCOME_TONES = { issued: 'success', abandoned: 'warning', open: 'neutral' };
// Which WER is the headline (plan 009, still open for Ralph): 'whisper' = Whisper's own count, with the
// hand-scored value shown beside it; 'hand' = the hand re-score where one exists, Whisper's count elsewhere.
const HEADLINE_WER = 'whisper';

const pct = (value) => (value === null || value === undefined ? '—' : `${value}%`);
const show = (value) => (value === null || value === undefined || value === '' ? '—' : String(value));
const formatTime = (value) => (value ? new Date(value).toLocaleString() : '—');

const selectClass = 'h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-white '
  + 'text-sm text-[var(--color-neutral-800)] focus:outline-none focus:border-[var(--color-primary)]';

const Stat = ({ label, value, hint, children }) => (
  <Card className="p-4 min-w-0">
    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] break-words">{label}</div>
    <div className="mt-1 text-2xl font-bold text-[var(--color-neutral-900)] break-words">{value}</div>
    {[].concat(hint || []).map((line) => (
      <div key={line} className="mt-1 text-xs text-[var(--color-neutral-500)] break-words">{line}</div>
    ))}
    {children && <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>}
  </Card>
);

// The target is shown next to the number; the number itself is never changed.
const Target = ({ value, target, atMost }) => {
  if (value === null || value === undefined) return null;
  const met = atMost ? value <= target : value >= target;
  return <Badge tone={met ? 'success' : 'warning'}>{`target ${atMost ? '≤' : '≥'} ${target}%: ${met ? 'met' : 'not met'}`}</Badge>;
};

// `numeric`: every column after the first is a number and stays on one line (the table scrolls inside its box).
const Table = ({ columns, rows, empty, numeric = false }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide whitespace-nowrap">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-neutral-100)]">
        {rows.length === 0 && (
          <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[var(--color-neutral-500)]">{empty}</td></tr>
        )}
        {rows.map((cells, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <tr key={i}>
            {cells.map((cell, j) => (
              // eslint-disable-next-line react/no-array-index-key
              <td key={j} className={`px-3 py-2.5 text-[var(--color-neutral-700)] min-w-0 max-w-[16rem] break-words${
                numeric && j > 0 ? ' whitespace-nowrap' : ''}${numeric && j === 0 ? ' min-w-[9rem]' : ''}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const words = (errors, n) => (n ? `${errors} / ${n}` : '—');
const accuracyRow = (name, v) => [name, v.answers, pct(v.field_extraction_pct), pct(v.first_try_pct), pct(v.finished_pct),
  pct(v.wer_pct), words(v.wer_errors, v.wer_words), v.wer_words ? `${v.substitutions} / ${v.deletions} / ${v.insertions}` : '—',
  v.hand_scored ? pct(v.hand_wer_pct) : '—', show(v.skipped), show(v.avg_seconds)];
const ACCURACY_COLUMNS = ['', 'Answers', 'Field extraction', 'First try', 'Finished', 'WER', 'Errors / words',
  'S / D / I', 'Hand WER', 'Skipped', 'Avg seconds'];

const cardLabel = (s) => {
  if (s.card_id) return `#${s.card_id}`;
  if (s.card_no) return `fixed ${s.card_no}`;
  return 'no card';
};
const countedBadge = (s) => {
  if (s.counted) return <Badge key="c" tone="success">counted</Badge>;
  return <Badge key="c" tone="neutral">{s.counts ? 'not counted' : 'test run'}</Badge>;
};

// Admin-only evaluation page (plan 003, reworked by plan 009): the switch, the test routine ("Generate card"),
// then Chapter 4's numbers from the backend's aggregated queries. It stays in the sidebar when the switch is off.
const Evaluation = () => {
  const [filters, setFilters] = useState({ view: 'counted', round_type: '', condition: '', input_method: '' });
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  const params = useCallback(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters],
  );

  useEffect(() => {
    evalAPI.getSettings()
      .then(({ data }) => setCfg(data))
      .catch((e) => toast.error(getApiErrorMessage(e, 'Could not load the evaluation settings')));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([evalAPI.getStats(params()), evalAPI.getSessions({ ...params(), limit: 30 })])
      .then(([s, list]) => { if (!cancelled) { setStats(s.data); setSessions(list.data); } })
      .catch((e) => { if (!cancelled) setError(getApiErrorMessage(e, 'Could not load the evaluation results')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params, reload]);

  const save = async (changes, message) => {
    setSaving(true);
    try {
      const { data } = await evalAPI.saveSettings(changes);
      setCfg(data);
      toast.success(message || 'Evaluation settings saved.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the evaluation settings'));
    } finally {
      setSaving(false);
    }
  };

  const download = async (kind) => {
    try {
      const { data } = await evalAPI.exportCsv(kind, params());
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluation-${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not export the CSV'));
    }
  };

  const openSession = async (id) => {
    try {
      const { data } = await evalAPI.getSession(id);
      setDetail(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not open the session'));
    }
  };

  const play = async (answerId) => {
    try {
      const { data } = await evalAPI.getAudio(answerId);
      const url = URL.createObjectURL(data);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not play the clip'));
    }
  };

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const overall = stats?.overall;
  const wer = stats?.wer;
  const handFirst = HEADLINE_WER === 'hand' && wer?.hand_scored;
  const headWer = wer && (handFirst
    ? { pct: wer.hand_pct, errors: wer.hand_errors, words: wer.hand_words }
    : { pct: wer.pct, errors: wer.errors, words: wer.words });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
            <FlaskConical className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
          </span>
          Evaluation
        </h1>
        <p className="text-[var(--color-neutral-500)] mt-2 max-w-3xl">
          Chapter 4 numbers from the system itself. By default only counted sessions are used: finished, with a card,
          the "counts toward evaluation" box ticked, and not a Practice round.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <EvalCardPanel cfg={cfg} saving={saving} save={save} />
        <EvalSettingsCard cfg={cfg} saving={saving} save={save} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--color-neutral-700)]">
            <span className="block mb-1">Sessions</span>
            <select className={selectClass} value={filters.view} onChange={setFilter('view')}>
              <option value="counted">Counted sessions</option>
              <option value="all">All sessions</option>
            </select>
          </label>
          <label className="text-sm text-[var(--color-neutral-700)]">
            <span className="block mb-1">Round</span>
            <select className={selectClass} value={filters.round_type} onChange={setFilter('round_type')}>
              <option value="">Any round</option>
              {Object.entries(ROUND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--color-neutral-700)]">
            <span className="block mb-1">Condition</span>
            <select className={selectClass} value={filters.condition} onChange={setFilter('condition')}>
              <option value="">Any</option><option value="quiet">Quiet</option><option value="noisy">Noisy</option>
            </select>
          </label>
          <label className="text-sm text-[var(--color-neutral-700)]">
            <span className="block mb-1">Input</span>
            <select className={selectClass} value={filters.input_method} onChange={setFilter('input_method')}>
              <option value="">Any</option><option value="voice">Voice</option><option value="qr">QR</option><option value="manual">Manual</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="secondary" icon={Download} onClick={() => download('summary')}>Summary CSV</Button>
            <Button variant="secondary" icon={Download} onClick={() => download('sessions')}>Sessions CSV</Button>
            <Button variant="secondary" icon={Download} onClick={() => download('answers')}>Answers CSV</Button>
          </div>
        </div>
      </Card>

      {error && <p className="text-[var(--color-error)]" role="alert">{error}</p>}
      {loading && !stats && <SkeletonLine className="h-24" />}

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat
              label={`WER = (S + D + I) ÷ N${handFirst ? ', hand-scored' : ''}`}
              value={pct(headWer.pct)}
              hint={[`${headWer.errors} errors / ${headWer.words} words / ${wer.participants} participants`,
                `S ${wer.substitutions} · D ${wer.deletions} · I ${wer.insertions}`, 'first spoken try, all 14 questions']}
            >
              <Target value={headWer.pct} target={stats.targets.wer_pct} atMost />
              {wer.hand_scored > 0 && (
                <Badge tone="info">
                  {handFirst ? `Whisper only ${pct(wer.pct)}` : `hand-scored ${pct(wer.hand_pct)}`}
                  {` (${wer.hand_scored} re-scored)`}
                </Badge>
              )}
            </Stat>
            <Stat
              label="Field extraction accuracy"
              value={pct(overall.field_extraction_pct)}
              hint={['voice, retries counted; a skip or blank is a miss',
                `first try ${pct(overall.first_try_pct)} · finished ${pct(overall.finished_pct)}`]}
            >
              <Target value={overall.field_extraction_pct} target={stats.targets.field_extraction_pct} />
            </Stat>
            <Stat
              label="Counted sessions"
              value={`${stats.progress.counted} of ${stats.progress.target}`}
              hint={`${stats.sessions.total} in view: ${stats.sessions.issued} issued, ${stats.sessions.abandoned} abandoned`}
            />
            <Stat
              label="Seconds per question"
              value={show(stats.timing.avg_seconds_per_question)}
              hint={`skipped questions left out: ${stats.timing.skipped_questions} skipped`
                + (stats.timing.avg_seconds_skipped !== null ? `, ${stats.timing.avg_seconds_skipped} s on average` : '')}
            />
          </div>

          <Card className="p-4">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">
              All 14 questions and each field
            </h2>
            <Table
              columns={ACCURACY_COLUMNS}
              numeric
              empty="No scored sessions yet."
              rows={overall.answers ? [
                accuracyRow('All 14 questions', overall),
                ...Object.entries(stats.fields).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
                ...Object.entries(stats.address_parts).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
                ...Object.entries(stats.place_of_birth_steps).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
              ] : []}
            />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">Timing and models</h2>
              <Table
                columns={['Measure', 'Value']}
                empty=""
                rows={[
                  ['Seconds per question (skips left out)', show(stats.timing.avg_seconds_per_question)],
                  ['Skipped questions (seconds on average)', `${stats.timing.skipped_questions} (${show(stats.timing.avg_seconds_skipped)})`],
                  ['Seconds per application (consent to issued)', show(stats.timing.avg_seconds_per_application)],
                  ['Seconds QR scan to issued', show(stats.timing.avg_seconds_qr_to_issued)],
                  ['Whisper seconds per answer', show(stats.timing.avg_whisper_seconds)],
                  ...stats.models.map((m) => [`First try with ${m.model} (${m.answers} answers)`, pct(m.first_try_pct)]),
                ]}
              />
            </Card>
            <Card className="p-4">
              <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">Errors and security</h2>
              <Table
                columns={['Count', 'Value']}
                empty=""
                rows={[
                  ['Errors during interviews', stats.errors],
                  ['Failed logins', stats.security.login_failed],
                  ['Unauthorized (401)', stats.security.unauthorized],
                  ['Forbidden (403)', stats.security.forbidden],
                ]}
              />
            </Card>
          </div>
        </>
      )}

      <Card className="p-4">
        <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">Sessions</h2>
        {sessions.length === 0 && !loading ? (
          <EmptyState icon={FlaskConical} title="No sessions yet"
            description={filters.view === 'counted'
              ? 'No counted session yet. Pick "All sessions" to see practice runs and sessions without a card.'
              : 'Sessions appear here once an applicant agrees at the consent notice.'} />
        ) : (
          <Table
            columns={['Code', 'Round', 'Card', 'Counts', 'Input', 'Outcome', 'Seconds', 'Started', '']}
            empty=""
            rows={sessions.map((s) => [
              s.participant_code, ROUND_LABELS[s.round_type] || s.round_type, cardLabel(s), countedBadge(s),
              s.input_method, <Badge key="o" tone={OUTCOME_TONES[s.outcome] || 'neutral'}>{s.outcome}</Badge>,
              show(s.app_seconds), formatTime(s.started_at),
              <Button key="b" size="sm" variant="ghost" onClick={() => openSession(s.id)}>Open</Button>,
            ])}
          />
        )}
      </Card>

      {detail && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] break-words min-w-0">
              {detail.participant_code} · {ROUND_LABELS[detail.round_type] || detail.round_type} · {cardLabel(detail)}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-neutral-800)] mb-1">Re-score by hand</h3>
          <p className="text-xs text-[var(--color-neutral-500)] mb-2">
            Play the clip and check it against the card. Errors / words are Whisper&apos;s first spoken try.
          </p>
          <HandScorePanel
            detail={detail}
            labels={FIELD_LABELS}
            onPlay={play}
            onSaved={() => { openSession(detail.id); setReload((n) => n + 1); }}
          />
          <h3 className="text-sm font-semibold text-[var(--color-neutral-800)] mt-5 mb-2">Every try</h3>
          <Table
            columns={['Field', 'Step', 'Model', 'Card says', 'Heard', 'Understood', 'Final / expected', 'Finished in', '']}
            empty="Nothing logged."
            rows={detail.answers.map((a) => [
              FIELD_LABELS[a.field] || a.field, a.step === 'final' ? 'result' : `${a.step} ${a.attempt_no || ''}`,
              show(a.model), show(a.card_read), show(a.transcript), show(a.extracted_value),
              a.step === 'final' ? `${show(a.final_value)} / ${show(a.expected_value)}` : '—',
              show(a.finished_in),
              a.has_audio ? <Button key="p" size="sm" variant="ghost" icon={Play} onClick={() => play(a.id)}>Play</Button> : '',
            ])}
          />
        </Card>
      )}
    </div>
  );
};

export default Evaluation;
