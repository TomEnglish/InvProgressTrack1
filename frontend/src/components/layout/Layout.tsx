import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun, KeyRound, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Layout() {
  const navigate = useNavigate();
  const tabs = [
    { name: 'Executive Overview', path: '/' },
    { name: 'Earned Value', path: '/ev' },
    { name: 'Progress Audits', path: '/audits' },
    { name: 'Period Tracking', path: '/periods' },
    { name: 'Data Upload', path: '/upload' },
    { name: 'Admin Hub', path: '/admin' },
  ];

  const [theme, setTheme] = useState(localStorage.getItem('invenio-theme') || 'light');
  
  // Internal Password Sync Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState('');

  const handleUpdatePassword = async () => {
    if (newPass !== newPassConfirm) {
      setPassMsg('Keys do not physically match.');
      return;
    }
    setPassLoading(true);
    setPassMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setPassLoading(false);
    if (error) {
      setPassMsg(error.message);
    } else {
      setPassMsg('SUCCESS');
      setTimeout(() => setShowKeyModal(false), 1500);
    }
  };

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
            onClick={() => setShowKeyModal(true)} 
            className="p-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-full transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
            title="Update Security Profile"
          >
            <KeyRound size={18} className="text-white dark:text-text-muted" />
          </button>
          <button 
            onClick={toggleTheme} 
            className="p-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-full transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
            title="Toggle Dark Mode"
          >
            {theme === 'dark' ? <Sun size={18} className="text-primary" /> : <Moon size={18} className="text-white" />}
          </button>
          <div className="w-[1px] h-6 bg-white/20 dark:bg-border mx-1"></div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/login');
            }} 
            className="p-2 hover:bg-danger-soft/20 dark:hover:bg-red-950/40 rounded-full transition-colors backdrop-blur-sm text-white dark:text-text-muted hover:text-red-300 dark:hover:text-red-400"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Security Update Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-text">Initialize Security Architecture</h3>
            <p className="text-sm text-text-muted">Overwrite your Admin-provided password with a private cryptographic key.</p>
            
            {passMsg && (
              <div className={`p-3 text-sm font-semibold rounded ${passMsg === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200'}`}>
                {passMsg === 'SUCCESS' ? 'Credential Overwrite Complete.' : passMsg}
              </div>
            )}
            
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">New Key</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Verify Key</label>
                <input type="password" value={newPassConfirm} onChange={e => setNewPassConfirm(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <button onClick={() => setShowKeyModal(false)} className="px-5 py-2.5 text-sm font-semibold bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleUpdatePassword}
                disabled={!newPass || passLoading}
                className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {passLoading ? 'Writing...' : 'Update Matrix'}
              </button>
            </div>
          </div>
        </div>
      )}

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
