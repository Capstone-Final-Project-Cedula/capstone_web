import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  FilePlus2,
  QrCode,
  FileText,
  Users,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

const Sidebar = ({ isCollapsed, onToggleCollapse, onMobileClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'New Application', href: '/new-application', icon: FilePlus2 },
    { name: 'QR Scanner', href: '/qr-scan', icon: QrCode },
    { name: 'Records', href: '/records', icon: FileText },
    { name: 'Staff', href: '/staff', icon: Users },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  // Staff may access only their operational pages; admins retain full access.
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const filteredNavigation = isAdmin
    ? navigation
    : navigation.filter((item) => ['New Application', 'QR Scanner', 'Records'].includes(item.name));

  // Presentation-only grouping (matches the reference layout's "Main Menu" /
  // "Others" sections). Does not change which items are shown — that's still
  // controlled entirely by filteredNavigation above.
  const mainItems = filteredNavigation.filter(item => item.name !== 'Settings');
  const otherItems = filteredNavigation.filter(item => item.name === 'Settings');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href;

    return (
      <NavLink
        key={item.name}
        to={item.href}
        className={[
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
          isCollapsed ? 'justify-center' : '',
          isActive
            ? 'text-white shadow-sm'
            : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-900)] hover:bg-[var(--color-neutral-50)]',
        ].join(' ')}
        style={
          isActive
            ? { background: 'var(--color-primary)' }
            : undefined
        }
        title={isCollapsed ? item.name : ''}
      >
        <Icon
          className={`w-[18px] h-[18px] shrink-0 transition-colors ${
            isActive ? 'text-white' : 'text-[var(--color-neutral-400)] group-hover:text-[var(--color-neutral-600)]'
          }`}
          aria-hidden="true"
        />
        {!isCollapsed && (
          <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
        )}
      </NavLink>
    );
  };

  return (
    <div className={`h-full flex flex-col bg-white border-r border-[var(--color-neutral-200)] transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      {/* Brand Section */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--color-neutral-100)]">
        <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <img
              src="/logo-transparent.png"
              alt="CeduSync logo"
              className="w-9 h-10 object-contain"
              draggable="false"
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[var(--color-neutral-900)] text-lg leading-tight tracking-tight truncate">
                Cedu<span style={{ color: 'var(--color-voice)' }}>Sync</span>
              </h1>
              <p className="text-xs text-[var(--color-neutral-400)] mt-0.5 truncate">
                {user?.system_name || 'Barangay Processing'}
              </p>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] transition-colors shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Button */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] transition-colors shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed sits under the brand row for easy access */}
      {isCollapsed && (
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center mx-auto mt-3 w-7 h-7 rounded-md text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Navigation Section */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wide text-[var(--color-neutral-400)] uppercase">
            Main Menu
          </div>
        )}
        <div className="space-y-1">
          {mainItems.map(renderNavItem)}
        </div>

        {otherItems.length > 0 && (
          <>
            <div className={`border-t border-[var(--color-neutral-100)] my-4 ${isCollapsed ? 'mx-1' : 'mx-3'}`} />
            {!isCollapsed && (
              <div className="px-3 mb-2 text-[11px] font-semibold tracking-wide text-[var(--color-neutral-400)] uppercase">
                Others
              </div>
            )}
            <div className="space-y-1">
              {otherItems.map(renderNavItem)}
            </div>
          </>
        )}
      </nav>

      {/* User Info Section */}
      <div className="px-3 py-4 border-t border-[var(--color-neutral-100)]">
        {!isCollapsed && user && (
          <div className="mb-3 px-3">
            <div className="text-xs text-[var(--color-neutral-400)]">Logged in as</div>
            <div className="text-sm text-[var(--color-neutral-900)] font-semibold truncate">
              {user.full_name || user.username}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--color-neutral-500)] transition-all duration-200 hover:text-[var(--color-negative-text)] hover:bg-[var(--color-negative-bg)] group ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" aria-hidden="true" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
