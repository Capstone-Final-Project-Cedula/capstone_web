import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import QRScanner from '../components/QRScanner/QRScanner';
import { qrAPI } from '../api/qr';
import { formsAPI } from '../api/forms';
import LoadingSpinner from '../components/common/LoadingSpinner';

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
      toast.success('✅ QR Code scanned successfully! Form auto-populated.');
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
      toast.success(`✅ CTC #${result.data.ctc_number} issued successfully!`);

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">📱 QR Code Scanner</h1>
      <p className="text-gray-500 mb-6">
        Scan the QR code from the citizen's mobile app to auto-populate the CTC form.
      </p>

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Processing...</span>
        </div>
      )}

      {!isLoading && showScanner && !scannedData && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        </div>
      )}

      {!isLoading && !showScanner && !scannedData && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <div className="text-6xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to Scan</h3>
          <p className="text-gray-500 mb-4">
            Click the button below to start scanning QR codes.
          </p>
          <button
            onClick={() => setShowScanner(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            📷 Start Scanner
          </button>
        </div>
      )}

      {!isLoading && scannedData && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Scanned Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {Object.entries(scannedData.form_data || {}).map(([key, value]) => (
              <div key={key} className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-600">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </label>
                <p className="text-lg font-medium">{value || '—'}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              🔄 Scan Another
            </button>
            <button
              onClick={handleIssueForm}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ✅ Issue CTC
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScan;
