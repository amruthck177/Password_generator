import React, { useMemo, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { analyzeVault, getScoreColor, getScoreLabel, getAgeStatus } from '../utils/healthCheck';
import { checkPasswordBreach } from '../utils/hibp';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Copy, Loader2, RefreshCw, Clock
} from 'lucide-react';

// --- Animated SVG Score Ring ---
function ScoreRing({ score, color }) {
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#27272a" strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
        />
      </svg>
      {/* Score label overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white" style={{ color }}>{score}</span>
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">{getScoreLabel(score)}</span>
      </div>
    </div>
  );
}

// --- Strength dot indicator ---
function StrengthDot({ score }) {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[score] ?? 'bg-zinc-600'}`} />;
}

// --- Entry row for issue cards ---
function EntryRow({ entry, tag, tagColor }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {entry.strengthScore !== undefined && <StrengthDot score={entry.strengthScore} />}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{entry.label}</p>
          <p className="text-xs text-zinc-500 truncate">{entry.username}</p>
          {entry.crackTime && (
            <p className="text-xs text-zinc-600 mt-0.5">Crack time: <span className="text-amber-400 font-mono">{entry.crackTime}</span></p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {tag && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagColor}`}>{tag}</span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors"
          title="Copy password"
        >
          {copied ? <ShieldCheck size={15} className="text-emerald-500" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

// --- Issue section card ---
function IssueCard({ icon, title, count, color, children, isEmpty, emptyMsg }) {
  return (
    <div className={`glass-panel p-5 flex flex-col gap-3 ${count > 0 ? `border-${color}-500/30` : ''}`}
      style={count > 0 ? { borderColor: `${color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#a855f7'}33` } : {}}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-bold text-white">{title}</h3>
        </div>
        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${count > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {count} {count === 1 ? 'issue' : 'issues'}
        </span>
      </div>
      {isEmpty
        ? <p className="text-sm text-zinc-500 py-2">{emptyMsg}</p>
        : children}
    </div>
  );
}

export default function Health() {
  const { vault } = useAuthStore();
  const report = useMemo(() => analyzeVault(vault), [vault]);
  const color = getScoreColor(report.score);

  // Breach state
  const [breachResults, setBreachResults] = useState({}); // { id: count }
  const [scanning, setScanning] = useState(false);

  const runBreachScan = async () => {
    setScanning(true);
    const results = {};
    for (const entry of vault) {
      results[entry.id] = await checkPasswordBreach(entry.password);
      setBreachResults({ ...results });
      await new Promise(r => setTimeout(r, 400));
    }
    setScanning(false);
  };

  const breachedEntries = vault.filter(e => breachResults[e.id] > 0);
  const scanDone = Object.keys(breachResults).length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto z-10 relative pb-12">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Password Health</h1>
        <p className="text-zinc-400 text-sm">An analysis of your vault security. Issues are computed locally — nothing leaves your device.</p>
      </div>

      {vault.length === 0 ? (
        <div className="glass-panel p-12 text-center text-zinc-500">
          <ShieldAlert size={40} className="mx-auto mb-4 text-zinc-700" />
          <p>Your vault is empty. Add some passwords first to see your health report.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Score + summary row */}
          <div className="glass p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-8">
            <ScoreRing score={report.score} color={color} />
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Security Score</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Based on {report.totalEntries} password{report.totalEntries !== 1 ? 's' : ''} in your vault.
                  {report.totalIssues > 0
                    ? ` We found ${report.totalIssues} issue${report.totalIssues !== 1 ? 's' : ''} that need your attention.`
                    : ' Looking good! No weak or duplicate passwords detected.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Weak', value: report.weakEntries.length, danger: report.weakEntries.length > 0 },
                  { label: 'Duplicates', value: report.duplicateGroups.length, danger: report.duplicateGroups.length > 0 },
                  { label: 'Breached', value: breachedEntries.length, danger: breachedEntries.length > 0, pending: !scanDone },
                ].map(({ label, value, danger, pending }) => (
                  <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${danger ? 'text-red-400' : pending ? 'text-zinc-600' : 'text-emerald-400'}`}>
                      {pending ? '—' : value}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Issue Cards */}
          <div className="grid grid-cols-1 gap-4">

            {/* Breached */}
            <IssueCard
              icon={<ShieldAlert size={18} className="text-red-400" />}
              title="Breached Passwords"
              count={breachedEntries.length}
              color="red"
              isEmpty={!scanDone && !scanning}
              emptyMsg={
                <button
                  onClick={runBreachScan}
                  disabled={scanning}
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <RefreshCw size={14} /> Run breach scan to check Have I Been Pwned
                </button>
              }
            >
              {scanning && Object.keys(breachResults).length < vault.length && (
                <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
                  <Loader2 size={14} className="animate-spin" />
                  Scanning {Object.keys(breachResults).length} / {vault.length}...
                </div>
              )}
              {scanDone && breachedEntries.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 py-2">
                  <ShieldCheck size={16} /> No breached passwords found!
                </div>
              )}
              {breachedEntries.map(entry => (
                <EntryRow
                  key={entry.id} entry={entry}
                  tag={`${breachResults[entry.id].toLocaleString()} breaches`}
                  tagColor="bg-red-500/20 text-red-400"
                />
              ))}
              {scanDone && (
                <button onClick={runBreachScan} disabled={scanning} className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                  <RefreshCw size={12} /> Re-scan
                </button>
              )}
            </IssueCard>

            {/* Weak */}
            <IssueCard
              icon={<AlertTriangle size={18} className="text-amber-400" />}
              title="Weak Passwords"
              count={report.weakEntries.length}
              color="amber"
              isEmpty={report.weakEntries.length === 0}
              emptyMsg="All passwords meet the strength threshold. Great work!"
            >
              {report.weakEntries.map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </IssueCard>

            {/* Duplicates */}
            <IssueCard
              icon={<Copy size={18} className="text-purple-400" />}
              title="Duplicate Passwords"
              count={report.duplicateGroups.length}
              color="purple"
              isEmpty={report.duplicateGroups.length === 0}
              emptyMsg="All passwords are unique across your vault. Excellent!"
            >
              {report.duplicateGroups.map((group, idx) => (
                <div key={idx} className="mb-3 last:mb-0">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                    Group {idx + 1} — {group.length} accounts share this password
                  </p>
                  {group.map(entry => (
                    <EntryRow
                      key={entry.id} entry={{ ...entry, strengthScore: undefined }}
                      tag="duplicate"
                      tagColor="bg-purple-500/20 text-purple-400"
                    />
                  ))}
                </div>
              ))}
            </IssueCard>

            {/* Stale */}
            <IssueCard
              icon={<Clock size={18} className="text-sky-400" />}
              title="Stale Passwords (90+ days)"
              count={report.staleEntries?.length ?? 0}
              color="sky"
              isEmpty={!report.staleEntries?.length}
              emptyMsg="All passwords have been updated recently. Keep it up!"
            >
              {(report.staleEntries ?? []).map(entry => {
                const age = getAgeStatus(entry.ageDays);
                return (
                  <EntryRow
                    key={entry.id} entry={entry}
                    tag={age.label}
                    tagColor="bg-sky-500/20 text-sky-400"
                  />
                );
              })}
            </IssueCard>
          </div>
        </div>
      )}
    </div>
  );
}
