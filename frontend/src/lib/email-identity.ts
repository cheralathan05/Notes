/**
 * KRONOS — Frontend Email Normalization & Identity Verification
 * 
 * Ensures the client evaluates identity matching consistently with the backend,
 * preventing false "Authentication Mismatch" UI warnings.
 */

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const UNICODE_SPACES_REGEX = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;

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

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}

export function canonicalizeEmailForMatch(email: string | null | undefined): string {
  const norm = normalizeEmail(email);
  if (!norm) return '';

  const atIndex = norm.lastIndexOf('@');
  if (atIndex === -1) return norm;

  let local = norm.substring(0, atIndex);
  const domain = norm.substring(atIndex + 1);

  const plusIndex = local.indexOf('+');
  if (plusIndex !== -1) {
    local = local.substring(0, plusIndex);
  }

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

export function areEmailsMatching(
  emailA: string | null | undefined,
  emailB: string | null | undefined
): boolean {
  if (!emailA || !emailB) return false;

  const normA = normalizeEmail(emailA);
  const normB = normalizeEmail(emailB);

  if (normA === normB) return true;

  const canonA = canonicalizeEmailForMatch(normA);
  const canonB = canonicalizeEmailForMatch(normB);
  if (canonA === canonB) return true;

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

      const baseA = localA.split('+')[0].replace(/\./g, '');
      const baseB = localB.split('+')[0].replace(/\./g, '');
      if (baseA === baseB) return true;
    }
  }

  return false;
}
