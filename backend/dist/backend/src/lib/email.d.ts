export interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export interface EmailProvider {
    send(message: EmailMessage): Promise<void>;
}
export declare function getEmailProvider(): EmailProvider;
export declare function buildVerificationEmail(verifyUrl: string): Omit<EmailMessage, 'to'>;
export declare function buildPasswordResetEmail(resetUrl: string): Omit<EmailMessage, 'to'>;
//# sourceMappingURL=email.d.ts.map