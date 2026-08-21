// src/utils/supabase.js
// Supabase client for encrypted cloud sync.
// Set your project URL and anon key in .env.local:
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Will be null if env vars are not set — app falls back to localStorage
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isSupabaseEnabled = !!supabase;

// ─── Auth wrappers ────────────────────────────────────────────────────────────

export async function supabaseSignUp(email, password) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function supabaseSignIn(email, password) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function supabaseSignOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// ─── Vault sync ───────────────────────────────────────────────────────────────

/**
 * Push the entire encrypted vault to Supabase.
 * The server receives only ciphertext + iv — never plaintext passwords.
 * @param {string} userId
 * @param {Array}  encryptedEntries - [{ id, ciphertext, iv }]
 */
export async function pushVaultToSupabase(userId, encryptedEntries) {
  if (!supabase) return;

  // Upsert all entries. Each entry is stored as a row in the `vault` table.
  const rows = encryptedEntries.map(e => ({
    id: e.id,
    user_id: userId,
    ciphertext: e.ciphertext,
    iv: e.iv,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('vault')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw new Error('Sync failed: ' + error.message);
}

/**
 * Pull all encrypted vault entries for the current user from Supabase.
 * @param {string} userId
 * @returns {Array} [{ id, ciphertext, iv }]
 */
export async function pullVaultFromSupabase(userId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('vault')
    .select('id, ciphertext, iv')
    .eq('user_id', userId);

  if (error) throw new Error('Pull failed: ' + error.message);
  return data;
}

/**
 * Delete a specific vault entry from Supabase.
 */
export async function deleteVaultEntryFromSupabase(entryId) {
  if (!supabase) return;
  await supabase.from('vault').delete().eq('id', entryId);
}

// ─── Salt sync (stored server-side so user can log in from any device) ────────

/**
 * Store the PBKDF2 salt for the user.
 * The salt is NOT secret — it's stored alongside the ciphertext.
 */
export async function pushSaltToSupabase(userId, salt) {
  if (!supabase) return;
  await supabase.from('user_keys').upsert({ user_id: userId, salt }, { onConflict: 'user_id' });
}

export async function pullSaltFromSupabase(userId) {
  if (!supabase) return null;
  const { data } = await supabase.from('user_keys').select('salt').eq('user_id', userId).single();
  return data?.salt ?? null;
}
