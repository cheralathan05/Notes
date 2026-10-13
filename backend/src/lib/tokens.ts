import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token.
 * Returns both the raw token (to send to user) and the hash (to store in DB).
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * Hash a token using SHA-256 for storage.
 * We never store raw tokens in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure session token.
 */
export function generateSessionToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}
