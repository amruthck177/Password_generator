import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, Mail, KeyRound, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, masterPassword);
      navigate('/vault');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-24 z-10 relative">
      <div className="glass p-8 rounded-2xl flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-zinc-400 text-sm">Enter your master password to decrypt your vault.</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg flex gap-2 items-center">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-300 font-medium ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-300 font-medium ml-1">Master Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="password" 
                required
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••••••••••"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold py-3 rounded-xl mt-2 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Decrypt & Unlock Vault'}
          </button>
        </form>

        <p className="text-zinc-500 text-sm text-center">
          Don't have an account? <Link to="/signup" className="text-emerald-400 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
