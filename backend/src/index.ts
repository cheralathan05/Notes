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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || !config.isProduction) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-atlas-token'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// ─── Rate limiting ───────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

const generalLimiter = rateLimit({
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
app.use('/api', generalLimiter, collaborationRoutes); // Public share endpoint: /api/public/documents/:token


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

export default app;
