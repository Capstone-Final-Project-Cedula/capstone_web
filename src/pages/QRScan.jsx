import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  QrCode,
  Camera,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Smartphone,
  ScanLine,
  FileCheck2,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import QRScanner from '../components/QRScanner/QRScanner';
import { qrAPI } from '../api/qr';
import { formsAPI } from '../api/forms';
import { getApiErrorMessage } from '../api/errors';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import SusSurveyDialog from '../components/sus/SusSurveyDialog';
import { COUNTER_LINE } from '../utils/counterFlow';
import {
  REQUIRED_FIELDS,
  SEX_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  isValidIsoDate,
  missingRequiredFields,
} from '../utils/requiredFields';

// Today as YYYY-MM-DD on this computer's clock (toISOString would be UTC, a day behind
// in the Philippines from 00:00 to 08:00).
const localTodayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const QRScan = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [surveyTransactionId, setSurveyTransactionId] = useState(null);
  const [issued, setIssued] = useState(false);
  // Required fields shown as inputs: the ones blank or invalid at scan time, plus any
  // the server names in a 422. They stay inputs while being filled (plan 001.4).
  const [openFields, setOpenFields] = useState([]);
  const [serverErrors, setServerErrors] = useState({});

  const formData = scannedData?.form_data || {};
  const missing = missingRequiredFields(formData);
  // A field the server refused stays blocking until it is edited (updateField clears it),
  // even if the web's own check thinks it is filled.
  const canIssue = Object.keys(missing).length === 0 && Object.keys(serverErrors).length === 0;
  // Every key the phone sent, plus any required field it left out entirely.
  const fieldKeys = [
    ...Object.keys(formData),
    ...REQUIRED_FIELDS.map(({ key }) => key).filter((key) => !(key in formData)),
  ];

  const updateField = (key, value) => {
    setScannedData((prev) => ({ ...prev, form_data: { ...prev.form_data, [key]: value } }));
    setServerErrors((prev) => {
      const { [key]: _cleared, ...rest } = prev;
      return rest;
    });
  };

  const handleQRScan = async (decodedText) => {
    setIsLoading(true);
    try {
      let qrToken = decodedText;
      try {
        const parsed = JSON.parse(decodedText);
        qrToken = parsed.token || parsed.qr_token || decodedText;
      } catch {
        qrToken = decodedText;
      }

      const result = await qrAPI.scan(qrToken);
      const blank = Object.keys(missingRequiredFields(result.data?.form_data || {}));
      setScannedData(result.data);
      setOpenFields(blank);
      setServerErrors({});
      if (blank.length) {
        toast.warning('QR code scanned. Some required details are missing: fill them in before issuing.');
      } else {
        toast.success('QR code scanned successfully - form auto-populated.');
      }
      setShowScanner(false);
    } catch (error) {
      console.error('Error scanning QR:', error);
      toast.error(getApiErrorMessage(error, 'Invalid QR Code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueForm = async () => {
    if (!canIssue) return;
    setIsLoading(true);
    try {
      const result = await formsAPI.issue(scannedData.form_data, 'qr');
      toast.success('Application saved.');
      setScannedData(null);
      setOpenFields([]);
      setIssued(true);
      // Offer the usability survey; closing it gets the scanner ready for the next applicant.
      setSurveyTransactionId(result.data.id);
    } catch (error) {
      console.error('Error issuing form:', error);
      // The scanned data stays on screen. A 422 names the fields to fix: open them for editing.
      const detail = error.response?.data?.detail;
      const named = Array.isArray(detail)
        ? detail.filter((item) => item.loc?.[1] === 'applicant_data'
            && REQUIRED_FIELDS.some(({ key }) => key === item.loc?.[2]))
        : [];
      if (named.length) {
        setOpenFields((prev) => Array.from(new Set([...prev, ...named.map((item) => item.loc[2])])));
        setServerErrors(Object.fromEntries(named.map((item) => [item.loc[2], item.msg])));
        toast.error('Some required details are missing. Fill in the highlighted fields, then issue again.');
      } else {
        toast.error(getApiErrorMessage(error, 'Error issuing CTC. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setScannedData(null);
    setOpenFields([]);
    setServerErrors({});
    setShowScanner(true);
  };

  const handleSurveyClosed = () => {
    setSurveyTransactionId(null);
    setIssued(false);
    setScannedData(null);
    setOpenFields([]);
    setServerErrors({});
    setShowScanner(false);
  };

  const renderFieldInput = (key) => {
    const field = REQUIRED_FIELDS.find((item) => item.key === key);
    const value = formData[key];
    const inputId = `qr-field-${key}`;
    const error = serverErrors[key];
    const selectClass = [
      'focusable w-full h-11 px-3.5 border rounded-[var(--radius-md)] text-[15px] bg-white outline-none',
      'transition-all duration-150 focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]',
      error ? 'border-[var(--color-error)]' : 'border-[var(--color-neutral-200)]',
    ].join(' ');

    let control;
    if (key === 'sex' || key === 'civil_status') {
      const options = key === 'sex' ? SEX_OPTIONS : CIVIL_STATUS_OPTIONS;
      control = (
        <>
          <select
            id={inputId}
            value={options.includes(value) ? value : ''}
            onChange={(e) => updateField(key, e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            className={selectClass}
          >
            <option value="">Select…</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {error && <p className="mt-1.5 text-xs font-medium text-[var(--color-error)] break-words">{error}</p>}
        </>
      );
    } else {
      control = (
        <Input
          id={inputId}
          type={key === 'date_of_birth' ? 'date' : 'text'}
          value={key === 'date_of_birth' ? (isValidIsoDate(value) ? value : '') : (value ?? '')}
          onChange={(e) => updateField(key, e.target.value)}
          max={key === 'date_of_birth' ? localTodayIso() : undefined}
          error={error}
          autoComplete="off"
        />
      );
    }

    return (
      <div
        key={key}
        className="p-3.5 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-100)] min-w-0"
      >
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)]"
          >
            {field ? field.label : key.replace(/_/g, ' ')}
          </label>
          {missing[key] && (
            <Badge tone="warning" icon={AlertTriangle}>Needed before issuing</Badge>
          )}
        </div>
        {control}
      </div>
    );
  };

  const scanSteps = [
    {
      title: 'Open mobile app',
      description: 'Ask the citizen to open their CeduSync mobile QR screen.',
      icon: Smartphone,
    },
    {
      title: 'Display QR code',
      description: 'Keep the code bright, steady, and inside the scanner frame.',
      icon: QrCode,
    },
    {
      title: 'Scan the code',
      description: 'Use the camera scanner to validate the secure QR token.',
      icon: ScanLine,
    },
    {
      title: 'Auto-fill form',
      description: 'Citizen details populate the CTC form after a successful scan.',
      icon: FileCheck2,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-qr-light)] flex items-center justify-center">
              <QrCode className="w-4.5 h-4.5 text-[var(--color-qr)]" aria-hidden="true" />
            </span>
            QR Code Scanner
          </h1>
          <p className="text-[var(--color-neutral-500)] mt-2 max-w-3xl">
            Scan the QR code from the citizen's mobile app to auto-populate the CTC form.
          </p>
        </div>

        {/* Live status indicator — orients the user at a glance without reading the card below */}
        <div className="qr-status-strip">
          <span
            className={`qr-status-dot ${
              scannedData ? 'qr-status-dot--done' : showScanner ? 'qr-status-dot--active' : ''
            }`}
            aria-hidden="true"
          />
          {issued ? 'Saved' : scannedData ? 'Scan complete' : showScanner ? 'Scanner active' : 'Idle'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0">
          {isLoading && (
            <Card className="p-10 min-h-[380px] flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" aria-hidden="true" />
              <span className="text-[var(--color-neutral-500)] text-sm font-medium">Processing...</span>
            </Card>
          )}

          {!isLoading && issued && (
            <Card accent="success" className="p-8 sm:p-10 text-center min-h-[380px] flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-[var(--color-success-light)] flex items-center justify-center mb-5">
                <UserCheck className="w-7 h-7 text-[var(--color-success)]" aria-hidden="true" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[var(--color-neutral-900)] mb-2">
                Application saved
              </h2>
              <p className="text-[var(--color-neutral-600)] max-w-md mx-auto break-words" role="status">
                {COUNTER_LINE}
              </p>
              <Button className="mt-6" icon={Camera} onClick={handleSurveyClosed}>
                Next Applicant
              </Button>
            </Card>
          )}

          {!isLoading && !issued && showScanner && !scannedData && (
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--color-neutral-800)]">
                    Camera Scanner
                  </h2>
                  <p className="text-sm text-[var(--color-neutral-500)] mt-1">
                    Center the QR code in the camera view and keep it steady.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-success-light)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
                  Camera mode
                </span>
              </div>

              {/* Targeting frame: corner brackets give the camera area a clear "aim here" zone,
                  purely decorative and non-interactive — the scanner component itself is untouched. */}
              <div className="qr-target-frame rounded-[var(--radius-lg)] bg-[var(--color-neutral-25)] p-4 sm:p-6">
                <span className="qr-corner qr-corner--tl" aria-hidden="true" />
                <span className="qr-corner qr-corner--tr" aria-hidden="true" />
                <span className="qr-corner qr-corner--bl" aria-hidden="true" />
                <span className="qr-corner qr-corner--br" aria-hidden="true" />
                <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
              </div>
            </Card>
          )}

          {!isLoading && !issued && !showScanner && !scannedData && (
            <Card className="qr-empty-state p-8 sm:p-10 text-center min-h-[380px] flex flex-col items-center justify-center">
              <div className="qr-empty-ring mb-5">
                <Camera className="w-7 h-7 text-[var(--color-qr)]" aria-hidden="true" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[var(--color-neutral-800)] mb-1.5">
                Ready to scan
              </h3>
              <p className="text-[var(--color-neutral-500)] mb-6 max-w-md mx-auto">
                Start the scanner when the citizen has their QR code ready on their mobile device.
              </p>
              <Button icon={Camera} onClick={() => setShowScanner(true)}>
                Start Scanner
              </Button>
            </Card>
          )}

          {!isLoading && scannedData && (
            <Card className="p-6 sm:p-7">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="qr-result-badge">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" aria-hidden="true" />
                </span>
                <h2 className="font-display text-lg font-semibold text-[var(--color-neutral-800)]">
                  Scanned Information
                </h2>
              </div>
              <p className="text-sm text-[var(--color-neutral-500)] mb-5 ml-[34px]">
                Review the details below before issuing the certificate.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
                {fieldKeys.map((key) => (openFields.includes(key) ? renderFieldInput(key) : (
                  <div
                    key={key}
                    className="p-3.5 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-100)] min-w-0"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-1">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[15px] font-medium text-[var(--color-neutral-800)] break-words">
                      {formData[key] || '-'}
                    </p>
                  </div>
                )))}
              </div>

              {!canIssue && (
                <p className="text-sm text-[var(--color-neutral-600)] mb-3 break-words" role="status">
                  Fill in the fields marked “Needed before issuing” to issue the CTC.
                </p>
              )}
              <div className="qr-result-actions flex flex-wrap gap-3 justify-end pt-5">
                <Button variant="secondary" icon={RefreshCw} onClick={handleReset}>
                  Scan Another
                </Button>
                <Button icon={CheckCircle2} onClick={handleIssueForm} disabled={!canIssue}>
                  Issue CTC
                </Button>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-4">
              How it works
            </h2>
            <div className="qr-steps">
              {scanSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="qr-step">
                    <div className="qr-step-marker">
                      <Icon className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-sm font-semibold text-[var(--color-neutral-800)]">
                        {step.title}
                      </p>
                      <p className="text-sm text-[var(--color-neutral-500)] mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quieter than a full card — a reassurance footnote, not a competing block */}
          <div className="qr-note">
            <ShieldCheck className="w-4 h-4 text-[var(--color-voice)] shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <span className="font-semibold text-[var(--color-neutral-700)]">Secure and private —</span>{' '}
              QR data is used only to retrieve and populate the citizen's current CTC application.
            </p>
          </div>
        </aside>
      </div>
      <SusSurveyDialog
        open={Boolean(surveyTransactionId)}
        transactionId={surveyTransactionId}
        defaultFeatures={['qr_prefill', 'form_generation']}
        onClose={handleSurveyClosed}
      />
    </div>
  );
};

export default QRScan;