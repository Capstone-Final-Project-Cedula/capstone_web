import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import QRScanner from '../components/QRScanner/QRScanner';
import { qrAPI } from '../api/qr';
import { formsAPI } from '../api/forms';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const QRScan = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

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
      setScannedData(result.data);
      toast.success('QR code scanned successfully - form auto-populated.');
      setShowScanner(false);
    } catch (error) {
      console.error('Error scanning QR:', error);
      toast.error(error.response?.data?.detail || 'Invalid QR Code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueForm = async () => {
    setIsLoading(true);
    try {
      const result = await formsAPI.issue(scannedData.form_data, 'qr');
      toast.success(`CTC #${result.data.ctc_number} issued successfully!`);

      const pdfResponse = await formsAPI.download(result.data.ctc_number);
      const url = window.URL.createObjectURL(
        new Blob([pdfResponse.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `CTC_${result.data.ctc_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      navigate('/records');
    } catch (error) {
      console.error('Error issuing form:', error);
      toast.error('Error issuing CTC. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setScannedData(null);
    setShowScanner(true);
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
      <div className="mb-7">
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="min-w-0">
          {isLoading && (
            <Card className="p-10 min-h-[360px] flex justify-center items-center gap-3">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" aria-hidden="true" />
              <span className="text-[var(--color-neutral-500)] text-sm font-medium">Processing...</span>
            </Card>
          )}

          {!isLoading && showScanner && !scannedData && (
            <Card className="p-5 sm:p-6 animate-scale-in">
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
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-neutral-200)] bg-[var(--color-neutral-25)] p-4 sm:p-6">
                <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
              </div>
            </Card>
          )}

          {!isLoading && !showScanner && !scannedData && (
            <Card className="p-8 sm:p-10 text-center animate-scale-in min-h-[360px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-qr-light)] flex items-center justify-center mx-auto mb-5">
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
            <Card className="p-6 sm:p-7 animate-scale-in">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" aria-hidden="true" />
                <h2 className="font-display text-lg font-semibold text-[var(--color-neutral-800)]">
                  Scanned Information
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-7">
                {Object.entries(scannedData.form_data || {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3.5 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-100)]"
                  >
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-1">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <p className="text-[15px] font-medium text-[var(--color-neutral-800)] break-words">
                      {value || '-'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 justify-end">
                <Button variant="secondary" icon={RefreshCw} onClick={handleReset}>
                  Scan Another
                </Button>
                <Button icon={CheckCircle2} onClick={handleIssueForm}>
                  Issue CTC
                </Button>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-4">
              How it works
            </h2>
            <div className="space-y-4">
              {scanSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-[var(--color-primary)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-neutral-800)]">
                        {index + 1}. {step.title}
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

          <Card className="p-5 bg-[var(--color-voice-light)] border-[rgba(15,139,124,0.16)]">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-white/80 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5 text-[var(--color-voice)]" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--color-neutral-800)]">
                  Secure and private
                </h3>
                <p className="text-sm text-[var(--color-neutral-600)] mt-1">
                  QR data is used only to retrieve and populate the citizen's current CTC application.
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default QRScan;
