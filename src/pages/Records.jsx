import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsAPI } from '../api/forms';
import { getApiErrorMessage } from '../api/errors';
import { toast } from 'react-toastify';
import { Search, Plus, X, Download, Printer, History, FileSearch, Mic, QrCode, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { downloadPdf, downloadAndPrintPdf, fileNameFromResponse } from '../utils/printPdf';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTableRow } from '../components/ui/Skeleton';

// Narrow screens: Date Issued and Mode are hidden, and Actions stays pinned to the right
// edge, so the Print button is always on screen while the other columns scroll. On a phone
// the CTC number, birth date and address move under the applicant's name, so two people
// with the same name can still be told apart.
const COLUMNS = [
  { label: 'CTC Number', className: 'hidden sm:table-cell' },
  { label: 'Applicant' },
  { label: 'Birth Date', className: 'hidden sm:table-cell' },
  { label: 'Address', className: 'hidden sm:table-cell' },
  { label: 'Date Issued', className: 'hidden xl:table-cell' },
  { label: 'Mode', className: 'hidden xl:table-cell' },
  { label: 'Actions', className: 'sticky right-0 bg-[var(--color-neutral-50)] shadow-[-1px_0_0_var(--color-neutral-100)]' },
];
const STICKY_CELL = 'sticky right-0 bg-white group-hover:bg-[var(--color-neutral-50)] shadow-[-1px_0_0_var(--color-neutral-100)] transition-colors duration-150';

// "1990-05-02" → the local date, without the UTC shift new Date("1990-05-02") would add.
const formatBirthDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return '—';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
};

const fullName = (applicant) =>
  [applicant?.surname && `${applicant.surname},`, applicant?.given_name, applicant?.middle_name]
    .filter(Boolean)
    .join(' ');

const Records = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  // searchInput follows the box; searchTerm is sent to the server once typing pauses,
  // so the access log gets one row per search instead of one per key.
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyDownload, setBusyDownload] = useState(null); // `${ctc}:${purpose}` while fetching
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
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== searchTerm) {
        setSearchTerm(next);
        setPage(1);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchTerm]);

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
      toast.error(getApiErrorMessage(error, 'Unable to delete this record.'));
    } finally {
      setDeletingId(null);
    }
  };

  // Download saves the file; Print saves it and opens the print dialog. The first one
  // for a CTC is the original; the server marks every later one COPY / RE-PRINT.
  const handleFile = async (ctcNumber, purpose) => {
    setBusyDownload(`${ctcNumber}:${purpose}`);
    try {
      const response = await formsAPI.download(ctcNumber, purpose);
      const fileName = fileNameFromResponse(response, `${ctcNumber}.pdf`);
      const isCopy = fileName.includes('_COPY');
      if (purpose === 'print') downloadAndPrintPdf(response.data, fileName);
      else downloadPdf(response.data, fileName);
      const what = purpose === 'print' ? 'Opening the print dialog' : 'Download started';
      toast.success(isCopy ? `${what} (marked COPY / RE-PRINT)` : what);
    } catch (error) {
      console.error(`Error during ${purpose}:`, error);
      toast.error(purpose === 'print' ? 'Could not print this CTC.' : 'Error downloading file');
    } finally {
      setBusyDownload(null);
    }
  };

  const hasActiveFilters = searchInput !== '' || filter !== 'all';

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
          <p className="text-[var(--color-neutral-500)] mt-1">Find the applicant by name, collect payment, then print.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={History} onClick={() => navigate('/access-log')}>
            Access Log
          </Button>
          <Button icon={Plus} onClick={() => navigate('/new-application')}>
            New Application
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[var(--color-neutral-400)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by name (any order) or CTC number…"
              aria-label="Search records by name or CTC number"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
                setSearchInput('');
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
                {COLUMNS.map(({ label, className = '' }) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide whitespace-nowrap ${className}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} columns={7} />)
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7">
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
                  <tr key={record.id} className="group hover:bg-[var(--color-neutral-50)] transition-colors duration-150 align-top">
                    <td className="hidden sm:table-cell px-4 py-4 font-mono-data font-semibold text-[var(--color-primary)] whitespace-nowrap">
                      {record.ctc_number}
                    </td>
                    <td className="px-4 py-4 text-[var(--color-neutral-800)] font-medium min-w-[10rem] max-w-[16rem] break-words">
                      {fullName(record.applicant)}
                      <span className="sm:hidden mt-1 block font-mono-data text-xs font-semibold text-[var(--color-primary)]">
                        {record.ctc_number}
                      </span>
                      <span className="sm:hidden mt-1 block text-xs font-normal text-[var(--color-neutral-600)]">
                        Born {formatBirthDate(record.applicant?.date_of_birth)}
                      </span>
                      <span className="sm:hidden mt-0.5 block text-xs font-normal text-[var(--color-neutral-600)] break-words">
                        {record.applicant?.address || '—'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-4 text-[var(--color-neutral-600)] whitespace-nowrap">
                      {formatBirthDate(record.applicant?.date_of_birth)}
                    </td>
                    <td
                      className="hidden sm:table-cell px-4 py-4 text-[var(--color-neutral-600)] min-w-[10rem] max-w-[16rem] break-words"
                      title={record.applicant?.address || ''}
                    >
                      {record.applicant?.address || '—'}
                    </td>
                    <td className="hidden xl:table-cell px-4 py-4 text-[var(--color-neutral-500)] whitespace-nowrap">
                      {record.issued_at ? new Date(record.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="hidden xl:table-cell px-4 py-4">
                      {record.input_method === 'voice' ? (
                        <Badge tone="voice" icon={Mic}>Voice</Badge>
                      ) : record.input_method === 'qr' ? (
                        <Badge tone="qr" icon={QrCode}>QR</Badge>
                      ) : (
                        <Badge tone="neutral">Manual</Badge>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${STICKY_CELL}`}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          icon={Printer}
                          loading={busyDownload === `${record.ctc_number}:print`}
                          disabled={busyDownload !== null}
                          onClick={() => handleFile(record.ctc_number, 'print')}
                          aria-label={`Print CTC ${record.ctc_number}`}
                        >
                          Print
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Download}
                          loading={busyDownload === `${record.ctc_number}:download`}
                          disabled={busyDownload !== null}
                          onClick={() => handleFile(record.ctc_number, 'download')}
                          aria-label={`Download CTC ${record.ctc_number}`}
                        >
                          <span className="hidden xl:inline">Download</span>
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={Trash2}
                            disabled={deletingId === record.id}
                            onClick={() => handleDelete(record)}
                            aria-label={`Delete CTC ${record.ctc_number}`}
                          >
                            <span className="hidden xl:inline">{deletingId === record.id ? 'Deleting...' : 'Delete'}</span>
                          </Button>
                        )}
                      </div>
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