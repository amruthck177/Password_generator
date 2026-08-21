import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Shield, LogOut, User, HeartPulse, Cloud, HardDrive } from 'lucide-react';

export default function Navbar() {
  const { user, logout, syncStatus } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="w-full p-4 absolute top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Shield className="text-emerald-500 group-hover:text-emerald-400 transition-colors" size={28} />
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
            Secure<span className="text-emerald-500">Gen</span>
          </span>
        </Link>

        <div className="flex gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/vault" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                My Vault
              </Link>
              <Link to="/health" className="text-sm font-semibold text-zinc-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                <HeartPulse size={15} /> Health
              </Link>
              {/* Cloud sync status badge */}
              {syncStatus && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border
                  ${syncStatus === 'synced'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-zinc-500 border-zinc-700 bg-zinc-900'}`}>
                  {syncStatus === 'synced'
                    ? <><Cloud size={10} /> Cloud</>
                    : <><HardDrive size={10} /> Local</>}
                </span>
              )}
              <span className="text-sm text-zinc-400 flex items-center gap-2 border-l border-zinc-700 pl-4">
                <User size={16} /> {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors ml-2"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm text-zinc-300 hover:text-white transition-colors px-4 py-2">
                Log in
              </Link>
              <Link to="/signup" className="text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
