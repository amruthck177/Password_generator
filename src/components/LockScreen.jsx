import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, KeyRound, AlertCircle, Loader2 } from 'lucide-react';

export default function LockScreen() {
  const { user, unlock, logout } = useAuthStore();
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await unlock(masterPassword);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/95 backdrop-blur-xl">
      {/* Subtle animated background ring */}
      <div className="absolute w-96 h-96 rounded-full border border-emerald-500/10 animate-ping-slow" />
      <div className="absolute w-72 h-72 rounded-full border border-emerald-500/5" />

      <div className="relative glass max-w-sm w-full mx-4 rounded-2xl p-8 flex flex-col gap-6">
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <Lock size={28} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Session Locked</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Locked due to inactivity.<br />
              Re-enter your master password to continue.
            </p>
          </div>
          {user && (
            <span className="text-xs text-zinc-600 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
              {user.email}
            </span>
          )}
        </div>

        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg flex gap-2 items-center">
              <AlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="password"
              required
              autoFocus
              value={masterPassword}
              onChange={e => setMasterPassword(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Master password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            {loading ? 'Unlocking...' : 'Unlock Vault'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={logout}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
