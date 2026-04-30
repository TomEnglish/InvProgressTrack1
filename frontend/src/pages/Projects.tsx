import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Shield, ArrowRight, LogOut, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MyProject {
  id: string;
  name: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  my_project_role: 'tenant_admin' | 'admin' | 'editor' | 'viewer';
}

export default function Projects() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['my_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_projects');
      if (error) throw error;
      return (data || []) as MyProject[];
    }
  });

  const { data: tenantRole } = useQuery({
    queryKey: ['my_tenant_role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from('app_users').select('role').eq('id', user.id).maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    }
  });

  const isTenantAdmin = tenantRole === 'tenant_admin';

  useEffect(() => {
    if (!isLoading && projects && projects.length === 1 && !showCreate) {
      navigate(`/p/${projects[0].id}`, { replace: true });
    }
  }, [projects, isLoading, navigate, showCreate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-text-muted font-medium">
        Loading projects...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="max-w-md p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 font-semibold">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  if (projects && projects.length === 1 && !showCreate) {
    return <Navigate to={`/p/${projects[0].id}`} replace />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Briefcase size={48} className="mx-auto text-text-subtle" />
          <h1 className="text-2xl font-bold text-text">No projects yet</h1>
          <p className="text-sm text-text-muted">
            {isTenantAdmin
              ? 'Create your first project to get started.'
              : 'Your account has not been added to any projects yet. Contact your tenant admin to request access.'}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            {isTenantAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors text-sm font-semibold"
              >
                <Plus size={16} /> Create project
              </button>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors text-sm font-semibold"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
        {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Select a project</h1>
            <p className="text-sm text-text-muted mt-1">Choose a Progress Tracker instance to open.</p>
          </div>
          <div className="flex items-center gap-2">
            {isTenantAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors text-sm font-semibold"
              >
                <Plus size={16} /> New project
              </button>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface border border-border text-text-muted rounded-md hover:bg-raised transition-colors text-sm"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/p/${p.id}`)}
              className="group text-left bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-canvas border border-border text-text-muted">
                      {p.my_project_role === 'tenant_admin' ? (
                        <><Shield size={10} className="mr-1" /> Tenant Admin</>
                      ) : p.my_project_role}
                    </span>
                    {p.status && p.status !== 'active' && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-canvas border border-border text-text-muted">
                        {p.status}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-text truncate">{p.name}</h2>
                  <div className="mt-2 text-xs text-text-muted">
                    {p.planned_start && p.planned_end
                      ? `${new Date(p.planned_start).toLocaleDateString()} – ${new Date(p.planned_end).toLocaleDateString()}`
                      : 'No planned dates'}
                  </div>
                </div>
                <ArrowRight size={18} className="text-text-subtle group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_create_project', {
        p_name: name,
        p_planned_start: start || null,
        p_planned_end: end || null
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newProjectId) => {
      qc.invalidateQueries({ queryKey: ['my_projects'] });
      onClose();
      navigate(`/p/${newProjectId}`);
    },
    onError: (e: Error) => setErrMsg(e.message)
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-xl font-bold text-text">Create new project</h3>
          <p className="text-sm text-text-muted mt-1">Spins up a fresh Progress Tracker instance with the six default disciplines.</p>
        </div>

        {errMsg && <div className="p-3 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold rounded border border-red-200 dark:border-red-900/50">{errMsg}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Project Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Refinery Turnaround 2027"
              className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Planned Start</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Planned End</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-border mt-6">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors">
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {createMut.isPending ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
