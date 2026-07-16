import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'New Application', href: '/new-application', icon: '📝' },
    { name: 'QR Scanner', href: '/qr-scan', icon: '📱' },
    { name: 'Records', href: '/records', icon: '📄' },
    { name: 'Staff', href: '/staff', icon: '👥' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-indigo-800 text-white flex flex-col">
      <div className="p-4 border-b border-indigo-700">
        <h1 className="text-xl font-bold">Cedula System</h1>
        <p className="text-sm text-indigo-300">Barangay Processing</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'
              }`
            }
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-indigo-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 rounded-lg text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors"
        >
          <span className="mr-3">🚪</span>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;