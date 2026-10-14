import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { Menu } from 'lucide-react';

const Layout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setIsSidebarCollapsed(JSON.parse(savedState));
    }
  }, []);

  const handleToggleCollapse = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  return (
    <div className="app-shell flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Ambient backdrop — quiet civic-tech texture, sits under everything */}
      <div className="app-shell-backdrop" aria-hidden="true" />

      {/* Mobile Overlay — mounted always, animated via class so it fades both ways */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ease-out ${
          isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={`
          sidebar-shell fixed lg:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-out
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/30' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
          ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}
        `}
      >
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header />

        {/* Mobile Menu Trigger */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className={`mobile-fab lg:hidden fixed z-30 flex items-center justify-center text-white transition-all duration-300 ease-out active:scale-95 ${
            isMobileSidebarOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
          }`}
          aria-label="Open menu"
        >
          <span className="mobile-fab-ring" aria-hidden="true" />
          <Menu className="w-5 h-5" />
        </button>

        <main className="content-scroll flex-1 overflow-y-auto">
          <div className="w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="page-transition" key={location.pathname}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;