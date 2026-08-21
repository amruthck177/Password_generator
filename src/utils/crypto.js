// src/utils/crypto.js

const ITERATIONS = 100000;
const HASH_ALGO = 'SHA-256';
const KEY_LENGTH = 256;

// Convert string to ArrayBuffer
const strToBuffer = (str) => new TextEncoder().encode(str);
// Convert ArrayBuffer to Base64
const bufferToBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
// Convert Base64 to ArrayBuffer
const base64ToBuffer = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/**
 * Derives an AES-GCM crypto key from a master password and a salt.
 */
export async function deriveKey(masterPassword, saltBase64) {
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    strToBuffer(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = saltBase64 ? base64ToBuffer(saltBase64) : window.crypto.getRandomValues(new Uint8Array(16));
  const newSaltBase64 = bufferToBase64(saltBuffer);

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: HASH_ALGO
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return { key: aesKey, salt: newSaltBase64 };
}

/**
 * Encrypts an object (stringified) using AES-GCM.
 * Returns the base64 ciphertext and the base64 IV.
 */
export async function encryptData(dataObject, cryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encodedData = strToBuffer(JSON.stringify(dataObject));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts a base64 ciphertext using the provided IV and crypto key.
 * Returns the parsed object.
 */
export async function decryptData(ciphertextB64, ivB64, cryptoKey) {
  const encryptedBuffer = base64ToBuffer(ciphertextB64);
  const ivBuffer = base64ToBuffer(ivB64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    cryptoKey,
    encryptedBuffer
  );

  const decryptedString = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decryptedString);
}
