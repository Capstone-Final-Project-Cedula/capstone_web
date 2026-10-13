import React, { useState, useEffect } from 'react';
import { Landmark, Calendar, Clock } from 'lucide-react';
import { settingsAPI, SETTINGS_UPDATED_EVENT } from '../../api/settings';

// Barangay identity plus the date and time. Who is logged in (and Logout) is shown in
// the sidebar; there is no account menu here.
const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [office, setOffice] = useState(null);

  // Barangay name/location come from the shared Settings, not hard-coded text.
  useEffect(() => {
    settingsAPI.get().then((res) => setOffice(res.data)).catch(() => {});
    const onUpdated = (e) => setOffice(e.detail);
    window.addEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header className="gov-header sticky top-0 z-40">
      <div className="gov-header-accent" aria-hidden="true" />

      <div className="flex justify-between items-center gap-3 px-4 sm:px-6 lg:px-8 py-2.5 max-w-[1600px] mx-auto">
        {/* Barangay Identity */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="brand-crest shrink-0">
            <Landmark className="w-5 h-5 text-white" aria-hidden="true" />
          </div>

          <div className="hidden sm:block brand-divider shrink-0" aria-hidden="true" />

          <div className="min-w-0 hidden sm:block">
            <div className="eyebrow-chip">
              <span className="eyebrow-chip-dot" aria-hidden="true" />
              CEDULA MANAGEMENT SYSTEM
            </div>
            <h1 className="font-display text-[15px] font-semibold text-[var(--color-neutral-900)] leading-tight truncate">
              {office
                ? `${office.barangay_name}, ${office.municipality}, ${office.province}`
                : 'Community Tax Certificate Office'}
            </h1>
          </div>
        </div>

        {/* Date & Time */}
        <div className="datetime-pill hidden md:flex items-center gap-3 px-4 py-1.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
            <span>{formatDate(currentTime)}</span>
          </div>
          <div className="w-px h-4 bg-slate-300/70"></div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
