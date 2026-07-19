import { Request, Response } from 'express';
import { prisma } from '../config/database';
import * as analyticsService from '../services/analytics.service';
import * as aiService from '../services/ai.service';
import { NotFoundError } from '../utils/errors';

// GET /api/admin/dashboard/stats
export async function getDashboardStats(req: Request, res: Response) {
  const [users, tests, attempts, activeSessions] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.test.count(),
    prisma.attempt.count(),
    prisma.attempt.count({ where: { status: 'IN_PROGRESS' } }),
  ]);

  const recentAttempts = await prisma.attempt.findMany({
    take: 10,
    orderBy: { startedAt: 'desc' },
    include: { user: { select: { firstName: true, lastName: true } }, test: { select: { title: true } } },
  });

  const suspiciousSessions = await prisma.attempt.findMany({
    where: { riskScore: { gte: 60 }, status: 'IN_PROGRESS' },
    take: 5,
    include: { user: { select: { firstName: true, lastName: true } }, test: { select: { title: true } } },
  });

  res.json({ success: true, data: { users, tests, attempts, activeSessions, recentAttempts, suspiciousSessions } });
}

// GET /api/admin/users
export async function getAllUsers(req: Request, res: Response) {
  const { page = 1, limit = 20, search, role } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = { role: role || 'STUDENT' };
  if (search) where.OR = [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, isBanned: true, createdAt: true, lastLoginAt: true, college: true },
      skip, take: Number(limit), orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ success: true, data: users, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
}

// PATCH /api/admin/users/:id/ban
export async function banUser(req: Request, res: Response) {
  const { reason } = req.body;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: true, banReason: reason } });
  res.json({ success: true, data: user });
}

// PATCH /api/admin/users/:id/unban
export async function unbanUser(req: Request, res: Response) {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: false, banReason: null } });
  res.json({ success: true, data: user });
}

// POST /api/admin/tests
export async function createTest(req: Request, res: Response) {
  const test = await prisma.test.create({
    data: { ...req.body, createdById: req.user!.userId },
  });
  res.status(201).json({ success: true, data: test });
}

// GET /api/admin/tests
export async function getAllTests(req: Request, res: Response) {
  const tests = await prisma.test.findMany({
    include: {
      _count: { select: { attempts: true } },
      sections: { include: { _count: { select: { questions: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: tests });
}

// PUT /api/admin/tests/:id
export async function updateTest(req: Request, res: Response) {
  const test = await prisma.test.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: test });
}

// DELETE /api/admin/tests/:id
export async function deleteTest(req: Request, res: Response) {
  await prisma.test.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
  res.json({ success: true, message: 'Test archived successfully' });
}

// POST /api/admin/questions
export async function createQuestion(req: Request, res: Response) {
  const question = await prisma.question.create({
    data: { ...req.body, createdById: req.user!.userId },
  });
  res.status(201).json({ success: true, data: question });
}

// GET /api/admin/questions
export async function getQuestions(req: Request, res: Response) {
  const { page = 1, limit = 20, category, difficulty, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where: any = { isActive: true };
  if (category) where.categoryId = category;
  if (difficulty) where.difficulty = difficulty;
  if (search) where.text = { contains: search, mode: 'insensitive' };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where, include: { category: true, tags: { include: { tag: true } } },
      skip, take: Number(limit), orderBy: { createdAt: 'desc' },
    }),
    prisma.question.count({ where }),
  ]);
  res.json({ success: true, data: questions, meta: { total, page: Number(page), limit: Number(limit) } });
}

// PUT /api/admin/questions/:id
export async function updateQuestion(req: Request, res: Response) {
  const question = await prisma.question.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: question });
}

// DELETE /api/admin/questions/:id
export async function deleteQuestion(req: Request, res: Response) {
  await prisma.question.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true, message: 'Question deleted' });
}

// POST /api/admin/tests/:testId/sections/:sectionId/questions
export async function addQuestionToSection(req: Request, res: Response) {
  const { questionIds } = req.body;
  const section = await prisma.testSection.findUnique({ where: { id: req.params.sectionId } });
  if (!section) throw new NotFoundError('Section not found');

  const testQuestions = await prisma.testQuestion.createMany({
    data: questionIds.map((qId: string, i: number) => ({
      testId: req.params.testId, sectionId: req.params.sectionId, questionId: qId, order: i,
    })),
    skipDuplicates: true,
  });
  res.status(201).json({ success: true, data: testQuestions });
}

// GET /api/admin/reports
export async function getReports(req: Request, res: Response) {
  const { testId } = req.query;
  const where = testId ? { testId: testId as string } : {};

  const attempts = await prisma.attempt.findMany({
    where: { ...where, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, college: true } },
      test: { select: { title: true, totalMarks: true } },
      proctorEvents: { select: { eventType: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  res.json({ success: true, data: attempts });
}

// GET /api/admin/audit-logs
export async function getAuditLogs(req: Request, res: Response) {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true, firstName: true } } },
    skip, take: Number(limit), orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: logs });
}

// POST /api/admin/questions/generate-ai
export async function generateAiQuestions(req: Request, res: Response) {
  const { category, topic, count, difficulty, type } = req.body;
  const generated = await aiService.generateQuestions({ category, topic, count, difficulty, type });

  const categoryRecord = await prisma.category.findFirst({ where: { name: { contains: category, mode: 'insensitive' } } });
  if (!categoryRecord) throw new NotFoundError('Category not found');

  const questions = await prisma.question.createMany({
    data: generated.map((q) => ({
      text: q.text, options: q.options, explanation: q.explanation,
      difficulty: q.difficulty, categoryId: categoryRecord.id,
      createdById: req.user!.userId, aiGenerated: true,
    })),
  });

  res.status(201).json({ success: true, data: { created: questions.count, questions: generated } });
}

// GET /api/admin/security-dashboard
export async function getSecurityDashboard(req: Request, res: Response) {
  const [
    activeExams, suspiciousAttempts, failedLogins, highRiskAttempts
  ] = await Promise.all([
    prisma.attempt.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.attempt.findMany({
      where: { riskScore: { gte: 70 } },
      take: 10,
      include: { user: { select: { email: true, firstName: true } }, test: { select: { title: true } } },
      orderBy: { riskScore: 'desc' },
    }),
    prisma.auditLog.count({
      where: { action: 'USER_LOGGED_IN', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.attempt.findMany({
      where: { riskScore: { gte: 80 }, status: 'IN_PROGRESS' },
      include: { user: { select: { email: true } }, test: { select: { title: true } } },
    }),
  ]);

  res.json({ success: true, data: { activeExams, suspiciousAttempts, failedLogins, highRiskAttempts } });
}

// GET /api/admin/live-monitoring
export async function getLiveMonitoring(req: Request, res: Response) {
  const activeAttempts: Array<{
    id: string;
    user: { firstName: string; lastName: string; email: string };
    test: { title: string; duration: number };
    startedAt: Date;
    tabSwitches: number;
    riskScore: number;
    proctorEvents: any[];
  }> = await prisma.attempt.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      test: { select: { title: true, duration: true } },
      proctorEvents: { orderBy: { occurredAt: 'desc' }, take: 5 },
    },
    orderBy: { startedAt: 'asc' },
  });

  const data = activeAttempts.map((a) => ({
    attemptId: a.id,
    user: `${a.user.firstName} ${a.user.lastName}`,
    email: a.user.email,
    test: a.test.title,
    startedAt: a.startedAt,
    tabSwitches: a.tabSwitches,
    riskScore: a.riskScore,
    recentEvents: a.proctorEvents,
  }));

  res.json({ success: true, data });
}
