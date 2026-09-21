import { Request, Response } from 'express';
import { Resume } from '../models/resume.model';
import { User } from '../models/user.model';
import { generateResume, MissingApiKeyError } from '../services/ai.service';

export const listResumes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const resumes = await Resume.find({ clerkId: userId }).sort({ updatedAt: -1 });
    return res.json({ success: true, resumes });
  } catch (error) {
    console.error('listResumes', error);
    return res.status(500).json({ success: false, message: 'Could not load resumes' });
  }
};

export const getResume = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const resume = await Resume.findOne({ _id: req.params.id, clerkId: userId });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.json({ success: true, resume });
  } catch (error) {
    console.error('getResume', error);
    return res.status(500).json({ success: false, message: 'Could not load resume' });
  }
};

/** Generates resume content with Claude, then persists it. */
export const createResumeWithAI = async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId!;
    const { rawInput, targetRole, title } = req.body as {
      rawInput?: string;
      targetRole?: string;
      title?: string;
    };

    if (!rawInput || rawInput.trim().length < 40) {
      return res.status(400).json({
        success: false,
        message:
          'Tell us a bit more about your background first (at least a few sentences).',
      });
    }

    const user = await User.findOne({ clerkId: userId });

    const generated = await generateResume({
      rawInput: rawInput.trim(),
      targetRole: targetRole?.trim() || '',
      profile: {
        firstName: user?.firstName ?? undefined,
        lastName: user?.lastName ?? undefined,
        email: user?.email ?? undefined,
      },
    });

    const resume = await Resume.create({
      clerkId: userId,
      title: title?.trim() || `${targetRole?.trim() || 'Software Engineer'} resume`,
      targetRole: targetRole?.trim() || '',
      rawInput: rawInput.trim(),
      generatedByAI: true,
      ...generated,
    });

    return res.status(201).json({ success: true, resume });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.status(503).json({ success: false, message: error.message });
    }
    console.error('createResumeWithAI', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not generate resume',
    });
  }
};

export const updateResume = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const editable = [
      'title',
      'targetRole',
      'fullName',
      'headline',
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of editable) {
      if (key in req.body) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, clerkId: userId },
      updates,
      { new: true }
    );
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.json({ success: true, resume });
  } catch (error) {
    console.error('updateResume', error);
    return res.status(500).json({ success: false, message: 'Could not save resume' });
  }
};

export const deleteResume = async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const deleted = await Resume.findOneAndDelete({
      _id: req.params.id,
      clerkId: userId,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('deleteResume', error);
    return res.status(500).json({ success: false, message: 'Could not delete resume' });
  }
};
