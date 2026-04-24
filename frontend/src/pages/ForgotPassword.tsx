import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-xl border border-border mt-[-10vh]">
        <div className="mb-8 text-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-4 drop-shadow">
            <rect width="64" height="64" rx="14" fill="currentColor"/>
            <path d="M21 17h22v7h-7.5v16H43v7H21v-7h7.5V24H21z" fill={document.documentElement.getAttribute('data-theme') === 'dark' ? '#0B1220' : '#FFFFFF'}/>
          </svg>
          <h2 className="text-2xl font-bold text-text">Password Recovery</h2>
          <p className="text-text-muted text-sm mt-1">Enter your registered email below to receive a secure login key.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {success ? (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-center shadow-sm">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Recovery initiated!</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-1">If that email exists in the matrix, an instructional link has been sent.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-text mb-1 tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-subtle">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full p-2.5 bg-canvas border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors text-text"
                  placeholder="live@invenio.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 px-4 mt-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Transmitting...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center text-sm font-semibold text-text-subtle hover:text-primary transition-colors">
            <ArrowLeft size={16} className="mr-1.5" /> Return to Terminal
          </Link>
        </div>
      </div>
    </div>
  );
}
