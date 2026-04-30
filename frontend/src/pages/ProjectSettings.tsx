import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Settings as SettingsIcon, Calculator, History, UserPlus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TabId = 'general' | 'members' | 'qty-rollup' | 'baseline';
type ProjectRole = 'admin' | 'editor' | 'viewer';

interface MyProject {
  id: string;
  name: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  my_project_role: 'tenant_admin' | ProjectRole;
}

interface ProjectMember {
  user_id: string;
  email: string;
  tenant_role: string;
  project_role: string;
  added_at: string | null;
}

interface TenantUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<TabId>('members');

  const { data: project } = useQuery({
    queryKey: ['my_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_projects');
      if (error) throw error;
      return (data || []) as MyProject[];
    },
    select: (rows) => rows.find(p => p.id === projectId) ?? null
  });

  if (!projectId) return null;

  const canManage = project?.my_project_role === 'tenant_admin' || project?.my_project_role === 'admin';

  if (project && !canManage) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl max-w-2xl text-red-700 dark:text-red-400 font-semibold">
        Access denied. Project settings are only visible to tenant admins and project admins.
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'general',    label: 'General',     icon: SettingsIcon },
    { id: 'members',    label: 'Members',     icon: Users },
    { id: 'qty-rollup', label: 'Qty Rollup',  icon: Calculator },
    { id: 'baseline',   label: 'Baseline',    icon: History },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text">Project Settings</h2>
        <p className="text-sm text-text-muted mt-1">{project?.name ?? 'Loading...'}</p>
      </div>

      <div className="border-b border-border flex overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-primary'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'general'   && <GeneralTab project={project} />}
      {tab === 'members'   && <MembersTab projectId={projectId} canManage={canManage} />}
      {tab === 'qty-rollup'&& <QtyRollupTab projectId={projectId} />}
      {tab === 'baseline'  && <BaselineTab projectId={projectId} />}
    </div>
  );
}

function GeneralTab({ project }: { project: MyProject | null | undefined }) {
  if (!project) return <div className="text-sm text-text-muted">Loading...</div>;

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4 max-w-2xl">
      <Field label="Project Name" value={project.name} />
      <Field label="Status" value={project.status} />
      <Field label="Planned Start" value={project.planned_start ? new Date(project.planned_start).toLocaleDateString() : '—'} />
      <Field label="Planned End" value={project.planned_end ? new Date(project.planned_end).toLocaleDateString() : '—'} />
      <p className="text-xs text-text-subtle pt-2 border-t border-border">Editing fields coming in a follow-up.</p>
    </div>
  );
}

function MembersTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['project_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_project_members', { p_id: projectId });
      if (error) throw error;
      return (data || []) as ProjectMember[];
    }
  });

  const removeMut = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_remove_project_member', { target_user_id: userId, p_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_members', projectId] }),
    onError: (e: Error) => setErrMsg(e.message)
  });

  const setRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) => {
      const { error } = await supabase.rpc('admin_set_project_member_role', {
        target_user_id: userId, p_id: projectId, p_role: role
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project_members', projectId] }),
    onError: (e: Error) => setErrMsg(e.message)
  });

  const tenantAdmins   = members?.filter(m => m.project_role === 'tenant_admin') ?? [];
  const projectMembers = members?.filter(m => m.project_role !== 'tenant_admin') ?? [];

  return (
    <div className="space-y-6">
      {errMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">
          {errMsg}
        </div>
      )}

      {tenantAdmins.length > 0 && (
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Shield size={14} className="text-text-muted" />
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Tenant admins (inherited access)</span>
          </div>
          <ul className="divide-y divide-border">
            {tenantAdmins.map(m => (
              <li key={m.user_id} className="px-4 py-3 text-sm text-text flex items-center gap-2">
                <Shield size={12} className="text-info" />
                {m.email}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Project members</span>
          {canManage && (
            <button
              onClick={() => { setErrMsg(''); setShowAdd(true); }}
              className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary-hover flex items-center gap-1.5 transition-colors"
            >
              <UserPlus size={14} /> Add Member
            </button>
          )}
        </div>

        {isLoading && <div className="p-6 text-center text-text-muted">Loading members...</div>}
        {!isLoading && projectMembers.length === 0 && (
          <div className="p-8 text-center text-sm text-text-muted">No project members yet. Tenant admins above have inherited access.</div>
        )}
        {!isLoading && projectMembers.length > 0 && (
          <ul className="divide-y divide-border">
            {projectMembers.map(m => (
              <li key={m.user_id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="text-sm text-text font-medium">{m.email}</div>
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <select
                      value={m.project_role}
                      onChange={e => setRoleMut.mutate({ userId: m.user_id, role: e.target.value as ProjectRole })}
                      className="text-xs font-semibold px-2 py-1 bg-canvas border border-border rounded text-text focus:border-primary outline-none"
                    >
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-text-muted font-bold">{m.project_role}</span>
                  )}
                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.email} from this project?`)) removeMut.mutate(m.user_id);
                      }}
                      className="p-1.5 text-text-subtle hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 bg-canvas border border-border rounded transition-colors"
                      title="Remove from project"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAdd && (
        <AddMemberModal
          projectId={projectId}
          existingMemberIds={new Set(members?.map(m => m.user_id) ?? [])}
          onClose={() => setShowAdd(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ['project_members', projectId] })}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  projectId, existingMemberIds, onClose, onAdded
}: {
  projectId: string;
  existingMemberIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('viewer');
  const [errMsg, setErrMsg] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) throw error;
      return (data || []) as TenantUser[];
    }
  });

  const candidates = users?.filter(u => u.role !== 'tenant_admin' && !existingMemberIds.has(u.id)) ?? [];

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_add_project_member', {
        target_user_id: userId, p_id: projectId, p_role: role
      });
      if (error) throw error;
    },
    onSuccess: () => { onAdded(); onClose(); },
    onError: (e: Error) => setErrMsg(e.message)
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-xl font-bold text-text">Add Project Member</h3>
          <p className="text-sm text-text-muted mt-1">Grant a tenant user access to this project.</p>
        </div>

        {errMsg && <div className="p-3 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold rounded border border-red-200 dark:border-red-900/50">{errMsg}</div>}

        {!isLoading && candidates.length === 0 && (
          <div className="p-3 text-sm bg-canvas border border-border rounded text-text-muted">
            All tenant members are already on this project (or are tenant admins with inherited access).
            Create a new user from the Admin Hub first.
          </div>
        )}

        {candidates.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">User</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text"
              >
                <option value="">Select a user...</option>
                {candidates.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as ProjectRole)}
                className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary text-text"
              >
                <option value="viewer">Viewer (read only)</option>
                <option value="editor">Editor (can upload)</option>
                <option value="admin">Admin (manages members + settings)</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-5 border-t border-border mt-6">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors">
            Cancel
          </button>
          {candidates.length > 0 && (
            <button
              onClick={() => addMut.mutate()}
              disabled={!userId || addMut.isPending}
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {addMut.isPending ? 'Adding...' : 'Add Member'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QtyRollupTab({ projectId }: { projectId: string }) {
  const { data: rollup, isLoading } = useQuery({
    queryKey: ['project_qty_rollup', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_qty_rollup', { p_id: projectId });
      if (error) throw error;
      return data?.[0] ?? null;
    }
  });

  if (isLoading) return <div className="text-sm text-text-muted">Loading...</div>;
  if (!rollup) return <div className="text-sm text-text-muted">No rollup data.</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">Active Mode</div>
          <div className="text-sm text-text font-semibold">{rollup.mode === 'hours_weighted' ? 'Hours-weighted' : rollup.mode === 'equal' ? 'Equal-weighted' : 'Custom'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">Composite % (current)</div>
          <div className="text-3xl font-bold text-primary tabular-nums">{Number(rollup.composite_pct).toFixed(2)}%</div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Per-discipline contributions</div>
          <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
            {(rollup.per_discipline as { name: string; weight: number; pct_qty: number | null }[]).map((d, i) => (
              <li key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-text">{d.name}</span>
                <span className="text-text-muted tabular-nums">
                  weight {(d.weight * 100).toFixed(1)}% · qty {d.pct_qty == null ? '—' : `${(d.pct_qty * 100).toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-text-subtle">Mode + custom weight editor coming in a follow-up.</p>
    </div>
  );
}

function BaselineTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_snapshots', { p_id: projectId });
      if (error) throw error;
      return (data || []) as { id: string; kind: string; week_ending: string | null; label: string }[];
    }
  });

  const baseline = snapshots?.find(s => s.kind === 'baseline_first_audit') ?? null;

  const resetMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_reset_first_audit_baseline', { p_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots', projectId] }),
    onError: (e: Error) => setErrMsg(e.message)
  });

  if (isLoading) return <div className="text-sm text-text-muted">Loading...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      {errMsg && <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">{errMsg}</div>}

      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">Baseline – 1st Audit</div>
          {baseline ? (
            <div className="text-sm text-text">
              Captured {baseline.week_ending ? `for week ending ${new Date(baseline.week_ending).toLocaleDateString()}` : '(no week)'}.
            </div>
          ) : (
            <div className="text-sm text-text-muted">No 1st-audit baseline set yet — your next upload will become the baseline.</div>
          )}
        </div>

        {baseline && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-text-muted">
                Resetting deletes the current 1st-audit baseline. The next upload will become the new baseline. Every chart that compares against 1st audit will shift.
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('Reset 1st-audit baseline? Charts will shift on next upload.')) resetMut.mutate();
              }}
              disabled={resetMut.isPending}
              className="mt-3 px-4 py-2 text-sm font-semibold bg-canvas border border-border text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            >
              {resetMut.isPending ? 'Resetting...' : 'Reset 1st-audit baseline'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-text-subtle">Planned baseline (PV) is derived from project planned start/end + budget hours; nothing to configure here.</p>
    </div>
  );
}
