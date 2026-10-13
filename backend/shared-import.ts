// Re-export shared validation schemas for the backend
// This file bridges the shared validation module into the backend's import system

export {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  changePasswordSchema,
  onboardingSchema,
  emailSchema,
  passwordSchema,
  displayNameSchema,
} from '../shared/validation';
