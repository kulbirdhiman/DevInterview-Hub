import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const MODEL = 'claude-opus-5';

/**
 * Thrown when ANTHROPIC_API_KEY is absent. Routes turn this into a 503 with a
 * readable message rather than a stack trace, so the dashboard can tell the
 * user what to configure.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set on the server. Add it to your .env and restart the backend.'
    );
    this.name = 'MissingApiKeyError';
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (!client) client = new Anthropic();
  return client;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/* ------------------------------------------------------------------ *
 * Resume generation
 * ------------------------------------------------------------------ */

const ResumeSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      start: z.string(),
      end: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      tech: z.array(z.string()),
      link: z.string(),
    })
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      year: z.string(),
    })
  ),
});

export type GeneratedResume = z.infer<typeof ResumeSchema>;

const RESUME_SYSTEM = `You write technical resumes for software engineers.

Rules you must follow:
- Only use facts the candidate provided. Never invent employers, dates, degrees, or metrics.
- If the candidate gave no number for an achievement, describe the work without one. Do not fabricate percentages.
- Each experience bullet starts with a concrete verb and says what was built and why it mattered.
- Keep bullets to one or two lines. Three to five bullets per role.
- The summary is two or three sentences, written in the first person without using "I".
- If a field is genuinely unknown, return an empty string or empty array for it rather than a placeholder like "N/A".`;

export async function generateResume(input: {
  rawInput: string;
  targetRole: string;
  profile: { firstName?: string; lastName?: string; email?: string };
}): Promise<GeneratedResume> {
  const name = [input.profile.firstName, input.profile.lastName]
    .filter(Boolean)
    .join(' ');

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: RESUME_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Write a resume for this candidate.

Target role: ${input.targetRole || 'Software Engineer'}
Known name: ${name || '(not provided, infer from the notes or leave blank)'}

Candidate's own notes about their background:
---
${input.rawInput}
---`,
      },
    ],
    output_config: { format: zodOutputFormat(ResumeSchema) },
  });

  if (!response.parsed_output) {
    throw new Error('The model did not return a usable resume. Try again.');
  }
  return response.parsed_output;
}

/* ------------------------------------------------------------------ *
 * Interview question generation
 * ------------------------------------------------------------------ */

const QuestionSetSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      kind: z.enum(['coding', 'system-design', 'behavioural', 'concept']),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      lookFor: z.array(z.string()),
    })
  ),
});

export type GeneratedQuestions = z.infer<typeof QuestionSetSchema>;

const QUESTIONS_SYSTEM = `You are an experienced engineering interviewer building a practice set.

Rules you must follow:
- Write questions a real interviewer would ask for the stated role and stack, not trivia.
- Mix the kinds: some coding, some system design, some behavioural, some concept checks.
- Each question must stand alone and be answerable out loud in a few minutes.
- "lookFor" lists three or four things a strong answer actually covers. Write them as specific observable points, not vague praise.
- If the candidate's resume is provided, ground several questions in their real experience.
- Never ask a question whose answer depends on knowing a specific company's internal systems.`;

export async function generateQuestions(input: {
  targetRole: string;
  stack: string[];
  difficulty: string;
  count: number;
  resumeContext?: string;
}): Promise<GeneratedQuestions> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: QUESTIONS_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Build a practice interview set.

Target role: ${input.targetRole}
Stack: ${input.stack.length ? input.stack.join(', ') : 'not specified'}
Overall difficulty: ${input.difficulty}
Number of questions: ${input.count}
${
  input.resumeContext
    ? `\nThe candidate's resume, for grounding some questions in their real work:\n---\n${input.resumeContext}\n---`
    : '\nNo resume provided. Keep questions general to the role and stack.'
}`,
      },
    ],
    output_config: { format: zodOutputFormat(QuestionSetSchema) },
  });

  if (!response.parsed_output) {
    throw new Error('The model did not return a usable question set. Try again.');
  }
  return response.parsed_output;
}

/* ------------------------------------------------------------------ *
 * Answer review
 * ------------------------------------------------------------------ */

const ReviewSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type AnswerReview = z.infer<typeof ReviewSchema>;

const REVIEW_SYSTEM = `You review a candidate's practice interview answer the way a fair, experienced interviewer would.

Rules you must follow:
- Score 0-10 against what the question actually asked. Be honest; a vague answer is not a 7.
- "feedback" is two to four sentences addressed to the candidate, plain and specific.
- "strengths" and "improvements" are concrete and tied to what they said. If the answer was empty or off-topic, say so plainly and score it low.
- Never invent things the candidate did not say.`;

export async function reviewAnswer(input: {
  question: string;
  lookFor: string[];
  answer: string;
}): Promise<AnswerReview> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: REVIEW_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Question asked:
${input.question}

What a strong answer covers:
${input.lookFor.map((p) => `- ${p}`).join('\n') || '- (not specified)'}

The candidate's answer:
---
${input.answer || '(the candidate left this blank)'}
---`,
      },
    ],
    output_config: { format: zodOutputFormat(ReviewSchema) },
  });

  if (!response.parsed_output) {
    throw new Error('The model did not return usable feedback. Try again.');
  }
  return response.parsed_output;
}
