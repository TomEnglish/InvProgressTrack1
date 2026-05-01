import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, ShieldOff, Trash2, Link2, Mail } from 'lucide-react';

interface DbUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface UnmatchedForeman {
  foreman_name: string;
  row_count: number;
  project_count: number;
}

export default function Admin() {
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  
  // invite form
  const [showInvite, setShowInvite] = useState(false);
  const [iEmail, setIEmail] = useState('');
  const [iPass, setIPass] = useState('');
  const [iRole, setIRole] = useState('member');
  const [iError, setIError] = useState('');

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) throw error;
      return (data || []) as DbUser[];
    }
  });

  const toggleRoleMut = useMutation({
    mutationFn: async ({ id, newRole }: { id: string, newRole: string }) => {
      const { error } = await supabase.rpc('admin_set_user_role', { target_id: id, target_role: newRole });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_users'] }),
    onError: (err: Error) => setErrorMsg(err.message)
  });

  const deleteUserMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_delete_user', { target_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_users'] }),
    onError: (err: Error) => setErrorMsg(err.message)
  });

  const resetPasswordMut = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      return email;
    },
    onSuccess: (email) => {
      setErrorMsg('');
      setInfoMsg(`Password reset email sent to ${email}.`);
      setTimeout(() => setInfoMsg(''), 4000);
    },
    onError: (err: Error) => setErrorMsg(err.message)
  });
  
  const createUserMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_create_user', { 
        new_email: iEmail, 
        new_password: iPass, 
        new_role: iRole 
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_users'] });
      setShowInvite(false);
      setIEmail('');
      setIPass('');
      setIError('');
    },
    onError: (err: Error) => setIError(err.message)
  });

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl max-w-2xl text-red-700 dark:text-red-400 font-semibold shadow-sm animate-fade-in">
        Access denied. You must be an administrator to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">User Administration</h2>
          <p className="text-sm text-text-muted mt-1">Manage project access, user roles, and security policies.</p>
        </div>
        <button 
          onClick={() => setShowInvite(true)}
          className="bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded hover:bg-primary-hover flex items-center transition-colors shadow-sm"
        >
          <UserPlus size={18} className="mr-2" />
          Add User
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">
          Error: {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-md font-semibold border border-emerald-200 dark:border-emerald-900/50">
          {infoMsg}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#F8FAFC] dark:bg-raised text-text border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wide">Email</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Role</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-text-muted font-medium">Loading users...</td></tr>
              )}
              {users?.map(u => (
                <tr key={u.id} className="hover:bg-[#F1F5F9] dark:hover:bg-raised transition-colors">
                  <td className="px-6 py-4 font-medium text-text">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md tracking-wider ${
                      u.role === 'tenant_admin'
                        ? 'bg-violet-50 dark:bg-info-soft text-violet-700 dark:text-info border border-violet-200 dark:border-info/30'
                        : 'bg-canvas text-text-muted border border-border'
                    }`}>
                      {u.role === 'tenant_admin' ? <Shield size={12} className="mr-1.5" /> : null}
                      {u.role === 'tenant_admin' ? 'TENANT ADMIN' : 'MEMBER'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      title={u.role === 'tenant_admin' ? 'Demote to Member' : 'Promote to Tenant Admin'}
                      onClick={() => toggleRoleMut.mutate({ id: u.id, newRole: u.role === 'tenant_admin' ? 'member' : 'tenant_admin' })}
                      className="p-2 text-text-subtle hover:text-primary bg-canvas border border-border rounded transition-colors"
                    >
                      {u.role === 'tenant_admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
                    </button>
                    <button
                      title="Send password reset email"
                      onClick={() => {
                        if (confirm(`Send password reset email to ${u.email}?`)) {
                          setErrorMsg('');
                          resetPasswordMut.mutate(u.email);
                        }
                      }}
                      disabled={resetPasswordMut.isPending}
                      className="p-2 text-text-subtle hover:text-primary bg-canvas border border-border rounded transition-colors disabled:opacity-50"
                    >
                      <Mail size={16} />
                    </button>
                    <button
                      title="Permanently Delete Account"
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete ${u.email}?`)) {
                          deleteUserMut.mutate(u.id);
                        }
                      }}
                      className="p-2 text-text-subtle hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 hover:border-red-500/30 bg-canvas border border-border rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ForemanReconciliation users={users ?? []} />

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
               <h3 className="text-xl font-bold text-text">Create User Account</h3>
               <p className="text-sm text-text-muted mt-1">Add a new user to your tenant.</p>
            </div>
            
            {iError && <div className="p-3 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold rounded border border-red-200 dark:border-red-900/50">{iError}</div>}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Email Address</label>
                <input type="email" value={iEmail} onChange={e => setIEmail(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary transition-colors text-text" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Temporary Password</label>
                <input type="password" value={iPass} onChange={e => setIPass(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary transition-colors text-text" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5 tracking-wide">Role</label>
                <select value={iRole} onChange={e => setIRole(e.target.value)} className="w-full p-2.5 bg-canvas border border-border rounded-md text-sm outline-none focus:border-primary transition-colors text-text">
                  <option value="member">Member (project-scoped access)</option>
                  <option value="tenant_admin">Tenant Admin (full access)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-border mt-6">
              <button 
                onClick={() => setShowInvite(false)}
                className="px-5 py-2.5 text-sm font-semibold bg-canvas border border-border text-text rounded-md hover:bg-raised transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => createUserMut.mutate()}
                disabled={!iEmail || !iPass || createUserMut.isPending}
                className="px-5 py-2.5 text-sm font-semibold bg-primary text-white rounded-md shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {createUserMut.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForemanReconciliation({ users }: { users: DbUser[] }) {
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [linking, setLinking] = useState<Record<string, string>>({});

  const { data: unmatched, isLoading } = useQuery({
    queryKey: ['unmatched_foremen'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_unmatched_foremen');
      if (error) throw error;
      return (data || []) as UnmatchedForeman[];
    }
  });

  const linkMut = useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      const { error } = await supabase.rpc('admin_link_foreman_alias', { p_name: name, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unmatched_foremen'] });
    },
    onError: (e: Error) => setErrMsg(e.message)
  });

  return (
    <div className="space-y-3 pt-4">
      <div>
        <h3 className="text-lg font-bold text-text">Foreman Reconciliation</h3>
        <p className="text-sm text-text-muted mt-1">Foreman names appearing in audit imports without a linked user. Linking adds an alias and retroactively fills the user_id on matching items.</p>
      </div>

      {errMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-md font-semibold border border-red-200 dark:border-red-900/50">
          {errMsg}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading && <div className="p-6 text-center text-text-muted">Loading...</div>}
        {!isLoading && (!unmatched || unmatched.length === 0) && (
          <div className="p-6 text-center text-sm text-text-muted">No unmatched foreman names — every imported foreman is linked to a user.</div>
        )}
        {!isLoading && unmatched && unmatched.length > 0 && (
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F8FAFC] dark:bg-raised text-text border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">Foreman name (raw)</th>
                <th className="px-6 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Items</th>
                <th className="px-6 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted text-right">Projects</th>
                <th className="px-6 py-3 font-semibold tracking-wide text-[11px] uppercase text-text-muted">Link to user</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unmatched.map(f => (
                <tr key={f.foreman_name} className="hover:bg-raised transition-colors">
                  <td className="px-6 py-3 font-medium text-text">{f.foreman_name}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-text-muted">{f.row_count}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-text-muted">{f.project_count}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={linking[f.foreman_name] ?? ''}
                        onChange={e => setLinking(prev => ({ ...prev, [f.foreman_name]: e.target.value }))}
                        className="text-xs px-2 py-1.5 bg-canvas border border-border rounded text-text outline-none focus:border-primary"
                      >
                        <option value="">Pick user...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          const userId = linking[f.foreman_name];
                          if (!userId) return;
                          setErrMsg('');
                          linkMut.mutate({ name: f.foreman_name, userId });
                        }}
                        disabled={!linking[f.foreman_name] || linkMut.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
                      >
                        <Link2 size={12} /> Link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
