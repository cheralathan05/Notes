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
const reviews_1 = __importDefault(require("./routes/reviews"));
const integrations_1 = __importDefault(require("./routes/integrations"));
const chat_1 = __importDefault(require("./routes/chat"));
const canvases_1 = __importDefault(require("./routes/canvases"));
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
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, '');
        const cleanHost = cleanOrigin.replace(/^https?:\/\//, '');
        const isAllowed = !config_1.config.isProduction ||
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(cleanOrigin) ||
            allowedOrigins.some((ao) => {
                const aoHost = ao.replace(/^https?:\/\//, '');
                return cleanOrigin === ao || cleanHost === aoHost || cleanOrigin === `https://${aoHost}` || cleanOrigin === `http://${aoHost}`;
            }) ||
            cleanOrigin.endsWith('.onrender.com') ||
            cleanOrigin.includes('localhost') ||
            cleanOrigin.includes('127.0.0.1');
        if (isAllowed) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    exposedHeaders: ['set-cookie', 'x-workspace-id'],
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);
// ─── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config_1.config.isProduction ? 20 : 10000, // Generous in development/testing
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    },
});
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: config_1.config.isProduction ? 200 : 50000,
    standardHeaders: true,
    legacyHeaders: false,
});
// ─── Routes ──────────────────────────────────────────────────────────────────
// Root endpoint for platform health checks
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'kronos-backend', version: '1.0.0' });
});
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
app.use('/api/collaboration', generalLimiter, collaboration_1.default);
app.use('/api/reviews', generalLimiter, reviews_1.default);
app.use('/api/integrations', generalLimiter, integrations_1.default);
app.use('/api/chat', generalLimiter, chat_1.default);
app.use('/api/canvases', generalLimiter, canvases_1.default);
app.use('/api', generalLimiter, collaboration_1.default); // Public share & collaboration endpoints
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
// ─── Dev Port Forwarder (Port 3000 -> 3001) ──────────────────────────────────
if (!config_1.config.isProduction) {
    try {
        const redirectApp = (0, express_1.default)();
        redirectApp.use((req, res) => {
            const target = `http://localhost:3001${req.originalUrl}`;
            res.setHeader('Clear-Site-Data', '"cache", "storage"');
            res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${target}">
  <title>Redirecting to KRONOS...</title>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (var r of registrations) { r.unregister(); }
      });
    }
    window.location.replace("${target}");
  </script>
</head>
<body style="background:#080808;color:#a3a3a3;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <p style="color:#fff;font-size:14px;letter-spacing:1px;">REDIRECTING TO KRONOS (PORT 3001)...</p>
    <a href="${target}" style="color:#737373;font-size:12px;">Click here if not redirected automatically</a>
  </div>
</body>
</html>`);
        });
        const redirectServer = redirectApp.listen(3000, () => {
            console.log('🔄 Dev port forwarder active: http://localhost:3000 -> http://localhost:3001');
        });
        redirectServer.on('error', (err) => {
            console.log('ℹ️ Port 3000 redirector inactive:', err.message);
        });
    }
    catch (e) {
        // Graceful fallback
    }
}
exports.default = app;
//# sourceMappingURL=index.js.map