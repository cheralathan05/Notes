"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
// Validate environment before starting
(0, config_1.validateEnv)();
const app = (0, express_1.default)();
// ─── Security middleware ─────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // CSP handled by frontend
}));
app.use((0, cors_1.default)({
    origin: config_1.config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);
// ─── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    },
});
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
// ─── Routes ──────────────────────────────────────────────────────────────────
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Auth routes with rate limiting
app.use('/api/auth', authLimiter, auth_1.default);
// User routes
app.use('/api/user', generalLimiter, user_1.default);
// ─── Error handling ──────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
});
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
});
// ─── Start server ────────────────────────────────────────────────────────────
app.listen(config_1.config.port, () => {
    console.log(`\n🚀 Backend server running on http://localhost:${config_1.config.port}`);
    console.log(`   Environment: ${config_1.config.nodeEnv}`);
    console.log(`   Frontend URL: ${config_1.config.frontendUrl}`);
    console.log(`   Email Provider: ${config_1.config.emailProvider}\n`);
});
exports.default = app;
//# sourceMappingURL=index.js.map