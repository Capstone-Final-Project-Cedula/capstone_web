import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import Card from '../components/ui/Card';
import SusSurvey from '../components/sus/SusSurvey';

/**
 * Standalone survey at /sus (no login), e.g. opened from a printed QR code.
 * After each submission it resets for the next person.
 */
const SusSurveyPage = () => {
  const [round, setRound] = useState(0);

  return (
    <div className="min-h-screen bg-[var(--color-neutral-50)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)]">CeduSync survey</h1>
            <p className="text-[var(--color-neutral-500)]">Help us improve CeduSync — about 2 minutes</p>
          </div>
        </div>
        <Card className="p-6 sm:p-8">
          <SusSurvey
            key={round}
            platform="web"
            onClose={() => setRound((r) => r + 1)}
            closeLabel="Start a new survey"
          />
        </Card>
      </div>
    </div>
  );
};

export default SusSurveyPage;
