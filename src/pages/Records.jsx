import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsAPI } from '../api/forms';
import { toast } from 'react-toastify';
import { Search, Plus, X, Download, FileSearch, Mic, QrCode, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTableRow } from '../components/ui/Skeleton';

const Records = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const visiblePages = Array.from(
    new Set([1, totalPages, ...Array.from({ length: 5 }, (_, i) => page - 2 + i)
      .filter((number) => number >= 1 && number <= totalPages)])
  ).sort((a, b) => a - b);

  useEffect(() => {
    fetchRecords();
  }, [page, searchTerm, filter]);

  const fetchRecords = async () => {
    try {
      const response = await formsAPI.getRecords({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search: searchTerm || undefined,
        input_method: filter === 'all' ? undefined : filter,
      });
      setRecords(response.data);
      setTotalRecords(Number(response.headers['x-total-count'] || 0));
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Error loading records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete CTC ${record.ctc_number}? This cannot be undone.`)) return;
    setDeletingId(record.id);
    try {
      await formsAPI.deleteRecord(record.id);
      toast.success(`CTC ${record.ctc_number} deleted.`);
      if (records.length === 1 && page > 1) setPage(page - 1);
      else fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Unable to delete this record.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (ctcNumber) => {
    try {
      const response = await formsAPI.download(ctcNumber);
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `CTC_${ctcNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Error downloading file');
    }
  };

  const hasActiveFilters = searchTerm !== '' || filter !== 'all';

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
            </span>
            Records
          </h1>
          <p className="text-[var(--color-neutral-500)] mt-1">View and manage all issued CTCs.</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/new-application')}>
          New Application
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[var(--color-neutral-400)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by name or CTC number…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="focusable w-full h-10 pl-10 pr-3.5 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] text-sm outline-none transition-all duration-150 focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="focusable h-10 px-3.5 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] text-sm bg-white outline-none transition-all duration-150 focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]"
          >
            <option value="all">All Records</option>
            <option value="voice">Voice Processed</option>
            <option value="qr">QR Processed</option>
            <option value="manual">Manual</option>
          </select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="md"
              icon={X}
              onClick={() => {
                setSearchTerm('');
                setFilter('all');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Records Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  CTC Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Applicant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Date Issued
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} columns={5} />)
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      icon={FileSearch}
                      title={hasActiveFilters ? 'No matching records' : 'No records yet'}
                      description={
                        hasActiveFilters
                          ? 'Try a different name, CTC number, or filter.'
                          : 'Issued CTCs will appear here once you start processing applications.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-[var(--color-neutral-50)] transition-colors duration-150">
                    <td className="px-6 py-4 font-mono-data font-semibold text-[var(--color-primary)]">
                      {record.ctc_number}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-neutral-800)]">
                      {record.applicant?.surname}, {record.applicant?.given_name}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-neutral-500)]">
                      {record.issued_at ? new Date(record.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {record.input_method === 'voice' ? (
                        <Badge tone="voice" icon={Mic}>Voice</Badge>
                      ) : record.input_method === 'qr' ? (
                        <Badge tone="qr" icon={QrCode}>QR</Badge>
                      ) : (
                        <Badge tone="neutral">Manual</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDownload(record.ctc_number)}
                        className="focusable inline-flex items-center gap-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium rounded-[var(--radius-sm)] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        Download
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === record.id}
                          className="focusable ml-4 inline-flex items-center gap-1.5 text-[var(--color-error)] hover:opacity-80 font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {deletingId === record.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalRecords > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-neutral-500)]">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)} of {totalRecords} records
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            {visiblePages.map((number, index) => (
              <React.Fragment key={number}>
                {index > 0 && number - visiblePages[index - 1] > 1 && (
                  <span className="px-1 text-[var(--color-neutral-400)]" aria-hidden="true">…</span>
                )}
                <button
                  onClick={() => setPage(number)}
                  className={`focusable min-w-9 h-9 rounded-[var(--radius-md)] text-sm font-medium ${page === number ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]'}`}
                  aria-current={page === number ? 'page' : undefined}
                >
                  {number}
                </button>
              </React.Fragment>
            ))}
            <Button variant="ghost" size="sm" icon={ChevronRight} disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;