import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Landmark } from 'lucide-react';

const Header = () => {
  const { user } = useAuth();

  return (
    <header className="dashboard-shell-header bg-white border-b border-[var(--color-neutral-100)] px-4 sm:px-6 py-3.5">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Landmark className="w-4.5 h-4.5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
          <h2 className="font-display text-[15px] font-semibold text-[var(--color-neutral-800)] truncate">
            Barangay San Roque, Mambajao, Camiguin
          </h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-[var(--color-neutral-800)] leading-tight">
              {user?.full_name || 'Staff'}
            </div>
            <div className="text-xs text-[var(--color-neutral-500)] leading-tight mt-0.5">
              {user?.role || 'User'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center ring-1 ring-[var(--color-neutral-100)]">
            <span className="font-display text-[var(--color-primary)] font-bold text-sm">
              {user?.full_name?.charAt(0) || 'S'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
