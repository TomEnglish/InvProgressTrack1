import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { Moon, Sun, KeyRound, LogOut, ChevronDown, Briefcase, Shield, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface MyProject {
  id: string;
  name: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  my_project_role: 'tenant_admin' | 'admin' | 'editor' | 'viewer';
}

export default function Layout() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isProjectScope = !!projectId;

  const { data: myProjects } = useQuery({
    queryKey: ['my_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_projects');
      if (error) throw error;
      return (data || []) as MyProject[];
    }
  });

  const activeProject = myProjects?.find(p => p.id === projectId);
  const isTenantAdmin = myProjects?.some(p => p.my_project_role === 'tenant_admin');
  const canManageProject = activeProject?.my_project_role === 'tenant_admin'
                        || activeProject?.my_project_role === 'admin';

  const projectTabs = projectId ? [
    { name: 'Executive Overview', path: `/p/${projectId}` },
    { name: 'Earned Value',       path: `/p/${projectId}/ev` },
    { name: 'Progress Audits',    path: `/p/${projectId}/audits` },
    { name: 'Discipline Progress',path: `/p/${projectId}/discipline-progress` },
    { name: 'Period Tracking',    path: `/p/${projectId}/periods` },
    { name: 'Data Upload',        path: `/p/${projectId}/upload` },
    ...(canManageProject ? [{ name: 'Settings', path: `/p/${projectId}/settings` }] : []),
  ] : [];

  const [theme, setTheme] = useState(localStorage.getItem('invenio-theme') || 'light');

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState('');

  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSwitcher) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSwitcher]);

  const handleUpdatePassword = async () => {
    if (newPass !== newPassConfirm) {
      setPassMsg("Passwords don't match.");
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

        <div className="flex items-center gap-3 sm:gap-4 text-right text-xs text-white dark:text-text">
          {isProjectScope && (
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setShowSwitcher(s => !s)}
                className="flex items-center gap-2 px-3 py-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-md transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
                title="Switch project"
              >
                <Briefcase size={14} className="text-white dark:text-text-muted" />
                <span className="font-semibold text-white dark:text-text max-w-[180px] truncate">
                  {activeProject?.name ?? 'Loading...'}
                </span>
                <ChevronDown size={14} className="text-white/80 dark:text-text-muted" />
              </button>

              {showSwitcher && (
                <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-md shadow-xl py-1 z-50 text-left">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted font-bold border-b border-border">
                    Switch project
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {myProjects?.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setShowSwitcher(false); navigate(`/p/${p.id}`); }}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-raised transition-colors ${p.id === projectId ? 'bg-primary-soft text-primary font-semibold' : 'text-text'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{p.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold flex-shrink-0">
                            {p.my_project_role === 'tenant_admin' ? 'tenant admin' : p.my_project_role}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border">
                    <button
                      onClick={() => { setShowSwitcher(false); navigate('/'); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-text-muted hover:bg-raised transition-colors"
                    >
                      All projects...
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isProjectScope && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-md transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
            >
              <ArrowLeft size={14} className="text-white dark:text-text-muted" />
              <span className="font-semibold text-white dark:text-text">Projects</span>
            </button>
          )}

          {isTenantAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-md transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
              title="Admin Hub"
            >
              <Shield size={14} className="text-white dark:text-text-muted" />
              <span className="font-semibold text-white dark:text-text">Admin</span>
            </button>
          )}

          <button
            onClick={() => setShowKeyModal(true)}
            className="p-2 bg-black/10 dark:bg-canvas/50 hover:bg-black/20 dark:hover:bg-canvas rounded-full transition-colors backdrop-blur-sm border border-white/10 dark:border-border"
            title="Change password"
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
            <h3 className="text-xl font-bold text-text">Change Your Password</h3>
            <p className="text-sm text-text-muted">Set a new password for your account.</p>

            {passMsg && (
              <div className={`p-3 text-sm font-semibold rounded ${passMsg === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200'}`}>
                {passMsg === 'SUCCESS' ? 'Password updated.' : passMsg}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">New Password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Confirm New Password</label>
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
                {passLoading ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation (project-scoped only) */}
      {isProjectScope && (
        <nav className="bg-surface border-b border-border px-6 flex overflow-x-auto">
          {projectTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === `/p/${projectId}`}
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
      )}

      {/* Main Content */}
      <main className="flex-1 p-5 lg:p-6 max-w-[1600px] mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
