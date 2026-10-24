import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, validateEnv } from './config';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import documentRoutes from './routes/documents';
import folderRoutes from './routes/folders';
import revisionRoutes from './routes/revisions';
import templateRoutes from './routes/templates';
import attachmentRoutes from './routes/attachments';
import searchRoutes from './routes/search';
import aiRoutes from './routes/ai';
import collaborationRoutes from './routes/collaboration';
import exportImportRoutes from './routes/export-import';
import taskRoutes from './routes/tasks';
import projectRoutes from './routes/projects';
import notificationsRoutes from './routes/notifications';
import focusRoutes from './routes/focus';
import goalsRoutes from './routes/goals';
import automationsRoutes from './routes/automations';
import analyticsRoutes from './routes/analytics';
import developerRoutes from './routes/developer';
import repositoriesRoutes from './routes/repositories';
import taskEvidenceRoutes from './routes/task-evidence';
import aiDeveloperRoutes from './routes/ai-developer';
import reviewsRoutes from './routes/reviews';
import integrationsRoutes from './routes/integrations';
import chatRoutes from './routes/chat';
import canvasesRoutes from './routes/canvases';

// Validate environment before starting
validateEnv();

const app = express();

// ─── Security middleware ─────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by frontend
}));

const allowedOrigins = (config.corsOrigin || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''));

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '');
    const cleanHost = cleanOrigin.replace(/^https?:\/\//, '');

    const isAllowed =
      !config.isProduction ||
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

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// ─── Rate limiting ───────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 20 : 10000, // Generous in development/testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 200 : 50000,
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
app.use('/api/auth', authLimiter, authRoutes);

// User routes
app.use('/api/user', generalLimiter, userRoutes);

// Documents Platform routes
app.use('/api/documents', generalLimiter, exportImportRoutes);
app.use('/api/documents', generalLimiter, revisionRoutes);
app.use('/api/documents', generalLimiter, attachmentRoutes);
app.use('/api/documents', generalLimiter, documentRoutes);
app.use('/api/documents', generalLimiter, collaborationRoutes);
app.use('/api/folders', generalLimiter, folderRoutes);
app.use('/api/templates', generalLimiter, templateRoutes);
app.use('/api/attachments', generalLimiter, attachmentRoutes);
app.use('/api/search', generalLimiter, searchRoutes);
app.use('/api/ai', generalLimiter, aiRoutes);
app.use('/api/tasks', generalLimiter, taskRoutes);
app.use('/api/projects', generalLimiter, projectRoutes);
app.use('/api/notifications', generalLimiter, notificationsRoutes);
app.use('/api/focus', generalLimiter, focusRoutes);
app.use('/api/goals', generalLimiter, goalsRoutes);
app.use('/api/automations', generalLimiter, automationsRoutes);
app.use('/api/analytics', generalLimiter, analyticsRoutes);
app.use('/api/developer', generalLimiter, developerRoutes);
app.use('/api/repositories', generalLimiter, repositoriesRoutes);
app.use('/api/tasks', generalLimiter, taskEvidenceRoutes);
app.use('/api/ai', generalLimiter, aiDeveloperRoutes);
app.use('/api/collaboration', generalLimiter, collaborationRoutes);
app.use('/api/reviews', generalLimiter, reviewsRoutes);
app.use('/api/integrations', generalLimiter, integrationsRoutes);
app.use('/api/chat', generalLimiter, chatRoutes);
app.use('/api/canvases', generalLimiter, canvasesRoutes);
app.use('/api', generalLimiter, collaborationRoutes); // Public share & collaboration endpoints


// ─── Error handling ──────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  });
});

// ─── Start server ────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`\n🚀 Backend server running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Frontend URL: ${config.frontendUrl}`);
  console.log(`   Email Provider: ${config.emailProvider}\n`);
});

// ─── Dev Port Forwarder (Port 3000 -> 3001) ──────────────────────────────────
if (!config.isProduction) {
  try {
    const redirectApp = express();
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
    redirectServer.on('error', (err: any) => {
      console.log('ℹ️ Port 3000 redirector inactive:', err.message);
    });
  } catch (e) {
    // Graceful fallback
  }
}

export default app;
