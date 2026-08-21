# SecureGen 🔐

A **client-side encrypted password manager** built with React + Vite. Every password is generated locally and every saved credential is end-to-end encrypted — nothing sensitive ever touches a server.

---

## Features

### 🎲 Password Generator
- Configurable length (8–128 characters)
- Toggle: uppercase, lowercase, numbers, symbols
- **Passphrase mode** — memorable word combinations
- Real-time **zxcvbn** strength meter with crack-time estimate
- In-memory **generation history** (cleared on refresh)

### 🔐 Encrypted Vault
- Store passwords and **Secure Notes** (API keys, recovery codes, Wi-Fi passwords, etc.)
- AES-GCM encryption with a key derived from your master password (PBKDF2, 100k iterations)
- Master password is **never stored or sent anywhere**
- Reveal gate — passwords/notes hidden by default, click-to-reveal with confirmation
- **Clipboard auto-clear** — copies overwrite themselves after 30 seconds

### 🛡️ Security Features
| Feature | Detail |
|---|---|
| Encryption | AES-256-GCM |
| Key Derivation | PBKDF2 · SHA-256 · 100,000 iterations |
| Breach Checking | [HIBP](https://haveibeenpwned.com/) k-anonymity (only 5-char SHA-1 prefix sent) |
| Auto-Lock | Session wipes keys from memory after 5 min of inactivity |
| CSP | Strict Content Security Policy blocks XSS & data exfiltration |
| No Recovery | Zero-knowledge — master password has no reset |

### 📊 Password Health Dashboard
- Overall **health score** (0–100) with animated SVG ring
- Flags **weak** passwords (zxcvbn score ≤ 2) with crack-time display
- Detects **duplicate** passwords reused across accounts
- Manual **breach scan** against Have I Been Pwned

### 🗂️ Vault Organization
- **Tags** — Work · Personal · Finance · Social · Other
- Filter by tag, entry type (Passwords / Notes), or search
- Sort by Name or Date Added

### 📤 Export / Import
| Format | Security |
|---|---|
| `.sgx` Encrypted Backup | Re-encrypted with your master password — safe to store anywhere |
| Plaintext CSV | Passwords visible — use only to migrate, delete immediately |
- Import preview before committing
- Duplicate detection on import (skips same label + username)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| 3D Background | React Three Fiber + Drei |
| Crypto | Web Crypto API (native browser) |
| Strength | zxcvbn |
| Routing | React Router v7 |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build
```

---

## Security Architecture

```
Master Password
     │
     ▼ PBKDF2 (100k iterations, random salt)
  CryptoKey  ◄── never stored, lives in memory only
     │
     ▼ AES-GCM (random IV per entry)
  Ciphertext  ──► localStorage (safe to read — useless without key)
```

- **Generation** happens entirely in the browser — no server involved
- **Encryption/decryption** happens client-side before any persistence
- **Breach checking** sends only the first 5 characters of a SHA-1 hash (k-anonymity)
- **Auto-lock** wipes `CryptoKey` + decrypted vault from memory on inactivity
- **No master password recovery** — zero-knowledge by design

---

## Project Structure

```
src/
├── components/
│   ├── BackgroundScene.jsx   # Three.js animated background
│   ├── Generator.jsx         # Password generator + history panel
│   ├── LockScreen.jsx        # Session auto-lock re-auth modal
│   └── Navbar.jsx
├── pages/
│   ├── Health.jsx            # Password health dashboard
│   ├── Login.jsx
│   ├── Signup.jsx
│   └── Vault.jsx             # Encrypted vault (passwords + notes)
├── store/
│   └── useAuthStore.js       # Zustand store (auth, vault, history)
└── utils/
    ├── crypto.js             # PBKDF2 + AES-GCM helpers
    ├── exportImport.js       # .sgx and CSV export/import
    ├── healthCheck.js        # zxcvbn analysis + duplicate detection
    └── hibp.js               # Have I Been Pwned k-anonymity check
```

---

## Limitations

- **No cloud sync** — vault is stored in `localStorage` (device-local)
- **No master password recovery** — this is intentional (zero-knowledge)
- **No mobile app** — web only (React Native port planned)
