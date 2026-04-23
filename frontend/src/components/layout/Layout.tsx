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
          <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center font-bold text-xs">
            KIS
          </div>
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
