import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Shield, ArrowRight, LogOut } from 'lucide-react';
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

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['my_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_projects');
      if (error) throw error;
      return (data || []) as MyProject[];
    }
  });

  useEffect(() => {
    if (!isLoading && projects && projects.length === 1) {
      navigate(`/p/${projects[0].id}`, { replace: true });
    }
  }, [projects, isLoading, navigate]);

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

  if (projects && projects.length === 1) {
    return <Navigate to={`/p/${projects[0].id}`} replace />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Briefcase size={48} className="mx-auto text-text-subtle" />
          <h1 className="text-2xl font-bold text-text">No projects assigned</h1>
          <p className="text-sm text-text-muted">
            Your account has not been added to any projects yet. Contact your tenant admin to request access.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors text-sm font-semibold"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
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
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-surface border border-border text-text-muted rounded-md hover:bg-raised transition-colors text-sm"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
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
    </div>
  );
}
