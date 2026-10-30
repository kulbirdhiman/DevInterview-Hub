import { getAuth } from '@clerk/express';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Resume } from '../models/resume.model';
import { User } from '../models/user.model';
import { generateResume, MissingApiKeyError } from '../services/ai.service';
import { MAX_VERSIONS, restoreRequestSchema, resumeContentSchema, resumeSnapshot, revisionFilter, updateResumeSchema, versionRequestSchema } from '../schemas/resume.schema';

const owner = (req: Request) => ({ _id: req.params.id, clerkId: getAuth(req).userId });
const missing = (res: Response) => res.status(404).json({ success: false, message: 'Resume not found' });
const invalid = (res: Response, error: z.ZodError) => res.status(422).json({ success: false, message: error.issues[0].message, issues: error.issues });
const failed = (res: Response) => res.status(503).json({ success: false, message: 'Could not access your resume. Please retry.' });
const conflict = (res: Response) => res.status(409).json({ success: false, message: 'This resume changed in another tab. Download your draft, then reload the saved resume before continuing.' });

export const listResumes = async (req: Request, res: Response) => {
  try {
    const resumes = await Resume.find({ clerkId: getAuth(req).userId }).select('-rawInput').sort({ updatedAt: -1 });
    return res.json({ success: true, resumes });
  } catch { return failed(res); }
};

export const getResume = async (req: Request, res: Response) => {
  try {
    const resume = await Resume.findOne(owner(req)).select('-rawInput');
    return resume ? res.json({ success: true, resume }) : missing(res);
  } catch { return failed(res); }
};

export const createResume = async (req: Request, res: Response) => {
  const parsed = resumeContentSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const resume = await Resume.create({ ...parsed.data, clerkId: getAuth(req).userId! });
    return res.status(201).json({ success: true, resume });
  } catch { return failed(res); }
};

const generationSchema = z.object({
  rawInput: z.string().trim().min(40, 'Add at least a few sentences about your background.').max(30000),
  title: z.string().trim().max(120).optional(),
  targetRole: z.string().trim().max(120).default(''),
  presentation: resumeContentSchema.shape.presentation.optional(),
}).strict();

export const createResumeWithAI = async (req: Request, res: Response) => {
  const parsed = generationSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const userId = getAuth(req).userId!;
    const input = parsed.data;
    const user = await User.findOne({ clerkId: userId });
    const generated = await generateResume({ rawInput: input.rawInput, targetRole: input.targetRole,
      profile: { firstName: user?.firstName ?? undefined, lastName: user?.lastName ?? undefined, email: user?.email ?? undefined } });
    const content = resumeContentSchema.parse({ ...generated, targetRole: input.targetRole,
      title: input.title || `${input.targetRole || 'My'} resume`, presentation: input.presentation });
    const resume = await Resume.create({ ...content, clerkId: userId, rawInput: input.rawInput, generatedByAI: true });
    return res.status(201).json({ success: true, resume });
  } catch (error) {
    if (error instanceof MissingApiKeyError) return res.status(503).json({ success: false, message: error.message });
    return res.status(503).json({ success: false, message: 'Could not generate your resume. You can create a blank resume or retry.' });
  }
};

export const updateResume = async (req: Request, res: Response) => {
  const parsed = updateResumeSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const resume = await Resume.findOneAndUpdate(
      { ...owner(req), ...revisionFilter(parsed.data.expectedRevision) },
      { $set: { ...parsed.data.content, updatedAt: new Date() }, $inc: { revision: 1 } },
      { returnDocument: 'after', runValidators: true }
    ).select('-rawInput');
    if (!resume) return await Resume.exists(owner(req)) ? conflict(res) : missing(res);
    return res.json({ success: true, resume });
  } catch { return failed(res); }
};

export const listVersions = async (req: Request, res: Response) => {
  try {
    const resume = await Resume.findOne(owner(req)).select('+versions');
    if (!resume) return missing(res);
    const versions = resume.versions.map(version => ({ _id: version._id, label: version.label,
      createdAt: version.createdAt, sourceRevision: version.sourceRevision, schemaVersion: version.schemaVersion }));
    return res.json({ success: true, versions: versions.reverse(), limit: MAX_VERSIONS });
  } catch { return failed(res); }
};

export const saveVersion = async (req: Request, res: Response) => {
  const parsed = versionRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const current = await Resume.findOne(owner(req));
    if (!current) return missing(res);
    if ((current.revision ?? 0) !== parsed.data.expectedRevision) return conflict(res);
    if (current.versionCount >= MAX_VERSIONS) return res.status(422).json({ success: false, message: `A resume can keep ${MAX_VERSIONS} versions. Create a separate resume for more history.` });
    const snapshot = resumeSnapshot(current.toObject());
    const resume = await Resume.findOneAndUpdate({ ...owner(req), ...revisionFilter(parsed.data.expectedRevision) }, {
      $push: { versions: { _id: new Types.ObjectId(), label: parsed.data.label, sourceRevision: parsed.data.expectedRevision, schemaVersion: 1, createdAt: new Date(), snapshot } },
      $inc: { revision: 1, versionCount: 1 }, $set: { updatedAt: new Date() },
    }, { returnDocument: 'after' }).select('-rawInput');
    if (!resume) return conflict(res);
    return res.status(201).json({ success: true, resume });
  } catch { return failed(res); }
};

export const restoreVersion = async (req: Request, res: Response) => {
  const parsed = restoreRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const current = await Resume.findOne(owner(req)).select('+versions');
    if (!current) return missing(res);
    if ((current.revision ?? 0) !== parsed.data.expectedRevision) return conflict(res);
    const version = current.versions.id(req.params.versionId as string);
    if (!version) return res.status(404).json({ success: false, message: 'Version not found' });
    if (current.versionCount >= MAX_VERSIONS) return res.status(422).json({ success: false, message: 'Version history is full. Restore is paused to preserve your current draft.' });
    // Restoring never mutates the historical version. Preserve the current
    // draft in the same atomic write before replacing it with the snapshot.
    const resume = await Resume.findOneAndUpdate({ ...owner(req), ...revisionFilter(parsed.data.expectedRevision) }, {
      $set: { ...resumeContentSchema.parse(version.snapshot), updatedAt: new Date() },
      $push: { versions: { _id: new Types.ObjectId(), label: `Before restoring ${version.label}`.slice(0, 100), sourceRevision: parsed.data.expectedRevision, schemaVersion: 1, createdAt: new Date(), snapshot: resumeSnapshot(current.toObject()) } },
      $inc: { revision: 1, versionCount: 1 },
    }, { returnDocument: 'after' }).select('-rawInput');
    return resume ? res.json({ success: true, resume }) : conflict(res);
  } catch { return failed(res); }
};

export const deleteResume = async (req: Request, res: Response) => {
  try {
    const deleted = await Resume.findOneAndDelete(owner(req));
    return deleted ? res.json({ success: true }) : missing(res);
  } catch { return failed(res); }
};
