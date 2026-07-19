import { Request, Response } from 'express';
import { prisma } from '../config/database';
import * as examService from '../services/exam.service';
import * as certificateService from '../services/certificate.service';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { ProctorEventType } from '@prisma/client';

// POST /api/exam/:testId/start
export async function startExam(req: Request, res: Response) {
  const result = await examService.startExam(
    req.user!.userId,
    req.params.testId,
    (req.ip || '') as string,
    { userAgent: (req.headers['user-agent'] || '') as string, ...req.body.deviceInfo }
  );
  res.json({ success: true, data: result });
}

// POST /api/exam/:attemptId/answer
export async function saveAnswer(req: Request, res: Response) {
  const { questionId, selectedOptions, timeTaken } = req.body;
  const result = await examService.saveAnswer(req.params.attemptId, req.user!.userId, questionId, selectedOptions, timeTaken);
  res.json({ success: true, data: result });
}

// POST /api/exam/:attemptId/submit
export async function submitExam(req: Request, res: Response) {
  const result = await examService.submitExam(req.params.attemptId, req.user!.userId);
  res.json({ success: true, data: result });
}

// GET /api/exam/:attemptId/result
export async function getResult(req: Request, res: Response) {
  const result = await examService.getAttemptResult(req.params.attemptId, req.user!.userId);
  res.json({ success: true, data: result });
}

// POST /api/exam/:attemptId/proctor-event
export async function logProctorEvent(req: Request, res: Response) {
  const { eventType, description, metadata } = req.body;
  const result = await examService.logProctorEvent(
    req.params.attemptId,
    eventType as ProctorEventType,
    description,
    metadata
  );
  res.json({ success: true, data: result });
}

// GET /api/exam/:attemptId/certificate
export async function getCertificate(req: Request, res: Response) {
  const attempt = await prisma.attempt.findUnique({ where: { id: req.params.attemptId } });
  if (!attempt || attempt.userId !== req.user!.userId) throw new ForbiddenError();
  const pdfUrl = await certificateService.generateCertificate(req.params.attemptId);
  res.json({ success: true, data: { pdfUrl } });
}

// GET /api/exam/verify/:certNumber
export async function verifyCertificate(req: Request, res: Response) {
  const result = await certificateService.verifyCertificate(req.params.certNumber);
  res.json({ success: true, data: result });
}

// GET /api/exam/available
export async function getAvailableTests(req: Request, res: Response) {
  const tests = await prisma.test.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true, title: true, description: true, duration: true, totalMarks: true,
      passingMarks: true, negativeMarking: true, maxAttempts: true, scheduledAt: true, endsAt: true,
      sections: {
        select: { _count: { select: { questions: true } }, title: true },
      },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ success: true, data: tests });
}

// GET /api/exam/my-attempts
export async function getMyAttempts(req: Request, res: Response) {
  const attempts = await prisma.attempt.findMany({
    where: { userId: req.user!.userId },
    include: {
      test: { select: { title: true, totalMarks: true } },
      certificate: { select: { certNumber: true, pdfUrl: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ success: true, data: attempts });
}
