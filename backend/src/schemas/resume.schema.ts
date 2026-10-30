import { z } from 'zod';

const text = (max = 200) => z.string().max(max).default('');
const url = text(500).refine(value => !value.trim() || /^https?:\/\//i.test(value.trim()) && URL.canParse(value.trim()), 'Use an http:// or https:// URL.');
const id = z.string().uuid().optional();
const lines = z.array(text(1000)).max(30).default([]);
export const coreSections = ['summary', 'experience', 'projects', 'skills', 'education', 'certifications', 'achievements'] as const;
export const MAX_VERSIONS = 30;

const fields = z.object({
  title: z.string().max(120).refine(value => value.trim().length > 0, 'Give your resume a title.').default('Untitled resume'),
  targetRole: text(120), fullName: text(120), headline: text(200), summary: text(4000),
  contact: z.object({ email: text(254).refine(value => !value || z.email().safeParse(value).success, 'Enter a valid email address.'), phone: text(50), location: text(150), website: url, linkedin: url, github: url }).strict().default({ email: '', phone: '', location: '', website: '', linkedin: '', github: '' }),
  skills: z.array(text(80)).max(50).default([]),
  experience: z.array(z.object({ id, company: text(), role: text(), start: text(40), end: text(40), bullets: lines }).strict()).max(20).default([]),
  projects: z.array(z.object({ id, name: text(), description: text(3000), tech: z.array(text(80)).max(30).default([]), link: url }).strict()).max(20).default([]),
  education: z.array(z.object({ id, school: text(), degree: text(), year: text(60) }).strict()).max(20).default([]),
  certifications: z.array(z.object({ id, name: text(), issuer: text(), date: text(60), link: url }).strict()).max(20).default([]),
  achievements: z.array(z.object({ id, title: text(), description: text(2000), date: text(60) }).strict()).max(20).default([]),
  customSections: z.array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(80), body: text(4000) }).strict()).max(5).default([]),
  sectionOrder: z.array(z.string().max(80)).max(12).default([...coreSections]),
  presentation: z.object({ template: z.enum(['ats', 'minimal', 'developer', 'classic', 'modern']).default('ats'), font: z.enum(['sans', 'serif', 'mono']).default('sans'), fontSize: z.enum(['small', 'medium', 'large']).default('medium'), spacing: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'), color: z.enum(['slate', 'emerald', 'blue', 'burgundy']).default('emerald') }).strict().default({ template: 'ats', font: 'sans', fontSize: 'medium', spacing: 'comfortable', color: 'emerald' }),
}).strict();

export const resumeContentSchema = fields.superRefine((value, context) => {
  const expected = [...coreSections, ...value.customSections.map(section => `custom:${section.id}`)];
  if (value.sectionOrder.length !== expected.length || new Set(value.sectionOrder).size !== expected.length || expected.some(key => !value.sectionOrder.includes(key))) {
    context.addIssue({ code: 'custom', path: ['sectionOrder'], message: 'Section order must include every section exactly once.' });
  }
  const ids = value.customSections.map(section => section.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['customSections'], message: 'Custom section IDs must be unique.' });
  for (const key of ['experience', 'projects', 'education', 'certifications', 'achievements'] as const) {
    const itemIds = value[key].flatMap(item => item.id ? [item.id] : []);
    if (new Set(itemIds).size !== itemIds.length) context.addIssue({ code: 'custom', path: [key], message: 'Entry IDs must be unique within a section.' });
  }
  // Bound embedded version snapshots well below MongoDB's document size limit.
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 100_000) context.addIssue({ code: 'custom', message: 'Resume content must be smaller than 100 KB.' });
});
export type ResumeContent = z.infer<typeof resumeContentSchema>;
export const updateResumeSchema = z.object({ expectedRevision: z.number().int().min(0), content: resumeContentSchema }).strict();
export const versionRequestSchema = z.object({ expectedRevision: z.number().int().min(0), label: z.string().trim().min(1).max(100).default('Saved version') }).strict();
export const restoreRequestSchema = z.object({ expectedRevision: z.number().int().min(0) }).strict();

export function resumeSnapshot(document: Record<string, unknown>): ResumeContent {
  return resumeContentSchema.parse(Object.fromEntries(Object.keys(fields.shape).map(key => [key, document[key]])));
}

export function revisionFilter(revision: number) {
  return revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision };
}
