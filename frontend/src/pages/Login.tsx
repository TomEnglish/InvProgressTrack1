import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface p-8 rounded-lg shadow-md border border-border">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text">Invenio Progress</h1>
          <p className="text-sm text-text-muted mt-2">Sign in to access your tracking dashboard</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-danger-soft text-danger-deep text-sm rounded-md font-medium">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5 tracking-wide">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 text-sm bg-surface border border-border rounded-md focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all" 
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-text mb-1.5 tracking-wide">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 text-sm bg-surface border border-border rounded-md focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all" 
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
