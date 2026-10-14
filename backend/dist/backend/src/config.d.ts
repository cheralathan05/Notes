export declare function validateEnv(): void;
export declare const config: {
    readonly port: number;
    readonly nodeEnv: string;
    readonly isProduction: boolean;
    readonly databaseUrl: string;
    readonly sessionSecret: string;
    readonly sessionMaxAge: number;
    readonly appBaseUrl: string;
    readonly apiBaseUrl: string;
    readonly frontendUrl: string;
    readonly emailProvider: string;
    readonly emailFrom: string;
    readonly smtpService: string | undefined;
    readonly smtpHost: string;
    readonly smtpPort: number;
    readonly smtpSecure: boolean;
    readonly smtpUser: string;
    readonly smtpPass: string;
    readonly emailVerificationExpiry: number;
    readonly passwordResetExpiry: number;
    readonly resendCooldown: number;
    readonly corsOrigin: string;
};
//# sourceMappingURL=config.d.ts.map