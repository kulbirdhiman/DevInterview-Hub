import { Request, Response } from 'express';
import { PrepSession } from '../models/prep.model';
import { Resume } from '../models/resume.model';
import {
  generateQuestions,
  reviewAnswer,
  MissingApiKeyError,
} from '../services/ai.service';

export const listSessions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const sessions = await PrepSession.find({ clerkId: userId }).sort({
      updatedAt: -1,
    });
    return res.json({ success: true, sessions });
  } catch (error) {
    console.error('listSessions', error);
    return res.status(500).json({ success: false, message: 'Could not load sessions' });
  }
};

export const getSession = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const session = await PrepSession.findOne({
      _id: req.params.id,
      clerkId: userId,
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    return res.json({ success: true, session });
  } catch (error) {
    console.error('getSession', error);
    return res.status(500).json({ success: false, message: 'Could not load session' });
  }
};

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Builds a practice question set with Claude, optionally grounded in a resume. */
export const createSession = async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId!;
    const { targetRole, stack, difficulty, count, resumeId } = req.body as {
      targetRole?: string;
      stack?: string[];
      difficulty?: string;
      count?: number;
      resumeId?: string;
    };

    if (!targetRole?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Tell us which role you are preparing for.' });
    }

    // Clamp so a bad client cannot ask for a hundred questions.
    const questionCount = Math.min(Math.max(Number(count) || 6, 3), 12);
    const level: Difficulty = DIFFICULTIES.includes(difficulty as Difficulty)
      ? (difficulty as Difficulty)
      : 'medium';

    let resumeContext: string | undefined;
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, clerkId: userId });
      if (resume) {
        resumeContext = [
          resume.headline,
          resume.summary,
          `Skills: ${resume.skills.join(', ')}`,
          ...resume.experience.map(
            (e) => `${e.role} at ${e.company}: ${e.bullets.join(' ')}`
          ),
          ...resume.projects.map((p) => `Project ${p.name}: ${p.description}`),
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    const generated = await generateQuestions({
      targetRole: targetRole.trim(),
      stack: Array.isArray(stack) ? stack.filter(Boolean) : [],
      difficulty: level,
      count: questionCount,
      resumeContext,
    });

    const session = await PrepSession.create({
      clerkId: userId,
      targetRole: targetRole.trim(),
      stack: Array.isArray(stack) ? stack.filter(Boolean) : [],
      difficulty: level,
      resumeId: resumeId || undefined,
      questions: generated.questions,
      status: 'ready',
    });

    return res.status(201).json({ success: true, session });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.status(503).json({ success: false, message: error.message });
    }
    console.error('createSession', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not build question set',
    });
  }
};

/** Saves an answer and asks Claude to review it. */
export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const { answer } = req.body as { answer?: string };

    const session = await PrepSession.findOne({
      _id: req.params.id,
      clerkId: userId,
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const question = session.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    question.answer = answer ?? '';
    question.answeredAt = new Date();

    const review = await reviewAnswer({
      question: question.prompt,
      lookFor: question.lookFor,
      answer: question.answer,
    });

    question.score = review.score;
    question.feedback = review.feedback;
    question.strengths = review.strengths;
    question.improvements = review.improvements;

    const answered = session.questions.filter((q) => q.answeredAt).length;
    session.status =
      answered === session.questions.length ? 'completed' : 'in-progress';

    await session.save();

    return res.json({ success: true, question, status: session.status });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.status(503).json({ success: false, message: error.message });
    }
    console.error('answerQuestion', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not review answer',
    });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const deleted = await PrepSession.findOneAndDelete({
      _id: req.params.id,
      clerkId: userId,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('deleteSession', error);
    return res.status(500).json({ success: false, message: 'Could not delete session' });
  }
};

/** Counts for the dashboard overview. */
export const getStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const [resumeCount, sessions] = await Promise.all([
      Resume.countDocuments({ clerkId: userId }),
      PrepSession.find({ clerkId: userId }),
    ]);

    const answered = sessions.flatMap((s) =>
      s.questions.filter((q) => typeof q.score === 'number')
    );
    const averageScore = answered.length
      ? Number(
          (answered.reduce((sum, q) => sum + (q.score ?? 0), 0) / answered.length).toFixed(
            1
          )
        )
      : null;

    return res.json({
      success: true,
      stats: {
        resumeCount,
        sessionCount: sessions.length,
        questionsAnswered: answered.length,
        averageScore,
      },
    });
  } catch (error) {
    console.error('getStats', error);
    return res.status(500).json({ success: false, message: 'Could not load stats' });
  }
};
