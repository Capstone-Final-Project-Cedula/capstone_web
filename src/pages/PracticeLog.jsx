import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { practiceLogAPI } from '../api/practiceLog';
import { getApiErrorMessage } from '../api/errors';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const PAGE_SIZE = 20;

const FIELD_LABELS = {
  surname: 'Surname',
  given_name: 'Given name',
  middle_name: 'Middle name',
  address_town: 'Address: town or city',
  address_barangay: 'Address: barangay',
  address_purok: 'Address: purok or street',
  address: 'Address (joined)',
  date: 'Date of birth',
  sex: 'Sex',
  civil_status: 'Civil status',
  citizenship: 'Citizenship',
  icr_no: 'ICR number',
  place_of_birth: 'Place of birth',
  height: 'Height',
  weight: 'Weight',
  occupation: 'Occupation',
  gross_annual_income: 'Gross annual income',
};

const OUTCOME_TONES = { issued: 'success', abandoned: 'warning', open: 'neutral' };
const ENGINE_LABELS = { whisper: 'Whisper', browser: 'Browser', typed: 'Typed', spelled: 'Spelled', skipped: 'Skipped' };

const formatTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const show = (value) => (value === null || value === undefined || value === '' ? '—' : String(value));

const TableHead = ({ labels }) => (
  <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
    <tr>
      {labels.map((label) => (
        <th
          key={label}
          scope="col"
          className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide whitespace-nowrap"
        >
          {label}
        </th>
      ))}
    </tr>
  </thead>
);

// Admin-only view of the TEMPORARY practice session log (plan 001.7; plan 003 replaces it).
const PracticeLog = () => {
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [savingMode, setSavingMode] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailKey, setDetailKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      practiceLogAPI.getStatus(),
      practiceLogAPI.getSessions({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    ])
      .then(([statusResponse, sessionsResponse]) => {
        if (cancelled) return;
        setStatus(statusResponse.data);
        setSessions(sessionsResponse.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load the practice log.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  useEffect(() => {
    if (selected === null) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetail(null);          // never show the previous session's answers under this one
    setDetailError('');
    setDetailLoading(true);
    practiceLogAPI
      .getSession(selected)
      .then((response) => {
        if (!cancelled) setDetail(response.data);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(getApiErrorMessage(err, 'Unable to load that session.'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, detailKey]);

  const changeMode = useCallback(async (mode) => {
    setSavingMode(true);
    try {
      const response = await practiceLogAPI.setMode(mode);
      setStatus(response.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to change the mode.'));
    } finally {
      setSavingMode(false);
    }
  }, []);

  const enabled = Boolean(status?.enabled);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 min-w-0">
        <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
            <ClipboardList className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
          </span>
          Practice Log
        </h1>
        <p className="text-[var(--color-neutral-500)] mt-1">
          Temporary practice log. Turn PRACTICE_LOG_ENABLED off before real residents.
        </p>
      </div>

      <Card className="mb-6 p-5" accent={enabled ? 'success' : 'warning'}>
        {status === null ? (
          <p className="text-sm text-[var(--color-neutral-500)]">{loading ? 'Loading…' : 'Status unavailable.'}</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3 min-w-0">
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Logging</dt>
                <dd className="mt-1">
                  <Badge tone={enabled ? 'success' : 'warning'} dot>
                    {enabled ? 'On' : 'Off'}
                  </Badge>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Build</dt>
                <dd className="mt-1 text-sm text-[var(--color-neutral-800)] break-words">{status.build_label}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]">Backend commit</dt>
                <dd className="mt-1 font-mono-data text-sm text-[var(--color-neutral-800)] break-words">{status.backend_commit}</dd>
              </div>
            </dl>
            <div className="shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-1.5">
                New sessions count as
              </p>
              <div className="flex gap-2" role="group" aria-label="Mode for new sessions">
                {['test', 'real'].map((mode) => (
                  <Button
                    key={mode}
                    size="lg"
                    variant={status.mode === mode ? 'primary' : 'secondary'}
                    aria-pressed={status.mode === mode}
                    disabled={!enabled || savingMode}
                    onClick={() => status.mode !== mode && changeMode(mode)}
                  >
                    {mode === 'test' ? 'Test' : 'Real'}
                  </Button>
                ))}
              </div>
              {!enabled && (
                <p className="mt-1.5 text-xs text-[var(--color-neutral-500)]">
                  Set PRACTICE_LOG_ENABLED=True in the backend .env to log.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead labels={['When', 'Build', 'Mode', 'Staff', 'Outcome', 'Answers']} />
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} columns={6} />)
              ) : error ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={ShieldCheck}
                      title="Could not load the practice log"
                      description={error}
                      actionLabel="Try again"
                      onAction={() => setReloadKey((key) => key + 1)}
                    />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={ClipboardList}
                      title={enabled ? 'No practice sessions yet' : 'The practice log is off'}
                      description={
                        enabled
                          ? 'Press “I agree, start” on New Application and answer by voice. The session appears here.'
                          : 'Nothing is being logged.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                sessions.map((row) => (
                  <tr
                    key={row.id}
                    className={`align-top ${selected === row.id ? 'bg-[var(--color-primary-light)]' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelected(selected === row.id ? null : row.id)}
                        aria-expanded={selected === row.id}
                        className="inline-flex min-h-[44px] items-center text-left font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] rounded-[var(--radius-sm)]"
                      >
                        {formatTime(row.started_at)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[8rem] max-w-[14rem] break-words">
                      {show(row.build_label)}
                      <span className="block font-mono-data text-xs text-[var(--color-neutral-500)]">{show(row.backend_commit)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.mode === 'real' ? 'error' : 'info'}>{row.mode === 'real' ? 'Real' : 'Test'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[7rem] max-w-[12rem] break-words">
                      {row.staff_username || '(removed account)'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={OUTCOME_TONES[row.outcome] || 'neutral'}>{row.outcome}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-neutral-800)] whitespace-nowrap">{row.answers_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {(page > 1 || sessions.length === PAGE_SIZE) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-neutral-500)]">Page {page}</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronRight}
              disabled={sessions.length < PAGE_SIZE}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selected !== null && (
        <Card className="mt-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-neutral-100)]">
            <h2 className="font-display text-lg font-semibold text-[var(--color-neutral-900)]">Session {selected}: answers</h2>
            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
              “First voice value” and “Saved” are compared in the saved form (the birthday as a date, the address as one line).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead labels={['Question', 'Tries', 'First voice value', 'Accepted', 'By', 'Seconds', 'Saved', 'Changed']} />
              <tbody className="divide-y divide-[var(--color-neutral-100)]">
                {detailError ? (
                  <tr>
                    <td colSpan="8">
                      <EmptyState
                        icon={ShieldCheck}
                        title="Could not load this session"
                        description={detailError}
                        actionLabel="Try again"
                        onAction={() => setDetailKey((key) => key + 1)}
                      />
                    </td>
                  </tr>
                ) : detailLoading || !detail || detail.id !== selected ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} columns={8} />)
                ) : detail.answers.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <EmptyState icon={ClipboardList} title="No answers in this session" description="Nothing was answered by voice." />
                    </td>
                  </tr>
                ) : (
                  detail.answers.map((answer) => (
                    <tr key={answer.field} className="align-top">
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[9rem]">{FIELD_LABELS[answer.field] || answer.field}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{answer.attempts}</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[8rem] max-w-[14rem] break-words">{show(answer.first_value)}</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[8rem] max-w-[14rem] break-words">{show(answer.accepted_value)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{ENGINE_LABELS[answer.accepted_engine] || answer.accepted_engine}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{show(answer.seconds)}</td>
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[8rem] max-w-[14rem] break-words">{show(answer.final_value)}</td>
                      <td className="px-4 py-3">
                        {answer.changed_after_voice === true && <Badge tone="warning">Changed</Badge>}
                        {answer.changed_after_voice === false && <Badge tone="success">Unchanged</Badge>}
                        {answer.changed_after_voice === null && <span className="text-[var(--color-neutral-500)]">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PracticeLog;
