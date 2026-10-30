import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const website = text(300).refine(
  value => !value || /^https?:\/\//i.test(value) && URL.canParse(value),
  'Use a full http:// or https:// URL, or leave this blank.'
);

export const profileFields = z.object({
  displayName: text(120),
  education: text(2000),
  experienceLevel: z.enum(['', 'student', 'fresher', 'early-career', 'experienced']),
  targetRole: text(120),
  targetIndustry: text(120),
  skills: z.array(text(80).min(1)).max(50),
  careerGoals: text(2000),
  interviewLanguage: z.enum(['English', 'Hindi']),
  salaryMin: z.number().int().min(0).max(1_000_000_000).nullable(),
  salaryMax: z.number().int().min(0).max(1_000_000_000).nullable(),
  salaryCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
  bio: text(2000),
  github: website,
  linkedin: website,
  portfolio: website,
});

export const profileDefaults = {
  displayName: '', education: '', experienceLevel: '' as const,
  targetRole: '', targetIndustry: '', skills: [] as string[], careerGoals: '',
  interviewLanguage: 'English' as const, salaryMin: null, salaryMax: null,
  salaryCurrency: 'INR' as const, bio: '', github: '', linkedin: '', portfolio: '',
};

function salaryRange(value: { salaryMin?: number | null; salaryMax?: number | null }) {
  return value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax;
}

export const profileUpdateSchema = profileFields.partial().strict();
export const completeProfileSchema = profileFields.strict()
  .refine(salaryRange, { message: 'Maximum salary must be at least the minimum.', path: ['salaryMax'] });
export const onboardingSchema = profileFields.extend({
  displayName: text(120).min(1, 'Enter your name.'),
  experienceLevel: z.enum(['student', 'fresher', 'early-career', 'experienced']),
  targetRole: text(120).min(1, 'Enter your target role.'),
}).strict().refine(salaryRange, { message: 'Maximum salary must be at least the minimum.', path: ['salaryMax'] });
