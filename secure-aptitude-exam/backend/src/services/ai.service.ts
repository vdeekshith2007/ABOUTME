import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ─── Generate Questions ───────────────────────────────────────────────────────

export interface GeneratedQuestion {
  text: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedTime: number;
}

export async function generateQuestions(params: {
  category: string;
  topic: string;
  count: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  type?: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
}): Promise<GeneratedQuestion[]> {
  const prompt = `Generate ${params.count} aptitude questions for a competitive exam.
  Category: ${params.category}
  Topic: ${params.topic}
  Difficulty: ${params.difficulty}
  Type: ${params.type || 'SINGLE_CHOICE'} (single correct answer unless MULTIPLE_CHOICE)
  
  Return ONLY valid JSON array with this exact structure:
  [
    {
      "text": "Question text here",
      "options": [
        {"id": "A", "text": "Option A", "isCorrect": false},
        {"id": "B", "text": "Option B", "isCorrect": true},
        {"id": "C", "text": "Option C", "isCorrect": false},
        {"id": "D", "text": "Option D", "isCorrect": false}
      ],
      "explanation": "Why the answer is correct, with step-by-step working",
      "difficulty": "${params.difficulty}",
      "estimatedTime": 60
    }
  ]
  
  Rules:
  - Questions must be original and challenging
  - Options must be plausible
  - Explanations must be detailed and educational
  - estimatedTime is in seconds (30-180 range)
  - Return ONLY the JSON array, no markdown, no extra text`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as GeneratedQuestion[];
  } catch (error) {
    logger.error('AI question generation failed:', error);
    throw new Error('Failed to generate questions');
  }
}

// ─── Generate Explanation ─────────────────────────────────────────────────────

export async function generateExplanation(questionText: string, correctAnswer: string): Promise<string> {
  const prompt = `Explain why "${correctAnswer}" is the correct answer to this aptitude question:
  "${questionText}"
  
  Provide a clear, step-by-step explanation that helps students learn. Keep it under 200 words.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── Predict Difficulty ───────────────────────────────────────────────────────

export async function predictDifficulty(questionText: string, options: string[]): Promise<{
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  score: number;
  reasoning: string;
}> {
  const prompt = `Analyze this aptitude question and predict its difficulty:
  Question: "${questionText}"
  Options: ${options.join(' | ')}
  
  Return ONLY JSON:
  {
    "difficulty": "EASY|MEDIUM|HARD",
    "score": 0.0-1.0,
    "reasoning": "Brief explanation"
  }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── Performance Analysis ─────────────────────────────────────────────────────

export async function analyzePerformance(data: {
  userId: string;
  testScores: { category: string; score: number; total: number; timeTaken: number }[];
  weakAreas: string[];
  strongAreas: string[];
}): Promise<{
  summary: string;
  recommendations: string[];
  studyPlan: { topic: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; resources: string[] }[];
}> {
  const prompt = `You are an AI tutor analyzing a student's aptitude exam performance.
  
  Performance Data:
  ${JSON.stringify(data.testScores, null, 2)}
  
  Weak Areas: ${data.weakAreas.join(', ')}
  Strong Areas: ${data.strongAreas.join(', ')}
  
  Provide personalized analysis. Return ONLY JSON:
  {
    "summary": "Overall performance summary (2-3 sentences)",
    "recommendations": ["Specific actionable recommendation 1", "recommendation 2", "recommendation 3"],
    "studyPlan": [
      {
        "topic": "Topic name",
        "priority": "HIGH|MEDIUM|LOW",
        "resources": ["Resource 1", "Resource 2"]
      }
    ]
  }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── AI Chatbot ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function chatWithTutor(
  message: string,
  history: ChatMessage[],
  context?: string
): Promise<string> {
  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 1000 },
    systemInstruction: `You are an expert aptitude exam tutor for competitive exams (CAT, GMAT, GRE, GATE, Campus Placements).
    ${context ? `Context: ${context}` : ''}
    Help students understand concepts, solve problems step-by-step, and improve their performance.
    Keep answers clear, concise, and educational.`,
  });

  const result = await chat.sendMessage(message);
  return result.response.text();
}

// ─── Proctor Risk Analysis ─────────────────────────────────────────────────────

export async function analyzeProctorRisk(events: {
  type: string;
  count: number;
  severity: number;
}[]): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; summary: string }> {
  const prompt = `Analyze these proctoring events from an online exam and calculate a fraud risk score.
  
  Events: ${JSON.stringify(events)}
  
  Return ONLY JSON:
  {
    "riskScore": 0.0-100.0,
    "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
    "summary": "Brief risk assessment"
  }
  
  Consider:
  - Tab switches are high risk
  - Fullscreen exits are medium risk  
  - Copy/paste attempts are medium risk
  - Multiple face detections are high risk
  - IP changes are high risk`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

export async function generateWeeklyReport(data: {
  attempts: number;
  avgScore: number;
  topCategories: string[];
  improvementAreas: string[];
}): Promise<string> {
  const prompt = `Generate a motivational weekly performance report for a student:
  ${JSON.stringify(data)}
  
  Write 2-3 encouraging paragraphs with specific improvement tips. Keep it under 250 words.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
