import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import SusSurvey from './SusSurvey';

/**
 * Shown after a Cedula transaction: "Help us improve CeduSync" with
 * Take survey / Skip, then the survey itself in the same dialog.
 */
const SusSurveyDialog = ({ open, onClose, transactionId = null, defaultFeatures = [] }) => {
  const [started, setStarted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    setStarted(false);
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sus-dialog-title"
    >
      <Card className={`w-full ${started ? 'max-w-2xl' : 'max-w-md'} p-6 sm:p-8 animate-scale-in my-auto`}>
        {!started ? (
          <div className="text-center">
            <div className="flex justify-end -mt-2 -mr-2">
              <button type="button" onClick={onClose} aria-label="Close"
                className="text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              <ClipboardList className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 id="sus-dialog-title" className="text-2xl font-bold text-[var(--color-neutral-900)]">
              Help us improve CeduSync — 2-minute survey
            </h2>
            <p className="mt-2 text-base text-[var(--color-neutral-600)]">
              Tell us how easy the system was to use. Your name is optional.
            </p>
            <div className="mt-7 grid gap-3">
              <Button size="lg" className="h-14 text-base w-full" onClick={() => setStarted(true)}>Take survey</Button>
              <Button variant="secondary" size="lg" className="h-14 text-base w-full" onClick={onClose}>Skip</Button>
            </div>
          </div>
        ) : (
          <SusSurvey platform="web" transactionId={transactionId} defaultFeatures={defaultFeatures} onClose={onClose} />
        )}
      </Card>
    </div>
  );
};

export default SusSurveyDialog;
