"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const argon2_1 = __importDefault(require("argon2"));
const ARGON2_OPTIONS = {
    type: argon2_1.default.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 threads
};
/**
 * Hash a password using Argon2id.
 */
async function hashPassword(password) {
    return argon2_1.default.hash(password, ARGON2_OPTIONS);
}
/**
 * Verify a password against an Argon2id hash.
 */
async function verifyPassword(hash, password) {
    try {
        return await argon2_1.default.verify(hash, password);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=password.js.map