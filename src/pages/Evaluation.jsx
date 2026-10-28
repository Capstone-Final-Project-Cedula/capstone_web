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

const pct = (value) => (value === null || value === undefined ? '—' : `${value}%`);
const show = (value) => (value === null || value === undefined || value === '' ? '—' : String(value));
const formatTime = (value) => (value ? new Date(value).toLocaleString() : '—');

const selectClass = 'h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-white '
  + 'text-sm text-[var(--color-neutral-800)] focus:outline-none focus:border-[var(--color-primary)]';

const Stat = ({ label, value, hint }) => (
  <Card className="p-4 min-w-0">
    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">{label}</div>
    <div className="mt-1 text-2xl font-bold text-[var(--color-neutral-900)] break-words">{value}</div>
    {hint && <div className="mt-1 text-xs text-[var(--color-neutral-500)]">{hint}</div>}
  </Card>
);

const Table = ({ columns, rows, empty }) => (
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
              <td key={j} className="px-3 py-2.5 text-[var(--color-neutral-700)] min-w-0 max-w-[16rem] break-words">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const accuracyRow = (name, v) => [name, v.answers, pct(v.first_try_pct), pct(v.after_ladder_pct), pct(v.finished_pct),
  pct(v.wer_pct), pct(v.skip_pct), show(v.avg_spoken_tries)];
const ACCURACY_COLUMNS = ['', 'Answers', 'First try', 'After ladder', 'Finished', 'WER', 'Skipped', 'Avg tries'];

// Admin-only results page for Chapter 4 (plan 003). Numbers come from the backend's aggregated queries.
const Evaluation = () => {
  const [filters, setFilters] = useState({ round_type: '', condition: '', input_method: '' });
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const params = useCallback(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([evalAPI.getStats(params()), evalAPI.getSessions({ ...params(), limit: 30 })])
      .then(([s, list]) => { if (!cancelled) { setStats(s.data); setSessions(list.data); } })
      .catch((e) => { if (!cancelled) setError(getApiErrorMessage(e, 'Could not load the evaluation results')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params]);

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
          Chapter 4 numbers from the system itself. Practice and Live rounds are left out unless you pick them.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--color-neutral-700)]">
            <span className="block mb-1">Round</span>
            <select className={selectClass} value={filters.round_type} onChange={setFilter('round_type')}>
              <option value="">Study (scripted + UAT)</option>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Stat label="Sessions" value={stats.sessions.total}
              hint={`${stats.sessions.issued} issued, ${stats.sessions.abandoned} abandoned`} />
            <Stat label="First try" value={pct(overall.first_try_pct)} hint="all 14 fields, voice" />
            <Stat label="After the ladder" value={pct(overall.after_ladder_pct)} hint="3 spoken + 2 spelled tries" />
            <Stat label="Finished" value={pct(overall.finished_pct)} hint="said, typed or fixed" />
            <Stat label="WER (scripted)" value={pct(overall.wer_pct)} hint={`${overall.wer_words} reference words`} />
          </div>

          <Card className="p-4">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">
              Overall, hard 5 and easy 9
            </h2>
            <Table
              columns={ACCURACY_COLUMNS}
              empty="No scored sessions yet."
              rows={[accuracyRow('All 14 fields', overall), accuracyRow('Hard 5 (names, address, birthplace)', stats.hard5),
                accuracyRow('Easy 9', stats.easy9)]}
            />
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">Per field</h2>
            <Table
              columns={ACCURACY_COLUMNS}
              empty="No scored sessions yet."
              rows={[
                ...Object.entries(stats.fields).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
                ...Object.entries(stats.address_parts).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
                ...Object.entries(stats.place_of_birth_steps).map(([k, v]) => accuracyRow(FIELD_LABELS[k] || k, v)),
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-3">Timing and models</h2>
              <Table
                columns={['Measure', 'Value']}
                empty=""
                rows={[
                  ['Seconds per question', show(stats.timing.avg_seconds_per_question)],
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
          <EmptyState icon={FlaskConical} title="No sessions yet" description="Sessions appear here once an applicant agrees at the consent notice." />
        ) : (
          <Table
            columns={['Code', 'Round', 'Condition', 'Card', 'Input', 'Outcome', 'Seconds', 'Started', '']}
            empty=""
            rows={sessions.map((s) => [
              s.participant_code, ROUND_LABELS[s.round_type] || s.round_type, s.round_condition, show(s.card_no),
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
              {detail.participant_code} · {ROUND_LABELS[detail.round_type] || detail.round_type}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          </div>
          <Table
            columns={['Field', 'Step', 'Model', 'Heard', 'Understood', 'Final / expected', 'Finished in', '']}
            empty="Nothing logged."
            rows={detail.answers.map((a) => [
              FIELD_LABELS[a.field] || a.field, a.step === 'final' ? 'result' : `${a.step} ${a.attempt_no || ''}`,
              show(a.model), show(a.transcript), show(a.extracted_value),
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
