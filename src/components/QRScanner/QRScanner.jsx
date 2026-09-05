import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Camera, ScanLine, StopCircle } from 'lucide-react';
import Button from '../ui/Button';

const QRScanner = ({ onScan, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const html5QrCodeRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().catch(() => {});
        } catch (e) {}
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Dynamically import html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0,
        formatsToSupport: { QR_CODE: true },
      };

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Success callback - stop scanner and return result
          stopScanner();
          if (onScan) {
            onScan(decodedText);
          }
        },
        (errorMessage) => {
          // Error callback - ignore continuous errors
          console.debug('QR scan error:', errorMessage);
        }
      );
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      setError('Unable to access camera. Please check permissions and ensure you are using HTTPS or localhost.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    if (onClose) onClose();
  };

  return (
    <div className="relative">
      <div className="relative w-full max-w-xl mx-auto">
        {/* #qr-reader is left free of React-managed children — html5-qrcode
            mounts its own video element directly into this node, so mixing
            in conditional React children here would fight the library for
            ownership of the DOM. The idle placeholder below is a sibling
            overlay instead. */}
        <div
          id="qr-reader"
          className="w-full min-h-[320px] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-neutral-50)]"
        />

        {!isScanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-10 pointer-events-none">
            <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-qr-light)] flex items-center justify-center mb-4">
              <Camera className="w-6 h-6 text-[var(--color-qr)]" aria-hidden="true" />
            </div>
            <p className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-1">
              Camera is off
            </p>
            <p className="text-sm text-[var(--color-neutral-500)] max-w-xs">
              Start the camera to scan a QR code.
            </p>
          </div>
        )}

        {/* Purely decorative scan-frame overlay — shown only while the
            camera is active, sits above the html5-qrcode video feed. */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative w-[220px] h-[220px]">
              <span className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-[3px] border-l-[3px] border-[var(--color-qr)] rounded-tl-[var(--radius-md)]" />
              <span className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-[3px] border-r-[3px] border-[var(--color-qr)] rounded-tr-[var(--radius-md)]" />
              <span className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-[3px] border-l-[3px] border-[var(--color-qr)] rounded-bl-[var(--radius-md)]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-[3px] border-r-[3px] border-[var(--color-qr)] rounded-br-[var(--radius-md)]" />
              <ScanLine
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-[var(--color-qr)] animate-pulse"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>

      {!isScanning && !error && (
        <div className="text-center mt-5">
          <Button icon={Camera} onClick={startScanner}>
            Start Camera
          </Button>
        </div>
      )}

      {error && (
        <div className="text-center mt-5">
          <div className="max-w-xl mx-auto mb-3 rounded-[var(--radius-md)] border border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-3 text-sm font-medium text-[var(--color-error)] flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="focusable h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] text-sm font-semibold text-[var(--color-neutral-700)] transition-colors hover:bg-[var(--color-neutral-200)] active:scale-[0.97]"
          >
            Try Again
          </button>
        </div>
      )}

      {isScanning && (
        <div className="text-center mt-5">
          <p className="text-sm text-[var(--color-neutral-500)] mb-3">
            Point the camera at a QR code
          </p>
          <Button variant="danger" icon={StopCircle} onClick={handleClose}>
            Stop Scanner
          </Button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;