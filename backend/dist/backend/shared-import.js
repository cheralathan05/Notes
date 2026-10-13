"use strict";
// Re-export shared validation schemas for the backend
// This file bridges the shared validation module into the backend's import system
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayNameSchema = exports.passwordSchema = exports.emailSchema = exports.onboardingSchema = exports.changePasswordSchema = exports.updateProfileSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
var validation_1 = require("../shared/validation");
Object.defineProperty(exports, "registerSchema", { enumerable: true, get: function () { return validation_1.registerSchema; } });
Object.defineProperty(exports, "loginSchema", { enumerable: true, get: function () { return validation_1.loginSchema; } });
Object.defineProperty(exports, "forgotPasswordSchema", { enumerable: true, get: function () { return validation_1.forgotPasswordSchema; } });
Object.defineProperty(exports, "resetPasswordSchema", { enumerable: true, get: function () { return validation_1.resetPasswordSchema; } });
Object.defineProperty(exports, "verifyEmailSchema", { enumerable: true, get: function () { return validation_1.verifyEmailSchema; } });
Object.defineProperty(exports, "updateProfileSchema", { enumerable: true, get: function () { return validation_1.updateProfileSchema; } });
Object.defineProperty(exports, "changePasswordSchema", { enumerable: true, get: function () { return validation_1.changePasswordSchema; } });
Object.defineProperty(exports, "onboardingSchema", { enumerable: true, get: function () { return validation_1.onboardingSchema; } });
Object.defineProperty(exports, "emailSchema", { enumerable: true, get: function () { return validation_1.emailSchema; } });
Object.defineProperty(exports, "passwordSchema", { enumerable: true, get: function () { return validation_1.passwordSchema; } });
Object.defineProperty(exports, "displayNameSchema", { enumerable: true, get: function () { return validation_1.displayNameSchema; } });
//# sourceMappingURL=shared-import.js.map