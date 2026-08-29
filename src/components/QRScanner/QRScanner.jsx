import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Camera, StopCircle } from 'lucide-react';
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
      <div
        id="qr-reader"
        className="w-full max-w-xl min-h-[320px] mx-auto overflow-hidden rounded-[var(--radius-lg)] bg-white"
      />

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
            className="focusable h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] text-sm font-semibold text-[var(--color-neutral-700)] transition-colors hover:bg-[var(--color-neutral-200)]"
          >
            Try Again
          </button>
        </div>
      )}

      {isScanning && (
        <div className="text-center mt-5">
          <Button variant="danger" icon={StopCircle} onClick={handleClose}>
            Stop Scanner
          </Button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
