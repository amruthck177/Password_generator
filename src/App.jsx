import React, { useEffect, useRef, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BackgroundScene from './components/BackgroundScene';
import Generator from './components/Generator';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Vault from './pages/Vault';
import Health from './pages/Health';
import LockScreen from './components/LockScreen';
import { useAuthStore } from './store/useAuthStore';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Auto-lock timeout: 5 minutes (300_000ms). Lower for testing if needed.
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="glass max-w-md w-full p-8 rounded-2xl border border-red-500/30 flex flex-col items-center gap-4">
            <AlertTriangle className="text-red-400" size={48} />
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-zinc-400">
              An unexpected error occurred in the browser session.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-red-300 w-full text-left overflow-x-auto font-mono">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={16} /> Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }) {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function InactivityWatcher() {
  const { user, isLocked, lock } = useAuthStore();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user || isLocked) return;

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lock();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start immediately

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, isLocked, lock]);

  return null;
}

function MainLayout({ children }) {
  const isLocked = useAuthStore(state => state.isLocked);
  const user = useAuthStore(state => state.user);

  return (
    <div className="min-h-screen flex flex-col p-4 relative font-sans overflow-x-hidden">
      <BackgroundScene />
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-10">
        {children}
      </main>
      {/* Global lock screen overlay — shown whenever a logged-in session auto-locks */}
      {user && isLocked && <LockScreen />}
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <InactivityWatcher />
        <MainLayout>
          <Routes>
            <Route path="/" element={
              <>
                <div className="z-10 text-center mb-8 mt-4">
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2 drop-shadow-lg">
                    Secure<span className="text-emerald-500">Gen</span>
                  </h1>
                  <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto">
                    Client-side encrypted password generator.
                    No passwords are ever sent to a server.
                  </p>
                </div>
                <Generator />
              </>
            } />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
            <Route path="/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
