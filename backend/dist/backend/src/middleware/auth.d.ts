import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            sessionId?: string;
        }
    }
}
declare const SESSION_COOKIE_NAME = "session_token";
/**
 * Extract session from cookie, validate against DB, attach user to request.
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional auth - attaches user if session exists but doesn't block.
 */
export declare function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
/**
 * Set session cookie on the response.
 */
export declare function setSessionCookie(res: Response, token: string): void;
/**
 * Clear session cookie.
 */
export declare function clearSessionCookie(res: Response): void;
export { SESSION_COOKIE_NAME };
//# sourceMappingURL=auth.d.ts.map