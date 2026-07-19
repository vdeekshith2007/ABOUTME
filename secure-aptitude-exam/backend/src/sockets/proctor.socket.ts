import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

export function setupProctorSockets(io: Server) {
  const proctorNamespace = io.of('/proctor');

  proctorNamespace.use((socket, next) => {
    // Only allow admins
    const role = socket.handshake.auth.role;
    if (role !== 'SUPER_ADMIN' && role !== 'EXAM_ADMIN') {
      return next(new Error('Unauthorized'));
    }
    next();
  });

  proctorNamespace.on('connection', (socket: Socket) => {
    logger.info(`Admin connected to proctor namespace: ${socket.id}`);

    socket.on('join_monitor', (testId: string) => {
      socket.join(`monitor_${testId}`);
      logger.info(`Admin ${socket.id} monitoring test ${testId}`);
    });

    // Receive live events from the exam service (via internal pub/sub or direct calls)
    // and broadcast them to connected admins
    socket.on('broadcast_proctor_event', (data) => {
       proctorNamespace.to(`monitor_${data.testId}`).emit('proctor_alert', data);
    });

    socket.on('disconnect', () => {
      logger.info(`Admin disconnected from proctor namespace: ${socket.id}`);
    });
  });
}
