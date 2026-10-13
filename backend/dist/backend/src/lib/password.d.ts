/**
 * Hash a password using Argon2id.
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify a password against an Argon2id hash.
 */
export declare function verifyPassword(hash: string, password: string): Promise<boolean>;
//# sourceMappingURL=password.d.ts.map