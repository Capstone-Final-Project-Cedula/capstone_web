import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  FilePlus2,
  QrCode,
  FileText,
  Users,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'New Application', href: '/new-application', icon: FilePlus2 },
    { name: 'QR Scanner', href: '/qr-scan', icon: QrCode },
    { name: 'Records', href: '/records', icon: FileText },
    { name: 'Staff', href: '/staff', icon: Users },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className="w-20 sm:w-64 flex flex-col shrink-0"
      style={{ background: 'var(--color-shell-bg)' }}
    >
      <div className="dashboard-shell-brand sticky top-0 z-10 px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-center sm:justify-start gap-3 border-b" style={{ borderColor: 'var(--color-shell-border)', background: 'var(--color-shell-bg)' }}>
        <div
          className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 overflow-hidden bg-white ring-1 ring-white/15 shadow-[0_10px_22px_rgba(6,10,38,0.2)]"
        >
          <img
            src="/logo-transparent.png"
            alt="CeduSync logo"
            className="w-8 h-9 object-contain"
            draggable="false"
          />
        </div>
        <div className="hidden sm:block min-w-0">
          <h1 className="font-display text-[18px] font-extrabold text-white leading-tight truncate">
            Cedu<span className="text-[var(--color-shell-accent)]">Sync</span>
          </h1>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-shell-text)' }}>
            Barangay Processing
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                [
                  'focusable group relative flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 rounded-[var(--radius-md)]',
                  'text-sm font-medium transition-all duration-150 ease-out',
                  isActive
                    ? 'text-white bg-[var(--color-shell-item-active)]'
                    : 'text-[var(--color-shell-text)] hover:text-white hover:bg-[var(--color-shell-item-hover)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full transition-opacity duration-150"
                    style={{
                      background: 'var(--color-shell-accent)',
                      opacity: isActive ? 1 : 0,
                    }}
                    aria-hidden="true"
                  />
                  <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline truncate">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-shell-border)' }}>
        <button
          onClick={handleLogout}
          className="focusable flex items-center justify-center sm:justify-start gap-3 w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-shell-text)] transition-all duration-150 ease-out hover:text-white hover:bg-[var(--color-shell-item-hover)]"
        >
          <LogOut className="w-4.5 h-4.5" aria-hidden="true" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
