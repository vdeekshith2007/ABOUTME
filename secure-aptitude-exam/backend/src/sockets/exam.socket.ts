import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export function setupExamSockets(io: Server) {
  const examNamespace = io.of('/exam');

  examNamespace.use(async (socket, next) => {
    // Basic auth logic (should use same JWT logic as REST API in production)
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    next();
  });

  examNamespace.on('connection', (socket: Socket) => {
    logger.info(`Socket connected to exam namespace: ${socket.id}`);

    socket.on('join_exam', async (attemptId: string) => {
      socket.join(`exam_${attemptId}`);
      logger.info(`Socket ${socket.id} joined exam ${attemptId}`);
    });

    socket.on('heartbeat', async (data: { attemptId: string, timestamp: number }) => {
      // Record heartbeat to ensure student is still online
      examNamespace.to(`exam_${data.attemptId}`).emit('heartbeat_ack', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected from exam namespace: ${socket.id}`);
    });
  });
}
