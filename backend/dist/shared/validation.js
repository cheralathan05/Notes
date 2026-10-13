"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingSchema = exports.changePasswordSchema = exports.updateProfileSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = exports.displayNameSchema = exports.emailSchema = exports.passwordSchema = void 0;
exports.getPasswordStrength = getPasswordStrength;
const zod_1 = require("zod");
// ─── Password validation ────────────────────────────────────────────────────
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
exports.passwordSchema = zod_1.z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');
// ─── Email validation ────────────────────────────────────────────────────────
exports.emailSchema = zod_1.z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters')
    .transform((val) => val.toLowerCase().trim());
// ─── Display name validation ─────────────────────────────────────────────────
exports.displayNameSchema = zod_1.z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters')
    .trim();
// ─── Registration ────────────────────────────────────────────────────────────
exports.registerSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
    displayName: exports.displayNameSchema,
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
// ─── Login ───────────────────────────────────────────────────────────────────
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1, 'Password is required'),
});
// ─── Forgot password ────────────────────────────────────────────────────────
exports.forgotPasswordSchema = zod_1.z.object({
    email: exports.emailSchema,
});
// ─── Reset password ─────────────────────────────────────────────────────────
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
// ─── Verify email ────────────────────────────────────────────────────────────
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
});
// ─── Update profile ──────────────────────────────────────────────────────────
exports.updateProfileSchema = zod_1.z.object({
    displayName: exports.displayNameSchema.optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
});
// ─── Change password ─────────────────────────────────────────────────────────
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: exports.passwordSchema,
    confirmNewPassword: zod_1.z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
});
// ─── Onboarding ──────────────────────────────────────────────────────────────
exports.onboardingSchema = zod_1.z.object({
    displayName: exports.displayNameSchema,
    workspaceName: zod_1.z.string().min(1, 'Workspace name is required').max(100).trim().optional(),
});
// ─── Password strength utility ──────────────────────────────────────────────
function getPasswordStrength(password) {
    const checks = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
        { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
        { label: 'Contains a number', met: /[0-9]/.test(password) },
        { label: 'Contains special character', met: /[^a-zA-Z0-9]/.test(password) },
    ];
    const score = checks.filter((c) => c.met).length - 1;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    return {
        score: Math.max(0, score),
        label: labels[Math.max(0, score)] || 'Very Weak',
        checks,
    };
}
//# sourceMappingURL=validation.js.map