import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Landmark,
  ChevronDown,
  LogOut,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getRoleStyles = (role) => {
    const roleLower = role?.toLowerCase() || 'user';
    const styles = {
      admin: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
      staff: 'bg-sky-50 text-sky-700 ring-sky-200',
      user: 'bg-slate-50 text-slate-700 ring-slate-200',
      secretary: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      treasurer: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
    return styles[roleLower] || styles.user;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFirstName = () => {
    const fullName = user?.full_name || user?.username || '';
    return fullName.split(' ')[0] || 'there';
  };

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setIsDropdownOpen(false);
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
              Barangay San Roque, Mambajao, Camiguin
            </h1>
          </div>
        </div>

        {/* Date & Time */}
        <div className="datetime-pill hidden lg:flex items-center gap-3 px-4 py-1.5">
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

        {/* User Profile */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="profile-chip flex items-center gap-2.5 pl-2 sm:pl-2.5 pr-2 py-1.5"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                {getGreeting()}, <span className="text-[var(--color-primary)]">{getFirstName()}</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className={`role-dot ${getRoleStyles(user?.role).split(' ')[1]}`} aria-hidden="true" />
                <span className={`text-[11px] font-semibold ${getRoleStyles(user?.role).split(' ')[1]}`}>
                  {user?.role || 'User'}
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="avatar-ring w-9 h-9 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
              </div>
              {user?.is_online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></span>
              )}
            </div>

            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-out ${isDropdownOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* User Dropdown */}
          {isDropdownOpen && (
            <div className="popover-panel absolute right-0 mt-3 w-72 rounded-2xl py-1 overflow-hidden" role="menu" aria-label="User menu">
              <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-voice)] flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-white">
                      {getInitials(user?.full_name || user?.username)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">
                      {user?.full_name || user?.username || 'User'}
                    </div>
                    {user?.email && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {user.email}
                      </div>
                    )}
                    {user?.position && (
                      <div className="text-xs text-gray-400 truncate mt-0.5 font-medium">
                        {user.position}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:bg-red-50"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
