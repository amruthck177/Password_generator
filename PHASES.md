# SecureGen — Complete Build Documentation
## Phase-by-Phase Technical Reference

> **Project:** SecureGen — Client-Side Encrypted Password Manager  
> **Stack:** React 19 · Vite 8 · Tailwind CSS v4 · Zustand · Web Crypto API · React Three Fiber  
> **Principle:** Every password is generated locally. Every saved credential is AES-256-GCM encrypted client-side. Nothing sensitive ever touches a server.

---

## Table of Contents

1. [Phase 1 — Project Foundation & Core Generator](#phase-1)
2. [Phase 2 — 3D Animated UI](#phase-2)
3. [Phase 3 — Authentication System](#phase-3)
4. [Phase 4 — Encrypted Vault](#phase-4)
5. [Phase 5 — Breach Checking (HIBP)](#phase-5)
6. [Phase 6 — Password History](#phase-6)
7. [Phase 7 — Password Health Dashboard](#phase-7)
8. [Phase 8 — Export / Import](#phase-8)
9. [Phase 9 — Security Hardening](#phase-9)
10. [Phase 10 — Secure Notes + Vault Organization](#phase-10)
11. [Phase 11 — Password Aging Alerts](#phase-11)
12. [Phase 12 — TOTP / 2FA Code Generator](#phase-12)
13. [Phase 13 — Supabase Cloud Sync](#phase-13)
14. [Security Architecture Summary](#security-architecture)
15. [File Structure Reference](#file-structure)
16. [How to Run](#how-to-run)

---

## Phase 1 — Project Foundation & Core Generator

### Goal
Bootstrap the React + Vite project and build the core password generation engine.

### What Was Built

#### Project Setup
- Created with `npx create-vite@latest ./` using the React template
- Installed Tailwind CSS v4 (using `@tailwindcss/postcss` — **not** the v3 CLI tools)
- Installed Zustand, `zxcvbn`, `lucide-react`, `react-router-dom`

#### Password Generator Engine (`src/components/Generator.jsx`)

**Character set assembly:**
```
Uppercase: A-Z  (26 chars)
Lowercase: a-z  (26 chars)
Numbers:   0-9  (10 chars)
Symbols:   !@#$%^&*()_+-=[]{}|;:,.<>?  (30 chars)
```

**Cryptographically secure generation:**
```javascript
// Uses crypto.getRandomValues() — NOT Math.random()
const array = new Uint32Array(length);
crypto.getRandomValues(array);
const password = Array.from(array)
  .map(n => charset[n % charset.length])
  .join('');
```

Why `crypto.getRandomValues()`? Unlike `Math.random()`, it uses the OS entropy pool (`/dev/urandom`). Output is statistically indistinguishable from true randomness.

**Passphrase mode:**
Generates human-memorable combinations from a wordlist (e.g., `correct-horse-battery-staple`). More memorable and can be equally strong at sufficient word count.

#### Strength Meter (`zxcvbn`)
`zxcvbn` is a realistic password strength estimator by Dropbox. Unlike rule-based checkers, it:
- Pattern-matches against 30,000+ common passwords
- Detects keyboard walks (`qwerty`, `12345`)
- Detects dates, names, l33t substitutions
- Returns `score` (0–4) + human-readable crack time estimates

Score → UI: 🔴 Very Weak → 🟠 Weak → 🟡 Fair → 🟢 Strong → 💚 Very Strong

### Files Created
- `src/components/Generator.jsx`
- `src/store/useAuthStore.js` (initial)
- `src/index.css`

---

## Phase 2 — 3D Animated Background

### Goal
Make the app visually stunning with a live WebGL background.

### What Was Built

#### Three.js Scene (`src/components/BackgroundScene.jsx`)
Built with `@react-three/fiber` (React bindings) and `@react-three/drei` (helpers).

**Scene composition:**
- ~2000 floating particles using `BufferGeometry` with randomized positions
- Slow auto-rotation giving the scene continuous life
- `PointsMaterial` with custom glow effect
- `@react-spring/three` for spring-physics mount animation

**Why not CSS animation?**
CSS cannot achieve the depth and parallax of a 3D particle field. Three.js renders to a `<canvas>` positioned `fixed` behind all UI content.

**Performance:**
- `useFrame()` animates at ~60fps via requestAnimationFrame
- Particle positions in `Float32Array` typed arrays — far faster than plain JS arrays
- Canvas has `pointer-events: none` — never intercepts user clicks

### Files Created
- `src/components/BackgroundScene.jsx`

---

## Phase 3 — Authentication System

### Goal
Add user accounts so the vault has an owner to scope encrypted data to.

### What Was Built

#### Login / Signup Pages
- `src/pages/Login.jsx` — Email + master password form
- `src/pages/Signup.jsx` — Email + account password + master password

**Key design decision:** The **master password** (encryption key) is conceptually separate from the **account password** (authentication). This architecture lets Supabase auth later use the account password without ever seeing the master password.

#### Route Protection (`src/App.jsx`)
```jsx
function ProtectedRoute({ children }) {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
```

#### Auth Store Actions
- `signup(email, password, masterPassword)` — derives key + salt, persists to localStorage
- `login(email, masterPassword)` — fetches salt, re-derives key, decrypts vault
- `logout()` — wipes all sensitive state from memory

### Files Created
- `src/pages/Login.jsx`
- `src/pages/Signup.jsx`
- `src/App.jsx` (routing)
- `src/store/useAuthStore.js` (auth actions)

---

## Phase 4 — Encrypted Vault

### Goal
Store passwords securely. Core principle: **the server stores only ciphertext. The key never leaves the client.**

### What Was Built

#### Cryptographic Primitives (`src/utils/crypto.js`)

**Key Derivation — PBKDF2:**
```
Master Password + Random Salt
         │
         ▼ PBKDF2-HMAC-SHA256
         │  100,000 iterations
         ▼
     CryptoKey (AES-GCM 256-bit)
```

- **Salt:** 16 bytes of `crypto.getRandomValues()` — unique per user, stored with account (not secret)
- **100,000 iterations:** Makes brute-forcing ~100,000× slower. At 1B guesses/sec, ~28 hours per candidate password.
- **Output:** A `CryptoKey` object marked `extractable: false` — cannot be serialized or extracted

**Encryption — AES-GCM:**
```
Plaintext JSON
     │
     ▼ AES-256-GCM
     │  Random 12-byte IV per entry
     ▼
Ciphertext + 128-bit Authentication Tag
```

- **GCM mode:** Provides both confidentiality AND integrity — any byte modification causes decryption to throw
- **Per-entry IV:** Reusing an IV with the same key in GCM is catastrophic (leaks the key), so every entry gets a fresh random IV
- **Storage format:** `{ id, ciphertext: base64, iv: base64 }`

```javascript
export async function encryptData(plainObject, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plainObject));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}
```

#### Vault UI (`src/pages/Vault.jsx`)
- Grid of cards — label, username, URL
- "Add Entry" modal — label, username, password, URL, notes
- Each entry encrypted before writing to localStorage
- Entire vault decrypted into memory on login, held as plain objects in Zustand

### Files Created
- `src/utils/crypto.js`
- `src/pages/Vault.jsx`
- `src/store/useAuthStore.js` (addVaultEntry)

---

## Phase 5 — Breach Checking (HIBP)

### Goal
Warn users about breached passwords without exposing the actual password to any server.

### What Was Built

#### k-Anonymity (`src/utils/hibp.js`)

The Have I Been Pwned API uses the **k-anonymity model**:

1. Hash the password locally with SHA-1: `abc123` → `6367C48DD...`
2. Send **only the first 5 characters** to the API: `6367C`
3. API returns all hashes starting with `6367C` (~500–1000 entries)
4. Client checks if any returned hash matches the full local hash
5. **The server never sees more than 5 characters** of the SHA-1 hash

```javascript
export async function checkPasswordBreach(password) {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5).toUpperCase();
  const suffix = hash.slice(5).toUpperCase();
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();
  const match = text.split('\n').find(line => line.startsWith(suffix));
  return match ? parseInt(match.split(':')[1]) : 0;
}
```

#### Vault Integration
- "Scan Vault" iterates all password entries with 500ms rate limiting
- Breached: red border + breach count badge + warning
- Safe: green shield

### Files Created
- `src/utils/hibp.js`
- `src/pages/Vault.jsx` (scan UI)

---

## Phase 6 — Password History

### Goal
Track recently generated passwords so users can retrieve one they forgot to copy.

### Design Decision: In-Memory Only
Password history is **never persisted**. It lives in Zustand memory only and is wiped on:
- Page refresh
- Logout
- Auto-lock (Phase 9)

This is intentional — storing generated passwords increases attack surface.

### What Was Built

```javascript
// Store action
addToHistory: (password) => {
  const filtered = passwordHistory.filter(p => p.value !== password);
  const newEntry = { value: password, timestamp: new Date().toISOString(), id: crypto.randomUUID() };
  set({ passwordHistory: [newEntry, ...filtered].slice(0, 20) });
},
```

**History Panel:** Slide-over from the right with `animate-slide-in-right` CSS keyframe animation. Shows timestamps, one-click copy, "Clear All" button.

### Files Modified
- `src/store/useAuthStore.js`
- `src/components/Generator.jsx`
- `src/index.css` (slideInRight keyframe)

---

## Phase 7 — Password Health Dashboard

### Goal
Give users an at-a-glance security audit of their entire vault.

### What Was Built

#### Analysis Engine (`src/utils/healthCheck.js`)

**Weak Detection:** Runs every password through `zxcvbn`. Score ≤ 2 = flagged.

**Duplicate Detection:** Groups entries by `password` value. Any group with 2+ members = duplicate risk (one breach compromises all).

**Stale Detection (Phase 11):** Entries older than 90 days flagged for rotation.

#### Health Score
```
Score = 100 - weakPenalty(max 30) - dupePenalty(max 30) - stalePenalty(max 20)
```

#### Score Ring (SVG)
```jsx
const circumference = 2 * Math.PI * radius;
const offset = circumference - (score / 100) * circumference;
// strokeDashoffset + CSS transition creates the sweep animation
```

Color: 🔴 0–49 → 🟡 50–79 → 🟢 80–100  
Label: "Critical" / "At Risk" / "Fair" / "Great"

### Files Created
- `src/utils/healthCheck.js`
- `src/pages/Health.jsx`

---

## Phase 8 — Export / Import

### Goal
Let users back up their vault and migrate to/from other password managers.

### What Was Built

#### Encrypted Backup (.sgx)
Re-encrypts the entire vault as one JSON blob using the same session `CryptoKey`:
```json
{
  "format": "securegen-vault-v1",
  "iv": "<base64>",
  "ciphertext": "<base64>"
}
```
Without the master password, the file is completely useless to an attacker.

#### Plaintext CSV
Columns: `label, username, password, url, notes`. Compatible with Bitwarden, 1Password, etc.

Requires a **checkbox confirmation** before download — the user must explicitly acknowledge the risk.

#### Import
- `.sgx` → decrypts with session key, validates format header
- `.csv` → parses quoted fields, maps column aliases (`name`→`label`, `site`→`url`, `login`→`username`)
- **Duplicate detection** — skips `label+username` combos already in vault
- **Preview modal** — shows all entries before committing

### Files Created
- `src/utils/exportImport.js`
- `src/store/useAuthStore.js` (importEntries action)

---

## Phase 9 — Security Hardening

### Goal
Implement the four most critical security controls for a client-side password manager.

### 1. Auto-Lock on Inactivity

`InactivityWatcher` in `App.jsx` listens to 6 event types:
```javascript
const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
```

After **5 minutes** of silence, `lock()` fires:
```javascript
lock: () => {
  set({ isLocked: true, cryptoKey: null, vault: [], passwordHistory: [] });
}
```

**What gets wiped:** `CryptoKey`, all decrypted vault entries, password history. Email stays so the lock screen knows who to re-authenticate.

**Unlock:** Re-derives the key from the stored salt using the re-entered master password. Wrong password → AES-GCM decryption throws → error shown.

### 2. Clipboard Auto-Clear (30 seconds)

Custom `useCopyWithCountdown()` hook starts a countdown immediately after every copy:
```javascript
setInterval(() => {
  seconds--;
  if (seconds <= 0) navigator.clipboard.writeText('');
}, 1000);
```
The copy button transforms into a live countdown: `⏱ 28s`

### 3. Reveal Gate
Passwords hidden as `••••••••••••` by default. Eye icon shows an inline confirmation before revealing plaintext — prevents shoulder surfing.

### 4. Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  connect-src 'self' https://api.pwnedpasswords.com https://fonts.googleapis.com;
  object-src 'none';
" />
```
No inline scripts, no eval, no external connections except HIBP + Google Fonts.

### Files Created / Modified
- `src/components/LockScreen.jsx`
- `src/App.jsx` (InactivityWatcher)
- `src/pages/Vault.jsx` (countdown hook, reveal gate)
- `src/index.css` (pingSlow animation)
- `index.html` (CSP)

---

## Phase 10 — Secure Notes + Vault Organization

### Goal
Expand the vault to store any secret, and add organization tools as the vault grows.

### Secure Notes
A second entry `type: 'note'` with title + multiline content. Encrypted **identically** to passwords — same `encryptData()`, same AES-GCM key. Server sees identical ciphertext structure regardless of type.

`healthCheck.js` filters notes out before analysis — `zxcvbn` should only run on passwords.

### Vault Organization

**Tags:** 5 built-in with distinct color schemes (Work=blue, Personal=purple, Finance=emerald, Social=pink, Other=zinc). Stored encrypted inside entry data.

**Filter bar:** Tag chips at the top of vault. Click = filter, click again = clear.

**Type toggle:** All / Passwords / Notes three-way switch.

**Sort:** Newest First · Oldest First · Name A→Z · Name Z→A

**Entry timestamps:**
```javascript
const enriched = {
  type: 'password',
  ...entryData,
  createdAt: new Date().toISOString(),
};
```

### Files Modified
- `src/pages/Vault.jsx` (NoteCard, filter bar, sort, modal type switcher)
- `src/store/useAuthStore.js` (type + createdAt enrichment)
- `src/utils/healthCheck.js` (filter notes)

---

## Phase 11 — Password Aging Alerts

### Goal
Surface how old each password is so users know which to rotate.

### Age Classification
```javascript
const AGE_FRESH = 30;  // < 30 days  → green
const AGE_WARN  = 90;  // 30–90 days → amber
                        // > 90 days  → red ("rotate!")
```

### Vault Card Badge
Every password card shows an age indicator:
```
⏱ 5d old           ← green
⏱ 47d old          ← amber
⏱ 104d old — rotate! ← red
```

### Health Dashboard — Stale Section
`analyzeVault()` returns `staleEntries` (age ≥ 90 days). Health page shows a **Stale Passwords (90+ days)** card with 🕐 clock icon.

Stale penalty contributes up to −20 points to Health Score — a vault of old-but-strong passwords cannot score "Great".

### Files Modified
- `src/utils/healthCheck.js` (staleEntries, AGE constants, getAgeDays, getAgeStatus)
- `src/pages/Vault.jsx` (age badge on PasswordCard)
- `src/pages/Health.jsx` (Stale issue card)

---

## Phase 12 — TOTP / 2FA Code Generator

### Goal
Turn SecureGen into a complete authentication companion with live 2FA codes.

### TOTP Implementation (`src/utils/totp.js`)
Built from scratch with **Web Crypto API only — zero external dependencies**.

**RFC 6238 algorithm (4 steps):**

**Step 1 — Base32 decode the secret:**
```javascript
// Maps A-Z = 0-25, 2-7 = 26-31
// Assembles 5-bit groups into 8-bit bytes
```

**Step 2 — Time counter:**
```javascript
const counter = Math.floor(Date.now() / 1000 / 30); // changes every 30 seconds
```

**Step 3 — HMAC-SHA1:**
```javascript
const sig = await crypto.subtle.sign('HMAC', key, counterBuffer);
// SHA-1 is safe here — HMAC-SHA1 has no known collision vulnerabilities
```

**Step 4 — Dynamic truncation:**
```javascript
const offset = hmac[hmac.length - 1] & 0x0f;
const code = (
  ((hmac[offset]   & 0x7f) << 24) |
  ((hmac[offset+1] & 0xff) << 16) |
  ((hmac[offset+2] & 0xff) << 8)  |
   (hmac[offset+3] & 0xff)
) % 1_000_000;
return String(code).padStart(6, '0');
```

### TOTP Widget (`src/components/TOTPWidget.jsx`)
- Refreshes every second via `setInterval`
- SVG countdown ring depletes over 30s
  - Colors: emerald → amber (≤10s) → red (≤5s)
- Code displayed as `123 456` (split at 3 for readability)
- Copy button, auto-detects period rollover for instant code refresh

### Integration
TOTP secret stored **encrypted** inside the vault entry. Vault card renders `TOTPWidget` when `entry.totpSecret` is a valid Base32 string.

### Files Created
- `src/utils/totp.js`
- `src/components/TOTPWidget.jsx`

---

## Phase 13 — Supabase Cloud Sync

### Goal
Replace mock localStorage with a real cloud database for cross-device access.

### Security Model
```
User Device                       Supabase
───────────                       ────────
masterPassword  ←── never sent    
    │ PBKDF2
    ▼
CryptoKey       ←── never sent    
    │ AES-GCM
    ▼
ciphertext+iv   ─────────────────►  vault table
```

Even if Supabase is breached — only encrypted blobs. Useless without the master password.

### Graceful Degradation
```javascript
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isSupabaseEnabled = !!supabase;
```
If env vars are absent → `null` → all sync functions are no-ops → app uses localStorage.

### Required Supabase Schema
```sql
create table vault (
  id uuid primary key,
  user_id uuid references auth.users not null,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz default now()
);
alter table vault enable row level security;
create policy "Users own their vault"
  on vault for all using (auth.uid() = user_id);

create table user_keys (
  user_id uuid primary key references auth.users,
  salt text not null
);
alter table user_keys enable row level security;
create policy "Users own their keys"
  on user_keys for all using (auth.uid() = user_id);
```

**Row Level Security:** Every query is filtered by `auth.uid() = user_id` — users can only read/write their own rows, even with the public anon key.

### Store Integration
`signup`, `login`, `logout`, `addVaultEntry` all branch on `isSupabaseEnabled`:
```javascript
if (isSupabaseEnabled) {
  // Supabase auth + cloud vault
} else {
  // localStorage fallback
}
```

### Navbar Sync Badge
Shows `☁ Cloud` (emerald) or `💾 Local` (zinc) in the navbar.

### Setup
1. Create project at [supabase.com](https://supabase.com)
2. Run SQL schema in SQL editor
3. Copy `.env.local.example` → `.env.local`
4. Fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
5. `npm run dev`

### Files Created
- `src/utils/supabase.js`
- `.env.local.example`

---

## Security Architecture Summary

### Threat Model

| Threat | Mitigation |
|---|---|
| Server/database breach | AES-256-GCM — ciphertext useless without master password |
| Weak master password | PBKDF2 100k iterations slows brute force 100,000× |
| Shoulder surfing | Reveal gate requires click + confirm dialog |
| Clipboard hijack | Auto-overwrites clipboard after 30 seconds |
| Unattended session | Auto-lock wipes keys after 5 min idle |
| XSS attack | CSP blocks inline scripts + eval |
| Data exfiltration | CSP `connect-src` whitelist (only HIBP + Google Fonts) |
| Password reuse | Health Dashboard duplicate detection |
| Breached passwords | HIBP k-anonymity scan |
| IV reuse (GCM catastrophe) | Fresh random 12-byte IV per entry |

### Cryptographic Decisions

| Operation | Algorithm | Parameters | Rationale |
|---|---|---|---|
| Key Derivation | PBKDF2-HMAC-SHA256 | 100,000 iterations, 16-byte salt | Industry standard, native browser support |
| Encryption | AES-256-GCM | 12-byte IV per entry | Authenticated encryption, tamper-evident |
| Breach Checking | SHA-1 (k-anonymity) | 5-char prefix only | HIBP requirement; not a security-sensitive use of SHA-1 |
| TOTP | HMAC-SHA1 | RFC 6238, 30s period, 6 digits | Universal standard used by all authenticator apps |
| RNG | `crypto.getRandomValues` | — | OS entropy pool, cryptographically secure |

### What Is Never Stored / Transmitted
- ❌ Master password
- ❌ `CryptoKey` object
- ❌ Decrypted vault entries
- ❌ Password history
- ❌ Full SHA-1 hash of passwords (only 5-char prefix to HIBP)
- ❌ TOTP secrets in plaintext

---

## File Structure Reference

```
Password_generator/
├── index.html                     Phase 9  — CSP meta, SEO title
├── .env.local.example             Phase 13 — Supabase env template
├── README.md                               — Project overview
├── PHASES.md                               — This document
│
└── src/
    ├── main.jsx                            — React entry point
    ├── App.jsx                    Phase 3  — Routing, ProtectedRoute
    │                              Phase 9  — InactivityWatcher
    ├── index.css                  Phase 1  — Glass utilities
    │                              Phase 9  — pingSlow keyframe
    │
    ├── components/
    │   ├── BackgroundScene.jsx    Phase 2  — Three.js particles
    │   ├── Generator.jsx          Phase 1  — Generator UI
    │   │                          Phase 6  — History panel
    │   ├── LockScreen.jsx         Phase 9  — Auto-lock modal
    │   ├── Navbar.jsx             Phase 3  — Nav links
    │   │                          Phase 7  — Health link
    │   │                          Phase 13 — Cloud/Local badge
    │   └── TOTPWidget.jsx         Phase 12 — Live TOTP display
    │
    ├── pages/
    │   ├── Login.jsx              Phase 3
    │   ├── Signup.jsx             Phase 3
    │   ├── Vault.jsx              Phase 4  — Encrypted vault
    │   │                          Phase 5  — Breach scan
    │   │                          Phase 8  — Export/Import
    │   │                          Phase 9  — Reveal gate, countdown
    │   │                          Phase 10 — NoteCard, tags, sort
    │   │                          Phase 11 — Age badge
    │   │                          Phase 12 — TOTPWidget
    │   └── Health.jsx             Phase 7  — Score ring, issue cards
    │                              Phase 11 — Stale section
    │
    ├── store/
    │   └── useAuthStore.js        Phase 1  — Store foundation
    │                              Phase 3  — Auth actions
    │                              Phase 4  — addVaultEntry
    │                              Phase 6  — passwordHistory
    │                              Phase 9  — lock/unlock
    │                              Phase 10 — type/createdAt
    │                              Phase 13 — Supabase sync
    │
    └── utils/
        ├── crypto.js              Phase 4  — PBKDF2 + AES-GCM
        ├── hibp.js                Phase 5  — k-anonymity check
        ├── healthCheck.js         Phase 7  — Strength + duplicate
        │                          Phase 11 — Stale analysis
        ├── exportImport.js        Phase 8  — .sgx + CSV
        ├── totp.js                Phase 12 — RFC 6238 TOTP
        └── supabase.js            Phase 13 — Cloud sync client
```

---

## How to Run {#how-to-run}

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Quick Start (Local Mode)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will start at `http://localhost:5173`.

3. **Build for production:**
   ```bash
   npm run build
   ```
   The production bundle will be generated in the `dist/` directory.

4. **Preview production build:**
   ```bash
   npm run preview
   ```

---

### Optional: Enabling Supabase Cloud Sync

By default, SecureGen operates in **Local Mode** (`localStorage`). To enable cross-device cloud synchronization via Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Execute the database schema SQL in your Supabase SQL Editor:
   ```sql
   create table vault (
     id uuid primary key,
     user_id uuid references auth.users not null,
     ciphertext text not null,
     iv text not null,
     updated_at timestamptz default now()
   );
   alter table vault enable row level security;
   create policy "Users own their vault"
     on vault for all using (auth.uid() = user_id);

   create table user_keys (
     user_id uuid primary key references auth.users,
     salt text not null
   );
   alter table user_keys enable row level security;
   create policy "Users own their keys"
     on user_keys for all using (auth.uid() = user_id);
   ```
3. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
4. Add your Supabase credentials to `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
5. Restart the dev server (`npm run dev`). The navbar will display a green `☁ Cloud` badge indicating active cloud sync.

---

*SecureGen — 13 phases, 2437 modules, 0 plaintext passwords ever leave the device.*

