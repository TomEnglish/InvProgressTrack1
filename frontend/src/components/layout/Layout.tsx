import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';

export default function Layout() {
  const tabs = [
    { name: 'Executive Overview', path: '/' },
    { name: 'Earned Value', path: '/ev' },
    { name: 'Progress Audits', path: '/audits' },
    { name: 'Period Tracking', path: '/periods' },
    { name: 'Data Upload', path: '/upload' },
    { name: 'Admin Hub', path: '/admin' },
  ];

  const [theme, setTheme] = useState(localStorage.getItem('invenio-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('invenio-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-hover to-primary dark:from-surface dark:to-surface text-white dark:text-text py-3 px-6 flex items-center justify-between sticky top-0 z-50 shadow-md dark:shadow-none dark:border-border dark:border-b">
        <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Invenio" className="w-8 h-8 flex-shrink-0 shadow-sm rounded-xl">
              {theme === 'dark' ? (
                <rect width="64" height="64" rx="14" fill="#0891B2"/>
              ) : (
                <>
                  <defs>
                    <linearGradient id="invenioMark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#0369A1"/>
                      <stop offset="1" stopColor="#0891B2"/>
                    </linearGradient>
                  </defs>
                  <rect width="64" height="64" rx="14" fill="url(#invenioMark)"/>
                </>
              )}
              <path d="M21 17h22v7h-7.5v16H43v7H21v-7h7.5V24H21z" fill={theme === 'dark' ? '#0B1220' : '#FFFFFF'}/>
            </svg>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-white dark:text-text shadow-sm dark:shadow-none">Progress Tracker Dashboard</h1>
            <div className="text-xs text-white/80 dark:text-text-muted">Project Controls | Kindred Industrial Services</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right text-xs text-white dark:text-text">
          <div className="hidden sm:block">
            <div className="font-semibold text-white dark:text-text shadow-sm dark:shadow-none">LNG Project</div>
            <div className="text-white/80 dark:text-text-muted">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <button 
            onClick={toggleTheme} 
            className="p-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-full transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
            title="Toggle Dark Mode"
          >
            {theme === 'dark' ? <Sun size={18} className="text-primary" /> : <Moon size={18} className="text-white" />}
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-surface border-b border-border px-6 flex overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary'
              }`
            }
          >
            {tab.name}
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-5 lg:p-6 max-w-[1600px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
