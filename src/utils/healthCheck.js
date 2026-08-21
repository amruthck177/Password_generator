// src/utils/healthCheck.js
import zxcvbn from 'zxcvbn';

// Age thresholds in days
export const AGE_FRESH  = 30;   // < 30 days  → green
export const AGE_WARN   = 90;   // 30–90 days → amber
                                 // > 90 days  → red (stale)

/** Returns age in days from a createdAt ISO string. */
export function getAgeDays(createdAt) {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns { color, label } for a password age in days. */
export function getAgeStatus(days) {
  if (days === null) return { color: 'text-zinc-600', label: 'Unknown age' };
  if (days < AGE_FRESH)  return { color: 'text-emerald-400', label: `${days}d old` };
  if (days < AGE_WARN)   return { color: 'text-amber-400',   label: `${days}d old` };
  return { color: 'text-red-400', label: `${days}d old — rotate!` };
}

/**
 * Analyzes the in-memory decrypted vault and returns a health report.
 * @param {Array} vault - Decrypted vault entries
 * @returns {Object} report with score, weakEntries, duplicateGroups, staleEntries, summary
 */
export function analyzeVault(vault) {
  // Only analyze password-type entries — notes don't have passwords
  const passwords = vault.filter(e => !e.type || e.type === 'password');

  if (!passwords || passwords.length === 0) {
    return {
      score: 100,
      weakEntries: [],
      duplicateGroups: [],
      staleEntries: [],
      totalIssues: 0,
      totalEntries: 0,
    };
  }

  // --- Weak password detection ---
  const weakEntries = [];
  for (const entry of passwords) {
    const result = zxcvbn(entry.password || '');
    if (result.score <= 2) {
      weakEntries.push({
        ...entry,
        strengthScore: result.score,
        crackTime: result.crack_times_display.offline_fast_hashing_1e10_per_second,
      });
    }
  }

  // --- Duplicate password detection ---
  const passwordMap = {};
  for (const entry of passwords) {
    const pw = entry.password || '';
    if (!passwordMap[pw]) passwordMap[pw] = [];
    passwordMap[pw].push(entry);
  }
  const duplicateGroups = Object.values(passwordMap).filter(group => group.length > 1);
  const duplicateIds = new Set(duplicateGroups.flat().map(e => e.id));

  // --- Stale password detection (>90 days) ---
  const staleEntries = passwords.filter(e => {
    const days = getAgeDays(e.createdAt);
    return days !== null && days >= AGE_WARN;
  }).map(e => ({ ...e, ageDays: getAgeDays(e.createdAt) }));

  // --- Health score calculation ---
  const totalEntries = passwords.length;
  const weakPenalty  = weakEntries.length   > 0 ? Math.min(30, Math.round((weakEntries.length   / totalEntries) * 30)) : 0;
  const dupePenalty  = duplicateIds.size    > 0 ? Math.min(30, Math.round((duplicateIds.size    / totalEntries) * 30)) : 0;
  const stalePenalty = staleEntries.length  > 0 ? Math.min(20, Math.round((staleEntries.length  / totalEntries) * 20)) : 0;
  const score = Math.max(0, 100 - weakPenalty - dupePenalty - stalePenalty);

  const totalIssues = weakEntries.length + duplicateIds.size + staleEntries.length;

  return {
    score,
    weakEntries,
    duplicateGroups,
    duplicateIds,
    staleEntries,
    totalIssues,
    totalEntries,
  };
}

/** Returns color string based on health score. */
export function getScoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

/** Returns a label for the health score. */
export function getScoreLabel(score) {
  if (score >= 80) return 'Great';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}
