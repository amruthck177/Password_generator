// src/utils/hibp.js

/**
 * Checks a password against the Have I Been Pwned k-anonymity API.
 * Returns the number of times the password was found in breaches (0 if safe).
 */
export async function checkPasswordBreach(password) {
  if (!password) return 0;

  // Compute SHA-1 hash
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      throw new Error('Failed to fetch from HIBP API');
    }
    const text = await response.text();
    
    // Response format: SUFFIX:COUNT
    const lines = text.split('\n');
    for (const line of lines) {
      const [lineSuffix, countStr] = line.split(':');
      if (lineSuffix.trim() === suffix) {
        return parseInt(countStr.trim(), 10);
      }
    }
    
    return 0; // Not found
  } catch (error) {
    console.error('Breach check failed:', error);
    return -1; // Indicate error state (could not verify)
  }
}
