import { toast } from 'react-toastify';

const toBlob = (pdfData) => {
  const pdfBlob = pdfData instanceof Blob ? pdfData : new Blob([pdfData], { type: 'application/pdf' });
  if (!pdfBlob.size) throw new Error('The downloaded PDF is empty.');
  return pdfBlob;
};

// Saves the PDF to the computer's Downloads folder.
export const downloadPdf = (pdfData, fileName) => {
  const url = window.URL.createObjectURL(toBlob(pdfData));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};

// Saves the PDF and opens the print dialog from a hidden frame on this page (no empty
// new tab while printing).
export const downloadAndPrintPdf = (pdfData, fileName) => {
  const pdfBlob = toBlob(pdfData);
  downloadPdf(pdfBlob, fileName);

  const url = window.URL.createObjectURL(pdfBlob);
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px',
    opacity: '0', border: '0',
  });
  iframe.src = url;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      toast.info('PDF downloaded. Open the file to print if the print dialog did not appear.');
    }
    window.setTimeout(() => iframe.parentNode && document.body.removeChild(iframe), 60000);
  };

  iframe.onerror = () => {
    toast.info('PDF downloaded. Open the file to print if the print dialog did not appear.');
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  document.body.appendChild(iframe);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};

// "attachment; filename="CTC-20261018-0001_COPY.pdf"" → "CTC-20261018-0001_COPY.pdf"
export const fileNameFromResponse = (response, fallback) => {
  const header = response?.headers?.['content-disposition'] || '';
  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
};
