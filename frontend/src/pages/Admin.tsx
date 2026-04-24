import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, ShieldOff, Trash2 } from 'lucide-react';

interface DbUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function Admin() {
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');
  
  // invite form
  const [showInvite, setShowInvite] = useState(false);
  const [iEmail, setIEmail] = useState('');
  const [iPass, setIPass] = useState('');
  const [iRole, setIRole] = useState('viewer');
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
                      u.role === 'admin' 
                        ? 'bg-violet-50 dark:bg-info-soft text-violet-700 dark:text-info border border-violet-200 dark:border-info/30' 
                        : 'bg-canvas text-text-muted border border-border'
                    }`}>
                      {u.role === 'admin' ? <Shield size={12} className="mr-1.5" /> : null}
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      title={u.role === 'admin' ? 'Demote to Viewer' : 'Promote to Admin'}
                      onClick={() => toggleRoleMut.mutate({ id: u.id, newRole: u.role === 'admin' ? 'viewer' : 'admin' })}
                      className="p-2 text-text-subtle hover:text-primary bg-canvas border border-border rounded transition-colors"
                    >
                      {u.role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
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
                  <option value="viewer">Viewer (read only)</option>
                  <option value="admin">Administrator (full access)</option>
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
