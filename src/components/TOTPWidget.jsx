import React, { useState, useEffect, useRef } from 'react';
import { generateTOTP, getTOTPSecondsLeft, isValidBase32 } from '../utils/totp';
import { Copy, CheckCircle2, RefreshCw } from 'lucide-react';

const TIME_STEP = 30;

/**
 * Live TOTP display widget.
 * Shows the current 6-digit code, a countdown ring, and a copy button.
 */
export default function TOTPWidget({ secret }) {
  const [code, setCode] = useState('------');
  const [secondsLeft, setSecondsLeft] = useState(TIME_STEP);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef(null);

  const refresh = async () => {
    try {
      const c = await generateTOTP(secret);
      setCode(c);
      setError(false);
    } catch {
      setCode('ERROR');
      setError(true);
    }
    setSecondsLeft(getTOTPSecondsLeft());
  };

  useEffect(() => {
    if (!secret || !isValidBase32(secret)) {
      setCode('INVALID');
      setError(true);
      return;
    }

    refresh();

    timerRef.current = setInterval(() => {
      const s = getTOTPSecondsLeft();
      setSecondsLeft(s);
      if (s === TIME_STEP) refresh(); // new period just started
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [secret]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SVG ring for countdown
  const size = 28;
  const strokeWidth = 2.5;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (secondsLeft / TIME_STEP) * circ;
  const ringColor = secondsLeft <= 5 ? '#ef4444' : secondsLeft <= 10 ? '#f59e0b' : '#10b981';

  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${error ? 'bg-red-500/10' : 'bg-zinc-900/60'} border ${error ? 'border-red-500/30' : 'border-zinc-800'}`}>
      {/* Countdown ring */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={ringColor} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-zinc-400">
          {secondsLeft}
        </span>
      </div>

      {/* Code */}
      <span className={`font-mono text-sm font-bold tracking-widest flex-1 ${error ? 'text-red-400' : 'text-white'}`}>
        {code.slice(0, 3)} {code.slice(3)}
      </span>

      {/* Copy */}
      <button onClick={handleCopy} disabled={error}
        className="text-zinc-500 hover:text-emerald-400 transition-colors flex-shrink-0"
        title="Copy code">
        {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
