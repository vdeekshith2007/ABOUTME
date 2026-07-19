import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { AttemptStatus, ProctorEventType } from '@prisma/client';
import { analyzeProctorRisk } from './ai.service';

// ─── Start Attempt ─────────────────────────────────────────────────────────────

export async function startExam(userId: string, testId: string, ipAddress?: string, deviceInfo?: object) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: {
        include: {
          questions: {
            include: { question: true },
            orderBy: { order: 'asc' },
          },
          orderBy: { order: 'asc' },
        },
      },
    },
  });

  if (!test) throw new NotFoundError('Test not found');
  if (test.status !== 'ACTIVE') throw new ValidationError('Test is not active');
  if (test.scheduledAt && test.scheduledAt > new Date()) throw new ValidationError('Test has not started yet');
  if (test.endsAt && test.endsAt < new Date()) throw new ValidationError('Test has ended');

  // Check existing attempt
  const existingAttempt = await prisma.attempt.findUnique({ where: { userId_testId: { userId, testId } } });
  if (existingAttempt) {
    if (existingAttempt.status !== 'IN_PROGRESS') throw new ValidationError('You have already submitted this test');
    return resumeAttempt(existingAttempt.id, userId);
  }

  // Check max attempts
  const attemptCount = await prisma.attempt.count({ where: { userId, testId } });
  if (attemptCount >= test.maxAttempts) throw new ValidationError('Maximum attempts reached');

  const attempt = await prisma.attempt.create({
    data: { userId, testId, status: 'IN_PROGRESS', ipAddress, deviceInfo },
  });

  // Randomize questions if enabled
  const processedSections = test.sections.map((section) => {
    let questions = [...section.questions];
    if (test.shuffleQuestions) questions = shuffleArray(questions);
    return {
      ...section,
      questions: questions.map((tq) => {
        const q = { ...tq.question };
        if (test.shuffleOptions && q.options) {
          q.options = shuffleArray(q.options as object[]);
        }
        return {
          testQuestionId: tq.id,
          order: tq.order,
          marks: tq.marks ?? q.marks,
          negativeMarks: tq.negativeMarks ?? q.negativeMarks,
          question: {
            id: q.id, text: q.text, type: q.type, options: q.options,
            imageUrl: q.imageUrl, codeSnippet: q.codeSnippet, difficulty: q.difficulty,
            timeLimit: q.timeLimit,
          },
        };
      }),
    };
  });

  // Cache attempt state in Redis (for resume capability)
  await redis.setex(
    `exam:${attempt.id}`,
    test.duration * 60 + 300,
    JSON.stringify({ startedAt: attempt.startedAt, duration: test.duration })
  );

  return { attempt, sections: processedSections, test: { id: test.id, title: test.title, duration: test.duration, shuffleQuestions: test.shuffleQuestions, fullScreenMode: test.fullScreenMode, tabSwitchLimit: test.tabSwitchLimit } };
}

// ─── Resume Attempt ────────────────────────────────────────────────────────────

export async function resumeAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { test: true, answers: true },
  });

  if (!attempt) throw new NotFoundError('Attempt not found');
  if (attempt.userId !== userId) throw new ForbiddenError();
  if (attempt.status !== 'IN_PROGRESS') throw new ValidationError('Attempt already submitted');

  const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  const remaining = attempt.test.duration * 60 - elapsed;

  if (remaining <= 0) {
    return autoSubmit(attemptId, userId);
  }

  return { attempt, remainingSeconds: remaining };
}

// ─── Save Answer ───────────────────────────────────────────────────────────────

export async function saveAnswer(
  attemptId: string,
  userId: string,
  questionId: string,
  selectedOptions: string[],
  timeTaken?: number
) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new ForbiddenError();
  if (attempt.status !== 'IN_PROGRESS') throw new ValidationError('Attempt already submitted');

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new NotFoundError('Question not found');

  // Evaluate answer
  const options = question.options as { id: string; isCorrect: boolean }[] | null;
  const correctIds = options?.filter((o) => o.isCorrect).map((o) => o.id) || [];
  const isCorrect = arraysEqual(selectedOptions.sort(), correctIds.sort());

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } } as { attemptId_questionId: { attemptId: string; questionId: string } },
    update: { selectedOptions, isCorrect, timeTaken, isSkipped: selectedOptions.length === 0, answeredAt: new Date() },
    create: { attemptId, questionId, selectedOptions, isCorrect, timeTaken, isSkipped: selectedOptions.length === 0, answeredAt: new Date() },
  });

  return { saved: true };
}

// ─── Submit Exam ───────────────────────────────────────────────────────────────

export async function submitExam(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { include: { sections: { include: { questions: { include: { question: true } } } } } },
      answers: { include: { question: true } },
    },
  });

  if (!attempt) throw new NotFoundError('Attempt not found');
  if (attempt.userId !== userId) throw new ForbiddenError();
  if (attempt.status !== 'IN_PROGRESS') throw new ValidationError('Attempt already submitted');

  let totalScore = 0;
  let totalMarks = 0;

  // Calculate score
  for (const section of attempt.test.sections) {
    for (const tq of section.questions) {
      const marks = tq.marks ?? tq.question.marks;
      const negMarks = tq.negativeMarks ?? tq.question.negativeMarks;
      totalMarks += marks;

      const answer = attempt.answers.find((a) => a.questionId === tq.questionId);
      if (answer?.isCorrect) {
        totalScore += marks;
        await prisma.attemptAnswer.update({ where: { id: answer.id }, data: { marksObtained: marks } });
      } else if (answer && !answer.isSkipped && attempt.test.negativeMarking) {
        totalScore -= negMarks;
        await prisma.attemptAnswer.update({ where: { id: answer.id }, data: { marksObtained: -negMarks } });
      }
    }
  }

  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  const isPassed = percentage >= attempt.test.passingMarks;
  const timeTaken = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);

  const updatedAttempt = await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: 'SUBMITTED', submittedAt: new Date(), totalScore, percentage, isPassed, timeTaken },
  });

  // Cleanup Redis cache
  await redis.del(`exam:${attemptId}`);

  logger.info(`Exam submitted: ${attemptId} by ${userId}, score: ${totalScore}/${totalMarks}`);
  return { attempt: updatedAttempt, totalScore, totalMarks, percentage, isPassed };
}

// ─── Auto Submit ───────────────────────────────────────────────────────────────

export async function autoSubmit(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.status !== 'IN_PROGRESS') return;

  await prisma.attempt.update({ where: { id: attemptId }, data: { status: 'AUTO_SUBMITTED' } });
  return submitExam(attemptId, userId);
}

// ─── Log Proctor Event ─────────────────────────────────────────────────────────

export async function logProctorEvent(
  attemptId: string,
  eventType: ProctorEventType,
  description?: string,
  metadata?: object
) {
  const severity = getEventSeverity(eventType);
  await prisma.proctorEvent.create({ data: { attemptId, eventType, description, severity, metadata } });

  // Update risk score periodically
  const events = await prisma.proctorEvent.groupBy({
    by: ['eventType'],
    where: { attemptId },
    _count: { eventType: true },
    _avg: { severity: true },
  });

  const riskData = events.map((e) => ({ type: e.eventType, count: e._count.eventType, severity: e._avg.severity || 1 }));
  const { riskScore } = await analyzeProctorRisk(riskData);

  await prisma.attempt.update({ where: { id: attemptId }, data: { riskScore } });

  // Track tab switches and fullscreen exits
  if (eventType === 'TAB_SWITCH') {
    const attempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: { tabSwitches: { increment: 1 } },
      include: { test: true },
    });
    if (attempt.tabSwitches >= attempt.test.tabSwitchLimit) {
      await autoSubmit(attemptId, attempt.userId);
      return { autoSubmitted: true, reason: 'Exceeded tab switch limit' };
    }
  }

  return { logged: true };
}

// ─── Get Results ───────────────────────────────────────────────────────────────

export async function getAttemptResult(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { title: true, showResults: true, passingMarks: true } },
      answers: {
        include: {
          question: {
            select: { text: true, options: true, explanation: true, difficulty: true, category: { select: { name: true } } },
          },
        },
      },
      proctorEvents: true,
    },
  });

  if (!attempt) throw new NotFoundError('Attempt not found');
  if (attempt.userId !== userId) throw new ForbiddenError();
  if (attempt.status === 'IN_PROGRESS') throw new ValidationError('Exam still in progress');
  if (!attempt.test.showResults) return { attempt: { id: attempt.id, status: attempt.status, percentage: attempt.percentage, isPassed: attempt.isPassed } };

  return attempt;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function getEventSeverity(eventType: ProctorEventType): number {
  const severityMap: Record<ProctorEventType, number> = {
    TAB_SWITCH: 4, FULLSCREEN_EXIT: 3, COPY_PASTE: 3, RIGHT_CLICK: 2,
    WEBCAM_FACE_NOT_DETECTED: 3, WEBCAM_MULTIPLE_FACES: 5, DEVICE_CHANGE: 5,
    IP_CHANGE: 5, BROWSER_REFRESH: 3, KEYBOARD_SHORTCUT: 2,
    FOCUS_LOST: 2, FOCUS_REGAINED: 1, NETWORK_DISCONNECT: 3,
  };
  return severityMap[eventType] || 1;
}
