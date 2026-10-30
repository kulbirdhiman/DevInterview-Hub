import { getAuth } from '@clerk/express';
import type { Request, Response } from 'express';
import { PrepSession } from '../models/prep.model';
import { Resume } from '../models/resume.model';

export const listSessions = async (req: Request, res: Response) => {
  res.json({ sessions: await PrepSession.find({ clerkId: getAuth(req).userId }).sort({ updatedAt: -1 }).limit(100) });
};
export const getSession = async (req: Request, res: Response) => {
  const session = await PrepSession.findOne({ _id: req.params.id, clerkId: getAuth(req).userId });
  return session ? res.json({ session }) : res.status(404).json({ message: 'Session not found.' });
};
// Old fixed question sets are preserved as historical 0–10 reports. New work
// uses the resume-aware, quota-controlled /interviews state machine.
export const createSession = (_req: Request, res: Response) => res.status(410).json({ message: 'Start adaptive practice from Interview practice.' });
export const answerQuestion = createSession;
export const deleteSession = async (req: Request, res: Response) => {
  const deleted = await PrepSession.findOneAndDelete({ _id: req.params.id, clerkId: getAuth(req).userId });
  return deleted ? res.json({ success: true }) : res.status(404).json({ message: 'Session not found.' });
};
export const getStats = async (req: Request, res: Response) => {
  const sessions = await PrepSession.find({ clerkId: getAuth(req).userId });
  const scored = sessions.flatMap(session => session.questions.filter(question => typeof question.score === 'number'));
  res.json({ stats: { resumeCount: await Resume.countDocuments({ clerkId: getAuth(req).userId }), sessionCount: sessions.length,
    questionsAnswered: scored.length, averageScore: scored.length ? Math.round(scored.reduce((sum, question) => sum + question.score!, 0) / scored.length * 10) / 10 : null } });
};
