import { z } from 'zod';
export declare const passwordSchema: z.ZodString;
export declare const emailSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const displayNameSchema: z.ZodString;
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    displayName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
}, {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
}>, {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
}, {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export declare const verifyResetOtpSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    otp: string;
}, {
    email: string;
    otp: string;
}>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export declare const resetPasswordSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    password: string;
    confirmPassword: string;
}, {
    token: string;
    password: string;
    confirmPassword: string;
}>, {
    token: string;
    password: string;
    confirmPassword: string;
}, {
    token: string;
    password: string;
    confirmPassword: string;
}>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export declare const updateProfileSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    displayName?: string | undefined;
    avatarUrl?: string | null | undefined;
}, {
    displayName?: string | undefined;
    avatarUrl?: string | null | undefined;
}>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export declare const changePasswordSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmNewPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export declare const onboardingSchema: z.ZodObject<{
    displayName: z.ZodString;
    workspaceName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    displayName: string;
    workspaceName?: string | undefined;
}, {
    displayName: string;
    workspaceName?: string | undefined;
}>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
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
export declare function getPasswordStrength(password: string): {
    score: number;
    label: string;
    checks: {
        label: string;
        met: boolean;
    }[];
};
//# sourceMappingURL=validation.d.ts.map