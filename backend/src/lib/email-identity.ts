/**
 * KRONOS — Unified Email Normalization & Identity Verification
 * 
 * Standardizes email normalization across registration, login, token issuance,
 * and invitation acceptance to eliminate false Authentication Mismatches.
 */

// Zero-width characters, non-breaking spaces, and unicode whitespace regex
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const UNICODE_SPACES_REGEX = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;

/**
 * Standardizes an email for database storage and lookups.
 * - Strips zero-width characters and invisible unicode marks
 * - Converts unicode spaces to ASCII spaces and trims
 * - Lowercases domain and local-part
 * - Normalizes googlemail.com to gmail.com
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';

  const cleaned = email
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(UNICODE_SPACES_REGEX, ' ')
    .trim()
    .toLowerCase();

  const atIndex = cleaned.lastIndexOf('@');
  if (atIndex === -1) return cleaned;

  let local = cleaned.substring(0, atIndex).trim();
  let domain = cleaned.substring(atIndex + 1).trim();

  // Normalize googlemail.com to gmail.com
  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}

/**
 * Checks if a domain is Gmail or commonly known to use Gmail/Google Workspace dot-insensitivity.
 */
export function isGmailDomain(domain: string): boolean {
  const d = domain.toLowerCase().trim();
  return d === 'gmail.com' || d === 'googlemail.com';
}

/**
 * Canonicalizes an email address for identity matching comparison.
 * - Strips dots in local-part for Gmail / Google Workspace addresses
 * - Strips subaddressing / plus-tags (e.g. user+tag@domain.com -> user@domain.com) for matching
 */
export function canonicalizeEmailForMatch(email: string | null | undefined): string {
  const norm = normalizeEmail(email);
  if (!norm) return '';

  const atIndex = norm.lastIndexOf('@');
  if (atIndex === -1) return norm;

  let local = norm.substring(0, atIndex);
  const domain = norm.substring(atIndex + 1);

  // Strip plus-addressing tag
  const plusIndex = local.indexOf('+');
  if (plusIndex !== -1) {
    local = local.substring(0, plusIndex);
  }

  // Strip dots for Gmail or if comparing institutional accounts that disregard dots
  if (isGmailDomain(domain)) {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Compares two email addresses with high-fidelity identity verification.
 * Returns true if the two email identities match, accounting for:
 * 1. Exact match after trimming and zero-width stripping
 * 2. Case-insensitive match
 * 3. Dot-agnostic match (e.g. john.doe@... vs johndoe@...)
 * 4. Plus-tag subaddressing (e.g. user+tag@... vs user@...)
 */
export function areEmailsMatching(
  emailA: string | null | undefined,
  emailB: string | null | undefined
): boolean {
  if (!emailA || !emailB) return false;

  const normA = normalizeEmail(emailA);
  const normB = normalizeEmail(emailB);

  // 1. Direct normalized equality
  if (normA === normB) return true;

  // 2. Canonicalized identity comparison (handles Gmail / Google Workspace aliases & dots)
  const canonA = canonicalizeEmailForMatch(normA);
  const canonB = canonicalizeEmailForMatch(normB);
  if (canonA === canonB) return true;

  // 3. Permissive dot-comparison across institutional Google domains:
  // If domains match exactly, check if stripping dots matches
  const atA = normA.lastIndexOf('@');
  const atB = normB.lastIndexOf('@');
  if (atA !== -1 && atB !== -1) {
    const localA = normA.substring(0, atA);
    const domainA = normA.substring(atA + 1);
    const localB = normB.substring(0, atB);
    const domainB = normB.substring(atB + 1);

    if (domainA === domainB) {
      const dotlessA = localA.replace(/\./g, '');
      const dotlessB = localB.replace(/\./g, '');
      if (dotlessA === dotlessB) return true;

      // Also check subaddressing without dots
      const baseA = localA.split('+')[0].replace(/\./g, '');
      const baseB = localB.split('+')[0].replace(/\./g, '');
      if (baseA === baseB) return true;
    }
  }

  return false;
}
