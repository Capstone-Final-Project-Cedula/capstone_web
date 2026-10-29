import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import Card from '../components/ui/Card';
import SusSurvey from '../components/sus/SusSurvey';

/**
 * Survey at /survey inside the app (admin menu item). Same survey as the
 * pop-up after an application, opened without needing an application.
 * After "Thank you" it resets for the next person; "No, thanks" goes back.
 */
const SurveyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [round, setRound] = useState(0);

  // location.key is 'default' when this page was opened directly (no page to go back to)
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/dashboard', { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-11 h-11 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)]">Survey</h1>
      </div>
      <Card className="p-6 sm:p-8">
        <SusSurvey
          key={round}
          platform="web"
          onClose={() => setRound((r) => r + 1)}
          onDecline={goBack}
          closeLabel="Fill in another survey"
        />
      </Card>
    </div>
  );
};

export default SurveyPage;
