export interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export interface EmailProvider {
    send(message: EmailMessage): Promise<void>;
}
export declare class SmtpEmailProvider implements EmailProvider {
    private transporter;
    private from;
    private serviceType;
    constructor();
    verify(): Promise<{
        success: boolean;
        message: string;
    }>;
    send(message: EmailMessage): Promise<void>;
}
export declare function resetEmailProvider(): void;
export declare function getEmailProvider(): EmailProvider;
export declare function buildVerificationEmail(verifyUrl: string): Omit<EmailMessage, 'to'>;
export declare function buildPasswordResetEmail(resetUrl: string, otp?: string): Omit<EmailMessage, 'to'>;
export declare function buildDocumentInvitationEmail(inviteUrl: string, inviterName: string, documentTitle: string, role: string, recipientEmail?: string, message?: string): Omit<EmailMessage, 'to'>;
export declare function buildWorkspaceInvitationEmail(inviteUrl: string, inviterName: string, workspaceName: string, role: string, message?: string): Omit<EmailMessage, 'to'>;
//# sourceMappingURL=email.d.ts.map