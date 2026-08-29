import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsAPI } from '../api/forms';
import { toast } from 'react-toastify';
import { Search, Plus, X, Download, FileSearch, Mic, QrCode } from 'lucide-react';
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await formsAPI.getRecords();
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Error loading records');
    } finally {
      setLoading(false);
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

  const filteredRecords = records.filter((record) => {
    const searchMatch =
      record.ctc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.applicant?.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.applicant?.given_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'voice') {
      return searchMatch && record.input_method === 'voice';
    }
    if (filter === 'qr') {
      return searchMatch && record.input_method === 'qr';
    }
    if (filter === 'manual') {
      return searchMatch && record.input_method === 'manual';
    }
    return searchMatch;
  });

  const hasActiveFilters = searchTerm !== '' || filter !== 'all';

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)]">Records</h1>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="focusable w-full h-10 pl-10 pr-3.5 border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] text-sm outline-none transition-all duration-150 focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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
              ) : filteredRecords.length === 0 ? (
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
                filteredRecords.map((record) => (
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Records;