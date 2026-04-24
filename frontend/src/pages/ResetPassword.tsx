import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

type LinkStatus = 'verifying' | 'ready' | 'expired';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (type !== 'recovery' || !token_hash) {
      setLinkStatus('expired');
      return;
    }

    supabase.auth
      .verifyOtp({ type: 'recovery', token_hash })
      .then(({ error }) => setLinkStatus(error ? 'expired' : 'ready'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Cryptographic keys do not perfectly match.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-xl border border-border mt-[-10vh]">
        <div className="mb-8 text-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-4 drop-shadow">
            <rect width="64" height="64" rx="14" fill="currentColor"/>
            <path d="M21 17h22v7h-7.5v16H43v7H21v-7h7.5V24H21z" fill={document.documentElement.getAttribute('data-theme') === 'dark' ? '#0B1220' : '#FFFFFF'}/>
          </svg>
          <h2 className="text-2xl font-bold text-text">Reset Your Password</h2>
          <p className="text-text-muted text-sm mt-1">Enter a new password for your account.</p>
        </div>

        {linkStatus === 'verifying' && (
          <div className="mb-6 p-6 bg-canvas border border-border rounded-lg text-center text-sm text-text-muted">
            Verifying recovery link...
          </div>
        )}

        {linkStatus === 'expired' && (
          <div className="mb-6 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-center flex flex-col items-center">
            <AlertTriangle size={32} className="text-red-500 mb-2" />
            <p className="text-lg font-bold text-text">Recovery link invalid or expired</p>
            <p className="text-xs text-text-muted mt-1">Please request a new recovery email.</p>
            <Link to="/forgot-password" className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:underline">
              Request new recovery
            </Link>
          </div>
        )}

        {linkStatus === 'ready' && (
          <>
            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}

            {success ? (
              <div className="mb-6 p-6 bg-canvas border border-border rounded-lg text-center flex flex-col items-center">
                <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                <p className="text-lg font-bold text-text">Password Updated.</p>
                <p className="text-xs text-text-muted mt-1">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1 tracking-wide">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-subtle">
                      <KeyRound size={18} />
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 w-full p-2.5 bg-canvas border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors text-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1 tracking-wide">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-subtle">
                      <KeyRound size={18} />
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-10 w-full p-2.5 bg-canvas border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors text-text"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || password.length < 6}
                  className="w-full py-2.5 px-4 mt-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Set New Password'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
