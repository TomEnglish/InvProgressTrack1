import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Settings as SettingsIcon, Calculator, History, UserPlus, Trash2, Shield, AlertTriangle, Layers, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TabId = 'general' | 'members' | 'milestones' | 'qty-rollup' | 'baseline';
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
    { id: 'milestones', label: 'Milestones',  icon: Layers },
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
      {tab === 'milestones'&& <MilestonesTab projectId={projectId} canManage={canManage} />}
      {tab === 'qty-rollup'&& <QtyRollupTab projectId={projectId} canManage={canManage} />}
      {tab === 'baseline'  && <BaselineTab projectId={projectId} canManage={canManage} />}
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

type RollupMode = 'hours_weighted' | 'equal' | 'custom';

interface RollupContribution { discipline_id: string; name: string; weight: number; pct_qty: number | null }

function QtyRollupTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<RollupMode | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [errMsg, setErrMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: rollup, isLoading } = useQuery({
    queryKey: ['project_qty_rollup', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_qty_rollup', { p_id: projectId });
      if (error) throw error;
      return data?.[0] ?? null;
    }
  });

  useEffect(() => {
    if (rollup && mode === null) {
      setMode(rollup.mode as RollupMode);
      const initial: Record<string, number> = {};
      for (const d of rollup.per_discipline as RollupContribution[]) initial[d.discipline_id] = d.weight;
      setWeights(initial);
    }
  }, [rollup, mode]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!mode) return;
      const payload: { p_id: string; p_mode: RollupMode; p_weights?: { discipline_id: string; weight: number }[] } = {
        p_id: projectId, p_mode: mode
      };
      if (mode === 'custom') {
        payload.p_weights = Object.entries(weights).map(([discipline_id, weight]) => ({ discipline_id, weight }));
      }
      const { error } = await supabase.rpc('admin_set_qty_rollup', payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMsg('Saved.');
      setTimeout(() => setSuccessMsg(''), 2500);
      qc.invalidateQueries({ queryKey: ['project_qty_rollup', projectId] });
    },
    onError: (e: Error) => setErrMsg(e.message)
  });

  if (isLoading || !rollup || mode === null) return <div className="text-sm text-text-muted">Loading...</div>;

  const contributions = rollup.per_discipline as RollupContribution[];
  const sumWeights = Object.values(weights).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const sumIsValid = Math.abs(sumWeights - 1.0) <= 0.001;

  return (
    <div className="space-y-4 max-w-2xl">
      {errMsg && <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">{errMsg}</div>}
      {successMsg && <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-md font-semibold border border-emerald-200 dark:border-emerald-900/50">{successMsg}</div>}

      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">Composite % (current)</div>
          <div className="text-3xl font-bold text-primary tabular-nums">{Number(rollup.composite_pct).toFixed(2)}%</div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Mode</div>
          <div className="space-y-2">
            <RadioOption label="Hours-weighted" subLabel="Weight each discipline by its share of total budget hours (recommended default)." value="hours_weighted" current={mode} onPick={setMode} disabled={!canManage} />
            <RadioOption label="Equal-weighted" subLabel="Each discipline contributes 1/N. Useful for early-stage projects." value="equal" current={mode} onPick={setMode} disabled={!canManage} />
            <RadioOption label="Custom" subLabel="PM-defined weights per discipline. Must sum to 100%." value="custom" current={mode} onPick={setMode} disabled={!canManage} />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Per-discipline weights</div>
          <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
            {contributions.map(d => {
              const editable = canManage && mode === 'custom';
              const w = mode === 'custom' ? (weights[d.discipline_id] ?? 0) : d.weight;
              return (
                <li key={d.discipline_id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-text font-medium">{d.name}</div>
                    <div className="text-xs text-text-muted">qty completion: {d.pct_qty == null ? '—' : `${(d.pct_qty * 100).toFixed(1)}%`}</div>
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01" min={0} max={1}
                        value={w}
                        onChange={e => setWeights(prev => ({ ...prev, [d.discipline_id]: Number(e.target.value) }))}
                        className="w-24 p-1.5 bg-canvas border border-border rounded text-sm tabular-nums text-right outline-none focus:border-primary text-text"
                      />
                      <span className="text-xs text-text-muted w-16 text-right tabular-nums">{(w * 100).toFixed(1)}%</span>
                    </div>
                  ) : (
                    <span className="text-text-muted tabular-nums w-20 text-right">{(w * 100).toFixed(1)}%</span>
                  )}
                </li>
              );
            })}
          </ul>
          {mode === 'custom' && (
            <div className={`mt-2 text-xs font-semibold ${sumIsValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              Sum: {(sumWeights * 100).toFixed(2)}%{!sumIsValid && ' — must equal 100%'}
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex justify-end pt-3 border-t border-border">
            <button
              onClick={() => { setErrMsg(''); saveMut.mutate(); }}
              disabled={saveMut.isPending || (mode === 'custom' && !sumIsValid)}
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {saveMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-text-subtle">Mode and weight changes apply to future snapshots only — historical composites are frozen.</p>
    </div>
  );
}

function MilestonesTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [disciplineId, setDisciplineId] = useState<string>('');
  const [draft, setDraft] = useState<{ name: string; weight: number; sort_order: number }[] | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: disciplines } = useQuery({
    queryKey: ['disciplines', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('disciplines').select('id, name').eq('project_id', projectId).order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!projectId
  });

  useEffect(() => {
    if (!disciplineId && disciplines && disciplines.length > 0) setDisciplineId(disciplines[0].id);
  }, [disciplines, disciplineId]);

  const { data: milestones } = useQuery({
    queryKey: ['milestone_templates', disciplineId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_milestones', { d_id: disciplineId });
      if (error) throw error;
      return (data || []) as { id: string; name: string; weight: number; sort_order: number }[];
    },
    enabled: !!disciplineId
  });

  useEffect(() => {
    if (milestones) setDraft(milestones.map(m => ({ name: m.name, weight: Number(m.weight), sort_order: m.sort_order })));
  }, [milestones]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const sorted = [...draft]
        .map((m, idx) => ({ name: m.name.trim(), weight: m.weight, sort_order: idx + 1 }))
        .filter(m => m.name.length > 0);
      const { error } = await supabase.rpc('admin_set_milestones', {
        d_id: disciplineId,
        p_milestones: sorted
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMsg('Saved.');
      setTimeout(() => setSuccessMsg(''), 2500);
      qc.invalidateQueries({ queryKey: ['milestone_templates', disciplineId] });
      qc.invalidateQueries({ queryKey: ['progress_items', projectId] });
    },
    onError: (e: Error) => setErrMsg(e.message)
  });

  const sumWeights = useMemo(() => (draft ?? []).reduce((acc, m) => acc + (Number(m.weight) || 0), 0), [draft]);
  const sumIsValid = Math.abs(sumWeights - 1.0) <= 0.001;

  const updateRow = (idx: number, patch: Partial<{ name: string; weight: number }>) => {
    setDraft(prev => prev ? prev.map((m, i) => i === idx ? { ...m, ...patch } : m) : prev);
  };
  const removeRow = (idx: number) => setDraft(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  const addRow = () => setDraft(prev => [...(prev ?? []), { name: '', weight: 0, sort_order: (prev?.length ?? 0) + 1 }]);
  const moveRow = (idx: number, dir: -1 | 1) => {
    setDraft(prev => {
      if (!prev) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const normalize = () => {
    setDraft(prev => {
      if (!prev) return prev;
      const sum = prev.reduce((acc, m) => acc + (Number(m.weight) || 0), 0);
      if (sum <= 0) return prev;
      return prev.map(m => ({ ...m, weight: Number(((Number(m.weight) || 0) / sum).toFixed(4)) }));
    });
  };

  if (!disciplines || disciplines.length === 0) {
    return <div className="text-sm text-text-muted">No disciplines configured.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {errMsg && <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">{errMsg}</div>}
      {successMsg && <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-md font-semibold border border-emerald-200 dark:border-emerald-900/50">{successMsg}</div>}

      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Audit (Discipline)</label>
          <select value={disciplineId} onChange={e => setDisciplineId(e.target.value)}
            className="w-full p-2 bg-canvas border border-border rounded text-sm text-text outline-none focus:border-primary">
            {disciplines.map(d => <option key={d.id} value={d.id}>{d.name} Audit</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Milestones (in order)</span>
            <span className={`text-xs font-semibold tabular-nums ${sumIsValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              Sum: {(sumWeights * 100).toFixed(1)}%{!sumIsValid && ' — should be 100%'}
            </span>
          </div>

          <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
            {(draft ?? []).map((m, idx) => (
              <li key={idx} className="px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold w-8 text-right">#{idx + 1}</span>
                <input
                  type="text"
                  value={m.name}
                  onChange={e => updateRow(idx, { name: e.target.value })}
                  disabled={!canManage}
                  placeholder="Milestone name"
                  className="flex-1 p-1.5 bg-canvas border border-border rounded text-sm text-text outline-none focus:border-primary disabled:opacity-60"
                />
                <input
                  type="number"
                  step="0.01" min={0} max={1}
                  value={m.weight}
                  onChange={e => updateRow(idx, { weight: Number(e.target.value) })}
                  disabled={!canManage}
                  className="w-20 p-1.5 bg-canvas border border-border rounded text-sm text-text tabular-nums text-right outline-none focus:border-primary disabled:opacity-60"
                />
                <span className="w-12 text-xs text-text-muted tabular-nums text-right">{((Number(m.weight) || 0) * 100).toFixed(1)}%</span>
                {canManage && (
                  <>
                    <button onClick={() => moveRow(idx, -1)} disabled={idx === 0} className="p-1 text-text-subtle hover:text-primary disabled:opacity-30" title="Move up"><ArrowUp size={12} /></button>
                    <button onClick={() => moveRow(idx, 1)}  disabled={idx === (draft?.length ?? 0) - 1} className="p-1 text-text-subtle hover:text-primary disabled:opacity-30" title="Move down"><ArrowDown size={12} /></button>
                    <button onClick={() => removeRow(idx)} className="p-1 text-text-subtle hover:text-red-500" title="Remove"><Trash2 size={12} /></button>
                  </>
                )}
              </li>
            ))}
            {(draft?.length ?? 0) === 0 && (
              <li className="px-3 py-4 text-center text-sm text-text-muted">No milestones configured for this audit.</li>
            )}
          </ul>

          {canManage && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={addRow} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-canvas border border-border text-text rounded hover:bg-raised transition-colors">
                <Plus size={12} /> Add milestone
              </button>
              <button onClick={normalize} className="px-3 py-1.5 text-xs font-semibold bg-canvas border border-border text-text rounded hover:bg-raised transition-colors" title="Scale weights so they sum to 100%">
                Normalize to 100%
              </button>
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex justify-end pt-3 border-t border-border">
            <button
              onClick={() => { setErrMsg(''); saveMut.mutate(); }}
              disabled={saveMut.isPending}
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {saveMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-text-subtle">
        Item percent_complete is computed as Σ(weight × milestone%). Renaming a milestone preserves existing per-item progress; deleting it drops that progress and recomputes overall % for affected items. Imports auto-create new milestone names with a placeholder weight of 1 — rebalance via "Normalize to 100%" after.
      </p>
    </div>
  );
}

function RadioOption({ label, subLabel, value, current, onPick, disabled }: {
  label: string; subLabel: string; value: RollupMode; current: RollupMode; onPick: (v: RollupMode) => void; disabled?: boolean;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => !disabled && onPick(value)}
      disabled={disabled}
      className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded border transition-colors ${active ? 'border-primary bg-primary-soft' : 'border-border bg-canvas hover:border-primary'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 ${active ? 'border-primary bg-primary' : 'border-border bg-canvas'}`}>
        {active && <span className="block w-1.5 h-1.5 m-[5px] rounded-full bg-white" />}
      </span>
      <span className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${active ? 'text-primary' : 'text-text'}`}>{label}</div>
        <div className="text-xs text-text-muted">{subLabel}</div>
      </span>
    </button>
  );
}

function BaselineTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
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

        {baseline && canManage && (
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
