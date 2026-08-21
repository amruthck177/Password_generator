import { create } from 'zustand';
import { deriveKey, encryptData, decryptData } from '../utils/crypto';
import {
  isSupabaseEnabled,
  supabaseSignUp, supabaseSignIn, supabaseSignOut,
  pushVaultToSupabase, pullVaultFromSupabase,
  pushSaltToSupabase, pullSaltFromSupabase,
} from '../utils/supabase';

// A helper to simulate network latency (used only when Supabase is off)
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const useAuthStore = create((set, get) => ({
  user: null,
  cryptoKey: null,
  vault: [], // Decrypted vault entries in memory
  loading: false,
  isLocked: false, // Auto-lock state — true when session times out

  // Password history — in-memory only, max 20 items, newest first
  passwordHistory: [],

  addToHistory: (password) => {
    if (!password) return;
    const { passwordHistory } = get();
    const filtered = passwordHistory.filter(p => p.value !== password);
    const newEntry = { value: password, timestamp: new Date().toISOString(), id: crypto.randomUUID() };
    set({ passwordHistory: [newEntry, ...filtered].slice(0, 20) });
  },

  clearHistory: () => set({ passwordHistory: [] }),

  /**
   * Lock — wipe the crypto key and decrypted vault from memory.
   * The user's account/session info stays so we know who to re-auth as.
   */
  lock: () => {
    set({ isLocked: true, cryptoKey: null, vault: [], passwordHistory: [] });
  },

  /**
   * Unlock — re-derive key from master password and re-decrypt vault.
   */
  unlock: async (masterPassword) => {
    const { user } = get();
    if (!user) throw new Error('No active session');

    const mockDbUserStr = localStorage.getItem(`securegen_user_${user.email}`);
    if (!mockDbUserStr) throw new Error('Session data not found');

    const { salt } = JSON.parse(mockDbUserStr);
    const { key } = await deriveKey(masterPassword, salt);

    const encryptedVaultStr = localStorage.getItem(`securegen_vault_${user.email}`) || '[]';
    const encryptedVault = JSON.parse(encryptedVaultStr);

    const decryptedVault = [];
    try {
      for (const entry of encryptedVault) {
        const data = await decryptData(entry.ciphertext, entry.iv, key);
        decryptedVault.push({ id: entry.id, ...data });
      }
    } catch {
      throw new Error('Incorrect master password');
    }

    set({ isLocked: false, cryptoKey: key, vault: decryptedVault });
  },


  signup: async (email, password, masterPassword) => {
    set({ loading: true });

    // Derive a brand new key and salt
    const { key, salt } = await deriveKey(masterPassword);

    let userId = 'local-user';

    if (isSupabaseEnabled) {
      // Real auth via Supabase
      const sbUser = await supabaseSignUp(email, password);
      userId = sbUser.id;
      await pushSaltToSupabase(userId, salt);
    } else {
      await delay(500);
      const mockDbUser = { email, salt };
      localStorage.setItem(`securegen_user_${email}`, JSON.stringify(mockDbUser));
      localStorage.setItem(`securegen_vault_${email}`, JSON.stringify([]));
    }

    set({
      user: { email, id: userId },
      cryptoKey: key,
      vault: [],
      loading: false,
      syncStatus: isSupabaseEnabled ? 'synced' : 'local',
    });
  },

  login: async (email, masterPassword) => {
    set({ loading: true });

    let salt, encryptedVault, userId;

    if (isSupabaseEnabled) {
      const sbUser = await supabaseSignIn(email, masterPassword);
      userId = sbUser.id;
      salt = await pullSaltFromSupabase(userId);
      if (!salt) throw new Error('Account data not found on server.');
      encryptedVault = (await pullVaultFromSupabase(userId)) ?? [];
    } else {
      await delay(500);
      const mockDbUserStr = localStorage.getItem(`securegen_user_${email}`);
      if (!mockDbUserStr) { set({ loading: false }); throw new Error('User not found or incorrect credentials'); }
      ({ salt } = JSON.parse(mockDbUserStr));
      userId = 'local-user';
      encryptedVault = JSON.parse(localStorage.getItem(`securegen_vault_${email}`) || '[]');
    }

    const { key } = await deriveKey(masterPassword, salt);

    const decryptedVault = [];
    try {
      for (const entry of encryptedVault) {
        const data = await decryptData(entry.ciphertext, entry.iv, key);
        decryptedVault.push({ id: entry.id, ...data });
      }
    } catch {
      set({ loading: false });
      throw new Error('Incorrect master password');
    }

    set({
      user: { email, id: userId },
      cryptoKey: key,
      vault: decryptedVault,
      loading: false,
      syncStatus: isSupabaseEnabled ? 'synced' : 'local',
    });
  },

  logout: async () => {
    if (isSupabaseEnabled) await supabaseSignOut();
    set({ user: null, cryptoKey: null, vault: [], isLocked: false, syncStatus: null });
  },

  addVaultEntry: async (entryData) => {
    const { user, cryptoKey, vault } = get();
    if (!user || !cryptoKey) return;

    // Ensure every entry has a type and creation timestamp
    const enriched = {
      type: 'password',
      ...entryData,
      createdAt: new Date().toISOString(),
    };

    // Encrypt the sensitive data
    const { ciphertext, iv } = await encryptData(enriched, cryptoKey);
    const newEntryId = crypto.randomUUID();

    const encryptedEntry = { id: newEntryId, ciphertext, iv };

    // Persist encrypted entry
    if (isSupabaseEnabled) {
      await pushVaultToSupabase(user.id, [encryptedEntry]);
    } else {
      const encryptedVaultStr = localStorage.getItem(`securegen_vault_${user.email}`) || '[]';
      const encryptedVault = JSON.parse(encryptedVaultStr);
      encryptedVault.push(encryptedEntry);
      localStorage.setItem(`securegen_vault_${user.email}`, JSON.stringify(encryptedVault));
    }

    // Update local decrypted state
    set({
      vault: [...vault, { id: newEntryId, ...enriched }]
    });
  },

  /**
   * Merges an array of imported entries into the vault.
   * Skips entries whose label+username combo already exists (de-duplication).
   * Re-encrypts each entry before persisting.
   */
  importEntries: async (newEntries) => {
    const { user, cryptoKey, vault } = get();
    if (!user || !cryptoKey) return { added: 0, skipped: 0 };

    // Build a set of existing label+username keys to avoid duplicates
    const existingKeys = new Set(vault.map(e => `${e.label}||${e.username}`));
    let added = 0;
    let skipped = 0;

    const encryptedVaultStr = localStorage.getItem(`securegen_vault_${user.email}`) || '[]';
    const encryptedVault = JSON.parse(encryptedVaultStr);
    const newDecrypted = [];

    for (const entry of newEntries) {
      const key = `${entry.label}||${entry.username}`;
      if (existingKeys.has(key)) { skipped++; continue; }

      const { label, username, password, url, notes } = entry;
      const entryData = { label: label || '', username: username || '', password: password || '', url: url || '', notes: notes || '' };
      const { ciphertext, iv } = await encryptData(entryData, cryptoKey);
      const newId = crypto.randomUUID();
      encryptedVault.push({ id: newId, ciphertext, iv });
      newDecrypted.push({ id: newId, ...entryData });
      existingKeys.add(key);
      added++;
    }

    localStorage.setItem(`securegen_vault_${user.email}`, JSON.stringify(encryptedVault));
    set({ vault: [...vault, ...newDecrypted] });
    return { added, skipped };
  },
}));
