import React, { useState, useEffect, useRef } from 'react';

const QRScanner = ({ onScan, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
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
      <div id="qr-reader" className="w-full max-w-md mx-auto"></div>
      
      {!isScanning && !error && (
        <div className="text-center mt-4">
          <button
            onClick={startScanner}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            📷 Start Camera
          </button>
        </div>
      )}

      {error && (
        <div className="text-center mt-4">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {isScanning && (
        <div className="text-center mt-4">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ⏹️ Stop Scanner
          </button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;