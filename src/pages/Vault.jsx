import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  Plus, Search, X, ShieldAlert, ShieldCheck, Loader2,
  Download, Upload, AlertTriangle, ChevronDown, FileJson, FileText,
  CheckCircle2, Eye, EyeOff, Copy, Timer, FileText as NoteIcon,
  Key, StickyNote, ArrowUpDown, Filter
} from 'lucide-react';
import Generator from '../components/Generator';
import TOTPWidget from '../components/TOTPWidget';
import { checkPasswordBreach } from '../utils/hibp';
import { exportEncrypted, exportCSV, importEncrypted, importCSV } from '../utils/exportImport';
import { getAgeDays, getAgeStatus } from '../utils/healthCheck';
import { isValidBase32 } from '../utils/totp';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIPBOARD_CLEAR_SECONDS = 30;

export const TAGS = [
  { label: 'Work',     color: 'bg-blue-500/20   text-blue-400   border-blue-500/30'   },
  { label: 'Personal', color: 'bg-purple-500/20  text-purple-400  border-purple-500/30'  },
  { label: 'Finance',  color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { label: 'Social',   color: 'bg-pink-500/20    text-pink-400    border-pink-500/30'    },
  { label: 'Other',    color: 'bg-zinc-700/40    text-zinc-400    border-zinc-600/40'    },
];

const TAG_MAP = Object.fromEntries(TAGS.map(t => [t.label, t.color]));

function TagChip({ label, small }) {
  const color = TAG_MAP[label] ?? TAG_MAP['Other'];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 ${small ? 'text-[10px] py-0.5' : 'text-xs py-0.5'} font-medium ${color}`}>
      {label}
    </span>
  );
}

// ─── Clipboard hook ────────────────────────────────────────────────────────────

function useCopyWithCountdown() {
  const [copyState, setCopyState] = useState({});
  const timersRef = useRef({});

  const copyWithClear = async (id, text) => {
    await navigator.clipboard.writeText(text);
    if (timersRef.current[id]) clearInterval(timersRef.current[id]);
    let seconds = CLIPBOARD_CLEAR_SECONDS;
    setCopyState(prev => ({ ...prev, [id]: seconds }));
    timersRef.current[id] = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(timersRef.current[id]);
        navigator.clipboard.writeText('').catch(() => {});
        setCopyState(prev => ({ ...prev, [id]: 'done' }));
        setTimeout(() => setCopyState(prev => { const n = { ...prev }; delete n[id]; return n; }), 1500);
      } else {
        setCopyState(prev => ({ ...prev, [id]: seconds }));
      }
    }, 1000);
  };

  useEffect(() => () => Object.values(timersRef.current).forEach(clearInterval), []);
  return { copyState, copyWithClear };
}

// ─── Password Card ────────────────────────────────────────────────────────────

function PasswordCard({ entry, breachStatus, copyState, onCopy }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const status = breachStatus[entry.id];
  const isBreached = status && status.count > 0;
  const cs = copyState[entry.id];

  return (
    <div className={`glass-panel p-4 flex flex-col gap-3 transition-colors group
      ${isBreached ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'hover:border-emerald-500/50'}`}>

      {confirmReveal && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex flex-col gap-2">
          <p>Reveal password in plaintext?</p>
          <div className="flex gap-2">
            <button onClick={() => { setRevealed(true); setConfirmReveal(false); }}
              className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 py-1 rounded-lg transition-colors">Yes</button>
            <button onClick={() => setConfirmReveal(false)}
              className="flex-1 bg-zinc-800 text-zinc-300 py-1 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Key size={12} className="text-emerald-400 flex-shrink-0" />
            <h3 className={`text-sm font-bold truncate transition-colors ${isBreached ? 'text-red-400' : 'text-white group-hover:text-emerald-400'}`}>
              {entry.label}
            </h3>
          </div>
          <p className="text-xs text-zinc-500 truncate pl-4">{entry.username}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {entry.tag && <TagChip label={entry.tag} small />}
          {status && (
            status.loading ? <Loader2 size={14} className="text-zinc-500 animate-spin" />
              : isBreached ? <ShieldAlert size={14} className="text-red-500" />
                : <ShieldCheck size={14} className="text-emerald-500" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-2.5 py-1.5">
        <span className="font-mono text-xs flex-1 truncate text-zinc-300">
          {revealed ? entry.password : '••••••••••••'}
        </span>
        <button onClick={() => revealed ? setRevealed(false) : setConfirmReveal(true)}
          className="text-zinc-600 hover:text-emerald-400 transition-colors flex-shrink-0">
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={() => onCopy(entry.id, entry.password)}
          className="text-zinc-600 hover:text-emerald-400 transition-colors flex-shrink-0 flex items-center gap-0.5">
          {cs === 'done' ? <CheckCircle2 size={13} className="text-emerald-500" />
            : typeof cs === 'number' ? <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><Timer size={11} />{cs}s</span>
              : <Copy size={13} />}
        </button>
      </div>

      {/* TOTP widget — rendered when entry has a valid TOTP secret */}
      {entry.totpSecret && isValidBase32(entry.totpSecret) && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">2FA Code</p>
          <TOTPWidget secret={entry.totpSecret} />
        </div>
      )}

      {/* Age indicator */}
      {(() => { const days = getAgeDays(entry.createdAt); const age = getAgeStatus(days); return days !== null && (
        <p className={`text-[10px] ${age.color} flex items-center gap-1`}>
          <Timer size={10} /> {age.label}
        </p>
      ); })()}

      {isBreached && (
        <div className="p-2 bg-red-500/10 rounded-lg text-red-400 text-xs flex gap-2 items-center">
          <ShieldAlert size={12} className="flex-shrink-0" />
          Found in {status.count.toLocaleString()} breaches. Change immediately.
        </div>
      )}
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ entry, copyState, onCopy }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const cs = copyState[entry.id];

  return (
    <div className="glass-panel p-4 flex flex-col gap-3 transition-colors group hover:border-purple-500/40">
      {confirmReveal && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex flex-col gap-2">
          <p>Reveal note content?</p>
          <div className="flex gap-2">
            <button onClick={() => { setRevealed(true); setConfirmReveal(false); }}
              className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 py-1 rounded-lg transition-colors">Yes</button>
            <button onClick={() => setConfirmReveal(false)}
              className="flex-1 bg-zinc-800 text-zinc-300 py-1 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <StickyNote size={12} className="text-purple-400 flex-shrink-0" />
            <h3 className="text-sm font-bold truncate text-white group-hover:text-purple-400 transition-colors">
              {entry.title || entry.label}
            </h3>
          </div>
          <p className="text-xs text-zinc-600 pl-4">Secure Note</p>
        </div>
        {entry.tag && <TagChip label={entry.tag} small />}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-2.5 relative">
        {revealed ? (
          <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{entry.content}</p>
        ) : (
          <p className="text-xs text-zinc-600 italic select-none">Content hidden</p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => revealed ? setRevealed(false) : setConfirmReveal(true)}
            className="text-zinc-600 hover:text-purple-400 transition-colors">
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {revealed && (
            <button onClick={() => onCopy(entry.id, entry.content)}
              className="text-zinc-600 hover:text-purple-400 transition-colors flex items-center gap-0.5">
              {cs === 'done' ? <CheckCircle2 size={13} className="text-emerald-500" />
                : typeof cs === 'number' ? <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><Timer size={11} />{cs}s</span>
                  : <Copy size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Warning Modal ────────────────────────────────────────────────────────

function CSVWarningModal({ onConfirm, onClose }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass max-w-md w-full rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Export as Plaintext CSV?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">This will write passwords in <strong className="text-amber-400">plain, readable text</strong>. Delete the file immediately after migration.</p>
          </div>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative flex items-center justify-center mt-0.5 flex-shrink-0">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="peer sr-only" />
            <div className="w-4 h-4 rounded border border-amber-500/50 bg-zinc-900 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors"></div>
          </div>
          <span className="text-sm text-zinc-300">I understand the risks.</span>
        </label>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={!confirmed} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold transition-colors disabled:opacity-40">Export CSV</button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Preview Modal ─────────────────────────────────────────────────────

function ImportPreviewModal({ entries, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass max-w-lg w-full rounded-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-white">Import Preview</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3">
          <p className="text-sm text-zinc-400">{entries.length} entries found:</p>
          {entries.map((e, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-semibold text-white">{e.label || e.title || '(no label)'}</p>
              <p className="text-xs text-zinc-400">{e.username}</p>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {loading ? 'Encrypting...' : `Import ${entries.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
      {type === 'success' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Export Dropdown ──────────────────────────────────────────────────────────

function ExportDropdown({ onEncrypted, onCSV }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors text-sm">
        <Download size={16} /> Export <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 glass rounded-xl overflow-hidden z-30 shadow-2xl border border-zinc-700">
          <button onClick={() => { onEncrypted(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left">
            <FileJson size={15} className="text-emerald-400" />
            <div><p className="font-semibold text-xs">Encrypted Backup (.sgx)</p><p className="text-[10px] text-zinc-500">Safe anywhere</p></div>
          </button>
          <div className="border-t border-zinc-800" />
          <button onClick={() => { onCSV(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors text-left">
            <FileText size={15} className="text-amber-400" />
            <div><p className="font-semibold text-xs">Plaintext CSV</p><p className="text-[10px] text-zinc-500">⚠ Passwords visible</p></div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add Entry Modal (now supports both types) ────────────────────────────────

function AddEntryModal({ onClose, onSave }) {
  const [entryType, setEntryType] = useState('password');
  const [formData, setFormData] = useState({ label: '', username: '', password: '', url: '', notes: '', tag: '', title: '', content: '' });
  const [showGenerator, setShowGenerator] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (entryType === 'password') {
      await onSave({ type: 'password', label: formData.label, username: formData.username, password: formData.password, url: formData.url, notes: formData.notes, tag: formData.tag, totpSecret: formData.totpSecret || '' });
    } else {
      await onSave({ type: 'note', label: formData.title, title: formData.title, content: formData.content, tag: formData.tag });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass max-w-lg w-full rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Add Entry</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* Type toggle */}
        <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800 mx-5 mt-5">
          <button onClick={() => setEntryType('password')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${entryType === 'password' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <Key size={14} /> Password
          </button>
          <button onClick={() => setEntryType('note')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${entryType === 'note' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <StickyNote size={14} /> Secure Note
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {showGenerator ? (
            <div>
              <button onClick={() => setShowGenerator(false)} className="text-emerald-400 text-sm hover:underline mb-4">← Back to form</button>
              <Generator />
            </div>
          ) : (
            <form id="add-entry-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {entryType === 'password' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">Label / Name</label>
                    <input required type="text" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-emerald-500" placeholder="e.g. Netflix" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">Username / Email</label>
                    <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-end">
                      <label className="text-sm text-zinc-300 font-medium">Password</label>
                      <button type="button" onClick={() => setShowGenerator(true)} className="text-xs text-emerald-400 hover:underline">Open Generator</button>
                    </div>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                      <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 pl-9 pr-3 text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">URL (Optional)</label>
                    <input type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-emerald-500" placeholder="https://" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">TOTP Secret (Optional)</label>
                    <input type="text" value={formData.totpSecret || ''} onChange={e => setFormData({...formData, totpSecret: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm" placeholder="Base32 secret from QR code" />
                    <p className="text-[10px] text-zinc-600">Scan a 2FA QR code with any QR reader to get the secret. It starts with &quot;otpauth://totp/&quot; — copy just the &quot;secret=...&quot; value.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">Title</label>
                    <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-500" placeholder="e.g. WiFi Password" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300 font-medium">Content</label>
                    <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-500 min-h-[120px] font-mono text-sm" placeholder="Your secret content..." />
                  </div>
                </>
              )}

              {/* Shared: Tag picker */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-zinc-300 font-medium">Tag (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(t => (
                    <button type="button" key={t.label}
                      onClick={() => setFormData({...formData, tag: formData.tag === t.label ? '' : t.label})}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${formData.tag === t.label ? t.color + ' ring-1 ring-offset-1 ring-offset-zinc-900' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>
        {!showGenerator && (
          <div className="p-5 border-t border-zinc-800 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-zinc-300 hover:text-white transition-colors">Cancel</button>
            <button type="submit" form="add-entry-form"
              className={`px-4 py-2 rounded-xl font-bold transition-colors ${entryType === 'note' ? 'bg-purple-500 hover:bg-purple-400 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-900'}`}>
              Encrypt & Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Vault ───────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc',  label: 'Oldest First' },
  { value: 'name-asc',  label: 'Name A→Z'     },
  { value: 'name-desc', label: 'Name Z→A'     },
];

export default function Vault() {
  const { vault, addVaultEntry, cryptoKey, importEntries } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [breachStatus, setBreachStatus] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [showCSVWarning, setShowCSVWarning] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const { copyState, copyWithClear } = useCopyWithCountdown();

  // Filters & sort
  const [activeTag, setActiveTag] = useState(null);    // null = all
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'password' | 'note'
  const [sortBy, setSortBy] = useState('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const usedTags = useMemo(() => {
    const t = new Set(vault.map(e => e.tag).filter(Boolean));
    return [...t];
  }, [vault]);

  const passwordEntries = useMemo(() => vault.filter(e => !e.type || e.type === 'password'), [vault]);

  const filteredVault = useMemo(() => {
    let list = [...vault];
    if (typeFilter === 'password') list = list.filter(e => !e.type || e.type === 'password');
    if (typeFilter === 'note')     list = list.filter(e => e.type === 'note');
    if (activeTag)                 list = list.filter(e => e.tag === activeTag);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(e =>
        (e.label || e.title || '').toLowerCase().includes(q) ||
        (e.username || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name-asc')  return (a.label || a.title || '').localeCompare(b.label || b.title || '');
      if (sortBy === 'name-desc') return (b.label || b.title || '').localeCompare(a.label || a.title || '');
      if (sortBy === 'date-asc')  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // date-desc default
    });
    return list;
  }, [vault, typeFilter, activeTag, searchTerm, sortBy]);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scanVault = async () => {
    setIsScanning(true);
    const newStatus = { ...breachStatus };
    for (const entry of passwordEntries) {
      newStatus[entry.id] = { loading: true };
      setBreachStatus({ ...newStatus });
      const count = await checkPasswordBreach(entry.password);
      newStatus[entry.id] = { count, loading: false };
      setBreachStatus({ ...newStatus });
      await new Promise(r => setTimeout(r, 500));
    }
    setIsScanning(false);
  };

  const handleExportEncrypted = async () => {
    try { await exportEncrypted(vault, cryptoKey); showToast('Encrypted backup downloaded!'); }
    catch (e) { showToast('Export failed: ' + e.message, 'error'); }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      if (file.name.endsWith('.sgx')) setImportPreview({ entries: await importEncrypted(file, cryptoKey) });
      else if (file.name.endsWith('.csv')) setImportPreview({ entries: await importCSV(file) });
      else showToast('Unsupported file type. Use .sgx or .csv.', 'error');
    } catch (err) { showToast('Import error: ' + err.message, 'error'); }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    try {
      const { added, skipped } = await importEntries(importPreview.entries);
      setImportPreview(null);
      showToast(`Imported ${added} entries${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}.`);
    } catch (err) { showToast('Import failed: ' + err.message, 'error'); }
    setImportLoading(false);
  };

  const passwords = filteredVault.filter(e => !e.type || e.type === 'password');
  const notes     = filteredVault.filter(e => e.type === 'note');

  return (
    <div className="w-full max-w-4xl mx-auto z-10 relative">
      <input ref={fileInputRef} type="file" accept=".sgx,.csv" className="hidden" onChange={handleFileSelected} />

      {/* Header */}
      <div className="flex flex-wrap justify-between items-end mb-5 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Vault</h1>
          <p className="text-zinc-500 text-xs">{vault.length} item{vault.length !== 1 ? 's' : ''} • clipboard clears in {CLIPBOARD_CLEAR_SECONDS}s</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={scanVault} disabled={isScanning || passwordEntries.length === 0}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 text-sm">
            {isScanning ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
          <ExportDropdown onEncrypted={handleExportEncrypted} onCSV={() => setShowCSVWarning(true)} />
          <button onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors text-sm">
            <Upload size={16} /> Import
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors">
            <Plus size={18} /> Add
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input type="text" placeholder="Search vault..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-xl py-2.5 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div className="relative">
          <button onClick={() => setShowSortMenu(o => !o)}
            className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl py-2.5 px-3 text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
            <ArrowUpDown size={14} /> {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
          </button>
          {showSortMenu && (
            <div className="absolute right-0 mt-1 w-44 glass rounded-xl overflow-hidden z-20 shadow-xl border border-zinc-700">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors ${sortBy === opt.value ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Type filter */}
        {['all', 'password', 'note'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${typeFilter === t ? 'bg-zinc-700 border-zinc-500 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
            {t === 'all' && <Filter size={11} />}
            {t === 'password' && <Key size={11} />}
            {t === 'note' && <StickyNote size={11} />}
            {t === 'all' ? 'All' : t === 'password' ? 'Passwords' : 'Notes'}
          </button>
        ))}

        {/* Tag filters */}
        {usedTags.length > 0 && <span className="w-px h-5 bg-zinc-800 self-center" />}
        {usedTags.map(tag => (
          <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${activeTag === tag ? TAG_MAP[tag] + ' ring-1 ring-offset-1 ring-offset-zinc-950' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
            {tag}
          </button>
        ))}
        {activeTag && (
          <button onClick={() => setActiveTag(null)} className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {filteredVault.length === 0 ? (
        <div className="py-16 text-center text-zinc-600">
          {searchTerm || activeTag ? 'No matching entries.' : 'Vault is empty — click Add to start.'}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {passwords.length > 0 && (
            <section>
              {notes.length > 0 && <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"><Key size={11} /> Passwords</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {passwords.map(entry => (
                  <PasswordCard key={entry.id} entry={entry} breachStatus={breachStatus} copyState={copyState} onCopy={copyWithClear} />
                ))}
              </div>
            </section>
          )}
          {notes.length > 0 && (
            <section>
              {passwords.length > 0 && <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"><StickyNote size={11} /> Secure Notes</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {notes.map(entry => (
                  <NoteCard key={entry.id} entry={entry} copyState={copyState} onCopy={copyWithClear} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showAddModal && <AddEntryModal onClose={() => setShowAddModal(false)} onSave={addVaultEntry} />}
      {showCSVWarning && <CSVWarningModal onConfirm={() => { exportCSV(vault); setShowCSVWarning(false); showToast('CSV exported. Delete after use.', 'error'); }} onClose={() => setShowCSVWarning(false)} />}
      {importPreview && <ImportPreviewModal entries={importPreview.entries} onConfirm={confirmImport} onClose={() => setImportPreview(null)} loading={importLoading} />}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
