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
const documents_1 = __importDefault(require("./routes/documents"));
const folders_1 = __importDefault(require("./routes/folders"));
const revisions_1 = __importDefault(require("./routes/revisions"));
const templates_1 = __importDefault(require("./routes/templates"));
const attachments_1 = __importDefault(require("./routes/attachments"));
const search_1 = __importDefault(require("./routes/search"));
const ai_1 = __importDefault(require("./routes/ai"));
const collaboration_1 = __importDefault(require("./routes/collaboration"));
const export_import_1 = __importDefault(require("./routes/export-import"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const projects_1 = __importDefault(require("./routes/projects"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const focus_1 = __importDefault(require("./routes/focus"));
const goals_1 = __importDefault(require("./routes/goals"));
const automations_1 = __importDefault(require("./routes/automations"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const developer_1 = __importDefault(require("./routes/developer"));
const repositories_1 = __importDefault(require("./routes/repositories"));
const task_evidence_1 = __importDefault(require("./routes/task-evidence"));
const ai_developer_1 = __importDefault(require("./routes/ai-developer"));
// Validate environment before starting
(0, config_1.validateEnv)();
const app = (0, express_1.default)();
// ─── Security middleware ─────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // CSP handled by frontend
}));
const allowedOrigins = (config_1.config.corsOrigin || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || !config_1.config.isProduction) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-atlas-token'],
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
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
    max: 200,
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
// Documents Platform routes
app.use('/api/documents', generalLimiter, export_import_1.default);
app.use('/api/documents', generalLimiter, revisions_1.default);
app.use('/api/documents', generalLimiter, attachments_1.default);
app.use('/api/documents', generalLimiter, documents_1.default);
app.use('/api/documents', generalLimiter, collaboration_1.default);
app.use('/api/folders', generalLimiter, folders_1.default);
app.use('/api/templates', generalLimiter, templates_1.default);
app.use('/api/attachments', generalLimiter, attachments_1.default);
app.use('/api/search', generalLimiter, search_1.default);
app.use('/api/ai', generalLimiter, ai_1.default);
app.use('/api/tasks', generalLimiter, tasks_1.default);
app.use('/api/projects', generalLimiter, projects_1.default);
app.use('/api/notifications', generalLimiter, notifications_1.default);
app.use('/api/focus', generalLimiter, focus_1.default);
app.use('/api/goals', generalLimiter, goals_1.default);
app.use('/api/automations', generalLimiter, automations_1.default);
app.use('/api/analytics', generalLimiter, analytics_1.default);
app.use('/api/developer', generalLimiter, developer_1.default);
app.use('/api/repositories', generalLimiter, repositories_1.default);
app.use('/api/tasks', generalLimiter, task_evidence_1.default);
app.use('/api/ai', generalLimiter, ai_developer_1.default);
app.use('/api', generalLimiter, collaboration_1.default); // Public share endpoint: /api/public/documents/:token
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