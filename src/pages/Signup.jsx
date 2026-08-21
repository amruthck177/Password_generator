import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Mail, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const { signup, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!understood) return;
    await signup(email, password, masterPassword);
    navigate('/vault');
  };

  return (
    <div className="w-full max-w-md mx-auto mt-12 z-10 relative pb-12">
      <div className="glass p-8 rounded-2xl flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-zinc-400 text-sm">Join SecureGen and start protecting your digital life.</p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-300 font-medium ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-zinc-300 font-medium ml-1">Account Password</label>
            <p className="text-xs text-zinc-500 ml-1">Used to verify your identity.</p>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Account password"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-4">
            <label className="text-sm text-emerald-400 font-bold ml-1">Master Password</label>
            <p className="text-xs text-zinc-400 ml-1">Used to encrypt your vault. Must be different.</p>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              <input 
                type="password" required value={masterPassword} onChange={e => setMasterPassword(e.target.value)}
                className="w-full bg-zinc-900/50 border border-emerald-500/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                placeholder="Your ultra-secure master key"
              />
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mt-2">
            <div className="flex gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
              <div className="flex flex-col gap-2">
                <h4 className="text-red-400 font-semibold text-sm">Zero-Knowledge Architecture</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  SecureGen cannot reset your master password. If you lose it, your vault and all saved passwords will be permanently unrecoverable. We cannot help you get it back.
                </p>
                <label className="flex items-start gap-2 mt-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5 flex-shrink-0">
                    <input 
                      type="checkbox" required checked={understood} onChange={e => setUnderstood(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-4 h-4 rounded border border-red-500/50 bg-zinc-900 peer-checked:bg-red-500 peer-checked:border-red-500 transition-colors"></div>
                  </div>
                  <span className="text-zinc-300 text-xs">I understand that if I lose my Master Password, my data is gone forever.</span>
                </label>
              </div>
            </div>
          </div>

          <button type="submit" disabled={!understood || loading} className="flex justify-center items-center w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-900 font-bold py-3 rounded-xl mt-2 transition-colors">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
          </button>
        </form>

        <p className="text-zinc-500 text-sm text-center">
          Already have an account? <Link to="/login" className="text-emerald-400 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
