import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  const tabs = [
    { name: 'Executive Overview', path: '/' },
    { name: 'Earned Value', path: '/ev' },
    { name: 'Progress Audits', path: '/audits' },
    { name: 'Period Tracking', path: '/periods' },
    { name: 'Data Upload', path: '/upload' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-hover to-primary text-white py-3 px-6 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Invenio" className="w-8 h-8 flex-shrink-0 shadow-sm rounded-xl">
            <defs>
              <linearGradient id="invenioMark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#0369A1"/>
                <stop offset="1" stopColor="#0891B2"/>
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#invenioMark)"/>
            <path d="M21 17h22v7h-7.5v16H43v7H21v-7h7.5V24H21z" fill="#FFFFFF"/>
          </svg>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Progress Tracker Dashboard</h1>
            <div className="text-xs opacity-80">Project Controls | Kindred Industrial Services</div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold">LNG Project</div>
          <div>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
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
