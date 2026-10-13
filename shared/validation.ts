import { z } from 'zod';

// ─── Password validation ────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// ─── Email validation ────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be at most 255 characters')
  .transform((val) => val.toLowerCase().trim());

// ─── Display name validation ─────────────────────────────────────────────────

export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(100, 'Display name must be at most 100 characters')
  .trim();

// ─── Registration ────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  displayName: displayNameSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Forgot password ────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Verify reset OTP ────────────────────────────────────────────────────────

export const verifyResetOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'Verification code must be exactly 6 digits').regex(/^\d{6}$/, 'Verification code must contain only digits'),
});

export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;

// ─── Reset password ─────────────────────────────────────────────────────────

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Verify email ────────────────────────────────────────────────────────────

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ─── Update profile ──────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Change password ─────────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── Onboarding ──────────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  workspaceName: z.string().min(1, 'Workspace name is required').max(100).trim().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ─── API Response types ──────────────────────────────────────────────────────

export interface ApiResponse<T = undefined> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface WorkspacePublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
}

// ─── Password strength utility ──────────────────────────────────────────────

export function getPasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  checks: { label: string; met: boolean }[];
} {
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
