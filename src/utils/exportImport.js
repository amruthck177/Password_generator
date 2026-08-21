// src/utils/exportImport.js
import { encryptData, decryptData } from './crypto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Encrypted Export (.sgx) ──────────────────────────────────────────────────

/**
 * Encrypts the entire vault with the current session key and downloads as .sgx
 */
export async function exportEncrypted(vault, cryptoKey) {
  const payload = { version: 1, exportedAt: new Date().toISOString(), entries: vault };
  const { ciphertext, iv } = await encryptData(payload, cryptoKey);
  const fileContent = JSON.stringify({ format: 'securegen-vault-v1', iv, ciphertext });
  triggerDownload(fileContent, `securegen-backup-${timestamp()}.sgx`, 'application/json');
}

/**
 * Reads a .sgx file and decrypts it with the provided key.
 * Returns the array of vault entries on success, throws on bad key/format.
 */
export async function importEncrypted(file, cryptoKey) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (parsed.format !== 'securegen-vault-v1') {
    throw new Error('Unrecognized file format. Only .sgx files from SecureGen are supported.');
  }

  const { iv, ciphertext } = parsed;
  const decrypted = await decryptData(ciphertext, iv, cryptoKey);

  if (!decrypted.entries || !Array.isArray(decrypted.entries)) {
    throw new Error('Invalid backup file structure.');
  }

  return decrypted.entries;
}

// ─── Plaintext CSV Export ─────────────────────────────────────────────────────

const CSV_HEADERS = ['label', 'username', 'password', 'url', 'notes'];

/**
 * Exports the vault as a plaintext CSV file.
 */
export function exportCSV(vault) {
  const escape = (val = '') => `"${String(val).replace(/"/g, '""')}"`;
  const header = CSV_HEADERS.join(',');
  const rows = vault.map(entry =>
    CSV_HEADERS.map(key => escape(entry[key] ?? '')).join(',')
  );
  const csv = [header, ...rows].join('\r\n');
  triggerDownload(csv, `securegen-export-${timestamp()}.csv`, 'text/csv');
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

/**
 * Parses a CSV file and returns a structured array of entry objects.
 * Handles quoted fields and optional BOM.
 */
export async function importCSV(file) {
  const raw = await file.text();
  // Strip BOM if present
  const text = raw.replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV file appears to be empty.');

  // Parse header (case-insensitive)
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());

  const parseRow = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) { inQuotes = true; continue; }
      if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      if (ch === '"' && inQuotes) { inQuotes = false; continue; }
      if (ch === ',' && !inQuotes) { values.push(current); current = ''; continue; }
      current += ch;
    }
    values.push(current);
    return values;
  };

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const entry = {};
    headers.forEach((header, idx) => {
      // Map common CSV column names to our fields
      const mapping = { name: 'label', site: 'url', website: 'url', login: 'username' };
      const key = mapping[header] || header;
      if (CSV_HEADERS.includes(key)) entry[key] = values[idx]?.trim() ?? '';
    });
    if (entry.label || entry.username || entry.password) {
      entries.push({ ...entry, id: crypto.randomUUID() });
    }
  }

  if (entries.length === 0) throw new Error('No valid entries found in the CSV file.');
  return entries;
}
