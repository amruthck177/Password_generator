// src/utils/totp.js
// RFC 6238 TOTP implementation — pure Web Crypto API, no library needed.

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode a Base32 string to a Uint8Array. */
function base32Decode(input) {
  const str = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/** HMAC-SHA1 via Web Crypto API. */
async function hmacSha1(keyBytes, dataBuffer) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBuffer);
  return new Uint8Array(sig);
}

/**
 * Generate a TOTP code.
 * @param {string} secret - Base32-encoded TOTP secret
 * @param {number} timeStep - seconds per step (default 30)
 * @param {number} digits - code length (default 6)
 * @returns {Promise<string>} Zero-padded OTP code
 */
export async function generateTOTP(secret, timeStep = 30, digits = 6) {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);

  // Encode counter as 8-byte big-endian buffer
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const hmac = await hmacSha1(keyBytes, buf);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
     (hmac[offset + 3] & 0xff)
  ) % (10 ** digits);

  return String(code).padStart(digits, '0');
}

/** Seconds remaining until the current TOTP period expires. */
export function getTOTPSecondsLeft(timeStep = 30) {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

/** Returns true if the secret looks like a valid Base32 string. */
export function isValidBase32(secret) {
  return /^[A-Z2-7\s=]+$/i.test(secret.trim()) && secret.trim().length >= 8;
}
