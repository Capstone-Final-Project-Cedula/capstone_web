import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            🏛️ Barangay San Roque, Mambajao, Camiguin
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">
              {user?.full_name || 'Staff'}
            </div>
            <div className="text-xs text-gray-500">{user?.role || 'User'}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-600 font-bold text-lg">
              {user?.full_name?.charAt(0) || 'S'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;