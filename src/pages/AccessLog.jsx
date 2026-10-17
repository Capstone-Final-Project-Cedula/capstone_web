import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, History, ShieldCheck } from 'lucide-react';
import { formsAPI } from '../api/forms';
import { getApiErrorMessage } from '../api/errors';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const ACTION_LABELS = {
  list: { label: 'Searched', tone: 'neutral' },
  view: { label: 'Viewed', tone: 'info' },
  download: { label: 'Downloaded', tone: 'primary' },
  print: { label: 'Printed', tone: 'success' },
};

const pageSize = 20;

// Admin-only trail of who searched, viewed, downloaded or printed CTC records (plan 001.3).
const AccessLog = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    formsAPI
      .getAccessLog({ skip: (page - 1) * pageSize, limit: pageSize })
      .then((response) => {
        if (cancelled) return;
        setRows(response.data);
        setTotal(Number(response.headers['x-total-count'] || 0));
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load the access log.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const renderTarget = (row) => {
    if (row.action === 'list') {
      return row.search_text ? (
        <span className="break-words">Searched for “{row.search_text}”</span>
      ) : (
        <span className="text-[var(--color-neutral-500)]">Opened the records list</span>
      );
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-mono-data font-semibold text-[var(--color-primary)]">
          {row.ctc_number || '(deleted record)'}
        </span>
        {row.is_copy === true && <Badge tone="warning">Copy / Re-print</Badge>}
        {row.is_copy === false && <Badge tone="neutral">Original</Badge>}
      </span>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
              <History className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
            </span>
            Access Log
          </h1>
          <p className="text-[var(--color-neutral-500)] mt-1">
            Who searched, viewed, downloaded or printed CTC records. Only admins can see this page.
          </p>
        </div>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/records')}>
          Back to Records
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
              <tr>
                {['When', 'Admin', 'Action', 'Record / search'].map((label) => (
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
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} columns={4} />)
              ) : error ? (
                <tr>
                  <td colSpan="4">
                    <EmptyState
                      icon={ShieldCheck}
                      title="Could not load the access log"
                      description={error}
                      actionLabel="Try again"
                      onAction={() => setReloadKey((key) => key + 1)}
                    />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <EmptyState
                      icon={ShieldCheck}
                      title="Nothing logged yet"
                      description="Searches, views, downloads and prints in Records will appear here."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const action = ACTION_LABELS[row.action] || { label: row.action, tone: 'neutral' };
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3 text-[var(--color-neutral-600)] whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[8rem] max-w-[14rem] break-words">
                        {row.staff_full_name || row.staff_username || '(removed account)'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={action.tone}>{action.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-800)] min-w-[12rem] max-w-[24rem]">
                        {renderTarget(row)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > pageSize && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-neutral-500)]">
            Page {page} of {totalPages} · {total} entries
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="ghost" size="sm" icon={ChevronRight} disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessLog;
