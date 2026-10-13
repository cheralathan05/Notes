"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.hashToken = hashToken;
exports.generateSessionToken = generateSessionToken;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a cryptographically secure random token.
 * Returns both the raw token (to send to user) and the hash (to store in DB).
 */
function generateToken() {
    const raw = crypto_1.default.randomBytes(32).toString('hex');
    const hash = hashToken(raw);
    return { raw, hash };
}
/**
 * Hash a token using SHA-256 for storage.
 * We never store raw tokens in the database.
 */
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
/**
 * Generate a secure session token.
 */
function generateSessionToken() {
    const raw = crypto_1.default.randomBytes(48).toString('base64url');
    const hash = hashToken(raw);
    return { raw, hash };
}
//# sourceMappingURL=tokens.js.map