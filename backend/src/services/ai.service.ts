import { z } from 'zod';
import { structured, isAIConfigured } from '../platform/ai';
export { MissingApiKeyError } from '../platform/ai';
export const isAiConfigured = isAIConfigured;

const schema = z.object({
  fullName: z.string(), headline: z.string(), summary: z.string(), skills: z.array(z.string()),
  experience: z.array(z.object({ company: z.string(), role: z.string(), start: z.string(), end: z.string(), bullets: z.array(z.string()) })),
  projects: z.array(z.object({ name: z.string(), description: z.string(), tech: z.array(z.string()), link: z.string() })),
  education: z.array(z.object({ school: z.string(), degree: z.string(), year: z.string() })),
});
export type GeneratedResume = z.infer<typeof schema>;
export function generateResume(input: { rawInput: string; targetRole: string; profile: { firstName?: string; lastName?: string; email?: string }; owner: string; operationKey: string }) {
  return structured(input.owner, 'resume_generation', schema,
    'Write a technical resume only from the supplied career notes. Use empty strings or arrays for unknown facts. Do not infer missing names, dates or numbers. Write clear, concrete bullets. Do not insert placeholders or invent outcomes.',
    { notes: input.rawInput, role: input.targetRole, name: [input.profile.firstName, input.profile.lastName].filter(Boolean).join(' ') }, input.operationKey);
}
