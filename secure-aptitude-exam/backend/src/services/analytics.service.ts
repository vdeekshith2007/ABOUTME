import { prisma } from '../config/database';
import { analyzePerformance, generateWeeklyReport } from './ai.service';

// ─── Topic-wise Performance ────────────────────────────────────────────────────

export async function getTopicPerformance(userId: string) {
  const answers = await prisma.attemptAnswer.findMany({
    where: { attempt: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } } },
    include: { question: { include: { category: { select: { name: true } } } } },
  });

  const categoryMap: Record<string, { correct: number; total: number; totalTime: number }> = {};
  for (const answer of answers) {
    const cat = answer.question.category.name;
    if (!categoryMap[cat]) categoryMap[cat] = { correct: 0, total: 0, totalTime: 0 };
    categoryMap[cat].total++;
    if (answer.isCorrect) categoryMap[cat].correct++;
    categoryMap[cat].totalTime += answer.timeTaken || 0;
  }

  return Object.entries(categoryMap).map(([category, data]) => ({
    category,
    accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    total: data.total,
    correct: data.correct,
    avgTime: data.total > 0 ? data.totalTime / data.total : 0,
  }));
}

// ─── Speed vs Accuracy ─────────────────────────────────────────────────────────

export async function getSpeedAccuracyData(userId: string) {
  const attempts = await prisma.attempt.findMany({
    where: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
    include: { test: { select: { title: true } }, answers: true },
    orderBy: { startedAt: 'asc' },
  });

  return attempts.map((attempt) => {
    const answered = attempt.answers.filter((a) => !a.isSkipped);
    const correct = answered.filter((a) => a.isCorrect).length;
    const avgTime = answered.length > 0
      ? answered.reduce((sum, a) => sum + (a.timeTaken || 0), 0) / answered.length
      : 0;

    return {
      date: attempt.startedAt.toISOString().split('T')[0],
      testTitle: attempt.test.title,
      accuracy: answered.length > 0 ? (correct / answered.length) * 100 : 0,
      avgTimePerQuestion: avgTime,
      score: attempt.percentage,
    };
  });
}

// ─── Difficulty Analysis ───────────────────────────────────────────────────────

export async function getDifficultyAnalysis(userId: string) {
  const answers = await prisma.attemptAnswer.findMany({
    where: { attempt: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } } },
    include: { question: { select: { difficulty: true } } },
  });

  const diffMap: Record<string, { correct: number; total: number }> = {
    EASY: { correct: 0, total: 0 },
    MEDIUM: { correct: 0, total: 0 },
    HARD: { correct: 0, total: 0 },
  };

  for (const answer of answers) {
    const diff = answer.question.difficulty;
    diffMap[diff].total++;
    if (answer.isCorrect) diffMap[diff].correct++;
  }

  return Object.entries(diffMap).map(([difficulty, data]) => ({
    difficulty,
    accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    ...data,
  }));
}

// ─── Progress Tracking ─────────────────────────────────────────────────────────

export async function getProgressTracking(userId: string, weeks = 8) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);

  const attempts = await prisma.attempt.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] },
      startedAt: { gte: startDate },
    },
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true, percentage: true, isPassed: true },
  });

  // Group by week
  const weekMap: Record<string, number[]> = {};
  for (const attempt of attempts) {
    const week = getWeekLabel(attempt.startedAt);
    if (!weekMap[week]) weekMap[week] = [];
    weekMap[week].push(attempt.percentage);
  }

  return Object.entries(weekMap).map(([week, scores]) => ({
    week,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    attempts: scores.length,
    maxScore: Math.max(...scores),
  }));
}

// ─── AI Performance Analysis ───────────────────────────────────────────────────

export async function getAiAnalysis(userId: string) {
  const topicPerf = await getTopicPerformance(userId);
  const weakAreas = topicPerf.filter((t) => t.accuracy < 50).map((t) => t.category);
  const strongAreas = topicPerf.filter((t) => t.accuracy >= 75).map((t) => t.category);

  const attempts = await prisma.attempt.findMany({
    where: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
    include: { test: { include: { sections: { include: { questions: { include: { question: { include: { category: true } } } } } } } } },
  });

  const testScores = attempts.map((a) => ({
    category: a.test.title,
    score: a.totalScore,
    total: a.test.sections.reduce((sum, s) =>
      sum + s.questions.reduce((qs, q) => qs + (q.marks ?? q.question.marks), 0), 0),
    timeTaken: a.timeTaken || 0,
  }));

  return analyzePerformance({ userId, testScores, weakAreas, strongAreas });
}

// ─── Weekly Report ─────────────────────────────────────────────────────────────

export async function getWeeklyReport(userId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const attempts = await prisma.attempt.findMany({
    where: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] }, startedAt: { gte: weekAgo } },
    include: { test: { include: { sections: { include: { questions: { include: { question: { include: { category: true } } } } } } } } },
  });

  const topicPerf = await getTopicPerformance(userId);
  const avgScore = attempts.length > 0 ? attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length : 0;

  return generateWeeklyReport({
    attempts: attempts.length,
    avgScore,
    topCategories: topicPerf.slice(0, 3).map((t) => t.category),
    improvementAreas: topicPerf.filter((t) => t.accuracy < 60).map((t) => t.category),
  });
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────

export async function getLeaderboard(params: { testId?: string; period?: 'weekly' | 'monthly' | 'all'; college?: string; limit?: number }) {
  const limit = params.limit || 50;
  const dateFilter = params.period === 'weekly'
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    : params.period === 'monthly'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : undefined;

  const attempts = await prisma.attempt.findMany({
    where: {
      status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] },
      ...(params.testId && { testId: params.testId }),
      ...(dateFilter && { submittedAt: { gte: dateFilter } }),
      ...(params.college && { user: { college: params.college } }),
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, college: true } } },
    orderBy: [{ percentage: 'desc' }, { timeTaken: 'asc' }],
    take: limit,
  });

  return attempts.map((a, i) => ({
    rank: i + 1,
    userId: a.userId,
    name: `${a.user.firstName} ${a.user.lastName}`,
    username: a.user.username,
    avatar: a.user.avatarUrl,
    college: a.user.college,
    score: a.percentage.toFixed(1),
    timeTaken: a.timeTaken,
  }));
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
