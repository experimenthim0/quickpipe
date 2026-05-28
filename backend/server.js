import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/linksetu';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enable Middlewares for Production Security and Logging
app.use(helmet()); // Sets protective security HTTP headers
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev')); // Combined for prod, short for dev
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Device-Name', 'X-Device-Type']
}));
app.use(express.json({ limit: '10kb' })); // Restrict payload size (protection against DOS)

// Request timeout middleware (30 seconds max per request)
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// API Rate Limiting Configuration — 10 requests per 30-minute window
const apiLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // Limit each IP to 10 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests from this IP, please try again after 30 minutes.' }
});

// Auth specific rate limiter (prevent OTP brute-force/spam)
const authLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3, // Limit each IP to 3 OTP requests per window (strict for auth)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 30 minutes.' }
});

// Apply rate limiting routes
app.use('/api/', apiLimiter);
app.use('/api/auth/request-otp', authLimiter);

// Database connection with retry logic
const connectWithRetry = () => {
  console.log('[QuickPipe] Connecting to MongoDB...');
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000
  })
    .then(() => console.log('[QuickPipe] MongoDB successfully connected.'))
    .catch((err) => {
      console.error('[QuickPipe] MongoDB connection failure:', err.message);
      console.log('[QuickPipe] Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Monitor for connection drops after initial connect
mongoose.connection.on('disconnected', () => {
  console.warn('[QuickPipe] MongoDB connection lost. Attempting reconnection...');
});

mongoose.connection.on('error', (err) => {
  console.error('[QuickPipe] MongoDB connection error:', err.message);
});

// Welcome / Healthcheck Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'QuickPipe API Server',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    time: new Date()
  });
});

// Import API Routing
import authRoutes from './routes/auth.js';
import linkRoutes from './routes/links.js';

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);

// Error Handling Middleware for Unmatched Routes (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler — catches unhandled errors from route handlers
app.use((err, req, res, _next) => {
  console.error('[QuickPipe] Unhandled route error:', err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start listening for inbound traffic
const server = app.listen(PORT, () => {
  console.log(`======================================================`);
  console.log(`🚀 QuickPipe API server listening on port: ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
  console.log(`📦 Environment: ${NODE_ENV}`);
  console.log(`======================================================`);
});

// Graceful termination handler (ensure database connection and server socket close cleanly)
const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] Shutdown signal received. Closing resources...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close()
      .then(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during MongoDB connection close:', err);
        process.exit(1);
      });
  });
  
  // Timeout fallback to force shutdown
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled promise rejections (prevents silent failures)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[QuickPipe] Unhandled Promise Rejection:', reason);
});

// Catch uncaught exceptions (logs then exits to avoid zombie state)
process.on('uncaughtException', (err) => {
  console.error('[QuickPipe] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
