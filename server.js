const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { syncDatabase } = require('./models');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// Rate limiting - disabled in development, enabled in production
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    }
  });
  app.use(limiter);
  console.log('Rate limiting enabled for production');
} else {
  console.log('Rate limiting disabled in development mode');
}

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.length === 0) {
        // If FRONTEND_URL is not set, allow all origins (not recommended for production)
        console.warn('WARNING: FRONTEND_URL not set in production. Allowing all origins.');
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Debug: Log all registered routes on startup
const logRoutes = () => {
  console.log('\n=== Registered API Routes ===');
  console.log('Auth Routes:');
  console.log('  POST   /api/auth/login');
  console.log('  POST   /api/auth/register');
  console.log('  GET    /api/auth/profile');
  console.log('  GET    /api/auth/users');
  console.log('  DELETE /api/auth/users/:userId');
  console.log('\nFile Routes:');
  console.log('  POST   /api/files/upload');
  console.log('  GET    /api/files/my-files');
  console.log('  GET    /api/files/all-files');
  console.log('  GET    /api/files/download/:fileId');
  console.log('  DELETE /api/files/delete/:fileId');
  console.log('  POST   /api/files/create-folder');
  console.log('  GET    /api/files/my-folders');
  console.log('  GET    /api/files/all-folders');
  console.log('=============================\n');
};

logRoutes();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rate limit status endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/rate-limit-status', (req, res) => {
    const rateLimitInfo = req.rateLimit;
    res.json({
      limit: rateLimitInfo?.limit || 'Not available',
      remaining: rateLimitInfo?.remaining || 'Not available',
      resetTime: rateLimitInfo?.resetTime || 'Not available',
      windowMs: '15 minutes',
      max: process.env.NODE_ENV === 'production' ? 100 : 1000
    });
  });

  // Route info endpoint (development only)
  app.get('/api/route-info', (req, res) => {
    res.json({
      routes: {
        auth: {
          'POST /login': 'User login',
          'POST /register': 'Register new user (admin only)',
          'GET /profile': 'Get current user profile',
          'GET /users': 'Get all users (admin only)',
          'DELETE /users/:userId': 'Delete user (admin only)'
        }
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - must be last
app.use('*', (req, res) => {
  console.log('=== 404 - Route not found ===');
  console.log('Method:', req.method);
  console.log('Original URL:', req.originalUrl);
  console.log('Path:', req.path);
  console.log('Base URL:', req.baseUrl);
  console.log('===========================');
  res.status(404).json({
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await testConnection();
    await syncDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
