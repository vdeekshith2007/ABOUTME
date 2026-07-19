import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';

import { env } from './config/env';
import { connectDatabase } from './config/database';
import { errorHandler, NotFoundError } from './utils/errors';
import { logger } from './utils/logger';
import { generalLimiter } from './middleware/rateLimit.middleware';

import authRoutes from './routes/auth.routes';
// import adminRoutes from './routes/admin.routes';
// import examRoutes from './routes/exam.routes';
import { setupExamSockets } from './sockets/exam.socket';
import { setupProctorSockets } from './sockets/proctor.socket';

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupExamSockets(io);
setupProctorSockets(io);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/exam', examRoutes);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// 404 Handler
app.use('*', (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Global Error Handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDatabase();
    server.listen(parseInt(env.PORT, 10), () => {
      logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app, server, io };
