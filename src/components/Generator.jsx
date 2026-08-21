import React, { useState, useEffect, useCallback } from 'react';
import { Copy, RefreshCw, CheckCircle2, History, X, Trash2, Clock } from 'lucide-react';
import zxcvbn from 'zxcvbn';
import VaultLock from './VaultLock';
import { EFF_WORDLIST } from '../utils/dictionary';
import { useAuthStore } from '../store/useAuthStore';

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
};

const AMBIGUOUS_CHARS = 'il1Lo0O';

function formatTimeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function Generator() {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('random'); // 'random' or 'passphrase'
  const [length, setLength] = useState(16);
  const [wordCount, setWordCount] = useState(4);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    capitalizeWords: false,
    includeNumberInPassphrase: false,
  });
  const [strength, setStrength] = useState({ score: 0, feedback: null, crackTime: '' });
  const [copied, setCopied] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const { addToHistory, clearHistory, passwordHistory } = useAuthStore();

  const generatePassword = useCallback(() => {
    let generated = '';

    if (mode === 'random') {
      let charset = '';
      if (options.uppercase) charset += CHAR_SETS.uppercase;
      if (options.lowercase) charset += CHAR_SETS.lowercase;
      if (options.numbers) charset += CHAR_SETS.numbers;
      if (options.symbols) charset += CHAR_SETS.symbols;

      if (options.excludeAmbiguous) {
        charset = charset.split('').filter(char => !AMBIGUOUS_CHARS.includes(char)).join('');
      }

      if (charset === '') {
        setPassword('');
        setStrength({ score: 0, feedback: null, crackTime: '' });
        return;
      }

      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      
      for (let i = 0; i < length; i++) {
        generated += charset[array[i] % charset.length];
      }
    } else {
      // Passphrase Mode
      const array = new Uint32Array(wordCount);
      window.crypto.getRandomValues(array);
      let words = [];
      for (let i = 0; i < wordCount; i++) {
        let word = EFF_WORDLIST[array[i] % EFF_WORDLIST.length];
        if (options.capitalizeWords) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }
        words.push(word);
      }
      
      if (options.includeNumberInPassphrase) {
        const numArr = new Uint32Array(1);
        window.crypto.getRandomValues(numArr);
        const randomNum = (numArr[0] % 100).toString(); // 0-99
        words[words.length - 1] += randomNum;
      }
      
      generated = words.join('-');
    }

    setPassword(generated);
    addToHistory(generated);

    const result = zxcvbn(generated);
    setStrength({
      score: result.score,
      feedback: result.feedback.warning || result.feedback.suggestions[0] || '',
      crackTime: result.crack_times_display.offline_fast_hashing_1e10_per_second
    });
  }, [mode, length, wordCount, options, addToHistory]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyHistoryEntry = async (id, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedHistoryId(id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOptionChange = (key) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-full max-w-xl mx-auto z-10 relative">
      <VaultLock strengthScore={strength.score} />
      
      <div className="glass p-6 sm:p-8 rounded-2xl flex flex-col gap-6">
        
        {/* Mode Toggle */}
        <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
          <button 
            onClick={() => setMode('random')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'random' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Random Characters
          </button>
          <button 
            onClick={() => setMode('passphrase')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'passphrase' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Passphrase
          </button>
        </div>

        {/* Password Display */}
        <div className="relative group">
          <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-4 sm:p-5 flex items-center justify-between font-mono text-xl sm:text-2xl break-all min-h-[5rem]">
            <span className="tracking-wide text-emerald-400">
              {password || 'Select options to generate'}
            </span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <button 
                onClick={() => setShowHistory(true)}
                className={`p-2 hover:bg-zinc-800 rounded-lg transition-colors relative ${passwordHistory.length > 0 ? 'text-emerald-400' : 'text-zinc-400 hover:text-emerald-400'}`}
                title="View history"
              >
                <History size={24} />
                {passwordHistory.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-zinc-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {passwordHistory.length > 9 ? '9+' : passwordHistory.length}
                  </span>
                )}
              </button>
              <button 
                onClick={generatePassword}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-emerald-400"
                title="Regenerate"
              >
                <RefreshCw size={24} />
              </button>
              <button 
                onClick={handleCopy}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-emerald-400"
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Copy size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Strength Meter */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Password Strength</span>
            <span className={
              strength.score === 0 ? 'text-red-500' :
              strength.score === 1 ? 'text-orange-500' :
              strength.score === 2 ? 'text-yellow-500' :
              strength.score === 3 ? 'text-lime-500' :
              'text-emerald-500'
            }>
              {strength.score === 0 && 'Very Weak'}
              {strength.score === 1 && 'Weak'}
              {strength.score === 2 && 'Fair'}
              {strength.score === 3 && 'Strong'}
              {strength.score === 4 && 'Very Strong'}
            </span>
          </div>
          <div className="flex gap-1 h-2">
            {[0, 1, 2, 3].map(index => (
              <div 
                key={index} 
                className={`flex-1 rounded-full transition-all duration-300 ${
                  index < strength.score 
                    ? (strength.score < 2 ? 'bg-red-500' : strength.score < 3 ? 'bg-yellow-500' : strength.score < 4 ? 'bg-lime-500' : 'bg-emerald-500')
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between items-start mt-1">
            <p className="text-xs text-zinc-500">{strength.feedback}</p>
            {strength.crackTime && (
              <p className="text-xs text-zinc-400 text-right whitespace-nowrap ml-4">
                Est. crack time: <span className="text-emerald-400 font-mono">{strength.crackTime}</span>
              </p>
            )}
          </div>
        </div>

        <hr className="border-zinc-800" />

        {/* Controls */}
        {mode === 'random' ? (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-zinc-300 font-medium">Password Length</label>
                <span className="text-emerald-400 font-mono text-lg bg-zinc-900/50 px-3 py-1 rounded-md border border-zinc-800">{length}</span>
              </div>
              <input 
                type="range" min="8" max="64" value={length} 
                onChange={(e) => setLength(parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {Object.entries({
                uppercase: 'Uppercase (A-Z)',
                lowercase: 'Lowercase (a-z)',
                numbers: 'Numbers (0-9)',
                symbols: 'Symbols (!@#$)',
                excludeAmbiguous: 'Exclude Ambiguous'
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" checked={options[key]} onChange={() => handleOptionChange(key)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-900 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors"></div>
                    <CheckCircle2 size={14} className="absolute text-zinc-900 opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors select-none">{label}</span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-zinc-300 font-medium">Word Count</label>
                <span className="text-emerald-400 font-mono text-lg bg-zinc-900/50 px-3 py-1 rounded-md border border-zinc-800">{wordCount}</span>
              </div>
              <input 
                type="range" min="3" max="10" value={wordCount} 
                onChange={(e) => setWordCount(parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 mt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={options.capitalizeWords} onChange={() => handleOptionChange('capitalizeWords')} className="peer sr-only" />
                  <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-900 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors"></div>
                  <CheckCircle2 size={14} className="absolute text-zinc-900 opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors select-none">Capitalize Words</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={options.includeNumberInPassphrase} onChange={() => handleOptionChange('includeNumberInPassphrase')} className="peer sr-only" />
                  <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-900 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors"></div>
                  <CheckCircle2 size={14} className="absolute text-zinc-900 opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors select-none">Include Number</span>
              </label>
            </div>
          </>
        )}

      </div>

      {/* History Slide-over Panel */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm bg-zinc-950 border-l border-zinc-800 flex flex-col h-full shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <History size={20} className="text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Generation History</h2>
              </div>
              <div className="flex items-center gap-2">
                {passwordHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-zinc-400 hover:text-white transition-colors ml-2"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2">
              <Clock size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Session-only. Clears on page refresh for your security.
              </p>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {passwordHistory.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center mt-10">No history yet. Generate some passwords!</p>
              ) : (
                passwordHistory.map((entry) => (
                  <div 
                    key={entry.id}
                    className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3 group hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-emerald-400 break-all leading-relaxed">{entry.value}</p>
                      <p className="text-xs text-zinc-600 mt-1">{formatTimeAgo(entry.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => handleCopyHistoryEntry(entry.id, entry.value)}
                      className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors flex-shrink-0"
                      title="Copy"
                    >
                      {copiedHistoryId === entry.id
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <Copy size={18} />
                      }
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
