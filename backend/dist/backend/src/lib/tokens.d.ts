/**
 * Generate a cryptographically secure random token.
 * Returns both the raw token (to send to user) and the hash (to store in DB).
 */
export declare function generateToken(): {
    raw: string;
    hash: string;
};
/**
 * Hash a token using SHA-256 for storage.
 * We never store raw tokens in the database.
 */
export declare function hashToken(token: string): string;
/**
 * Generate a secure session token.
 */
export declare function generateSessionToken(): {
    raw: string;
    hash: string;
};
//# sourceMappingURL=tokens.d.ts.map