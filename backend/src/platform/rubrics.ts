import { z } from 'zod';
import type { ResumeContent } from '../schemas/resume.schema';

export type Evidence = { id: string; section: string; text: string };
export function resumeEvidence(resume: ResumeContent): Evidence[] {
  const evidence: Evidence[] = [];
  const add = (id: string, section: string, text: string) => { if (text.trim()) evidence.push({ id, section, text: text.slice(0, 4000) }); };
  add('headline', 'contact', resume.headline); add('targetRole', 'target', resume.targetRole); add('summary', 'summary', resume.summary);
  resume.skills.forEach((value, i) => add(`skills.${i}`, 'skills', value));
  resume.experience.forEach((item, i) => { add(`experience.${i}`, 'experience', [item.role, item.company, item.start, item.end].filter(Boolean).join(' · ')); item.bullets.forEach((value, j) => add(`experience.${i}.bullets.${j}`, 'experience', value)); });
  resume.projects.forEach((item, i) => add(`projects.${i}`, 'projects', [item.name, item.description, item.tech.join(', ')].filter(Boolean).join(' · ')));
  resume.education.forEach((item, i) => add(`education.${i}`, 'education', [item.degree, item.school, item.year].filter(Boolean).join(' · ')));
  resume.certifications.forEach((item, i) => add(`certifications.${i}`, 'certifications', [item.name, item.issuer, item.date].filter(Boolean).join(' · ')));
  resume.achievements.forEach((item, i) => add(`achievements.${i}`, 'achievements', [item.title, item.description, item.date].filter(Boolean).join(' · ')));
  resume.customSections.forEach(item => add(`custom:${item.id}`, item.title, item.body));
  for (const section of ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements']) {
    if (!evidence.some(item => item.section === section)) evidence.push({ id: `missing:${section}`, section, text: `No ${section} evidence provided.` });
  }
  // Deterministic bounded selection; the report discloses selected evidence.
  let bytes = 0;
  return evidence.filter(item => { bytes += Buffer.byteLength(item.text); return bytes <= 30000; });
}
const finding = z.object({ title: z.string().max(160), detail: z.string().max(1200), evidenceRefs: z.array(z.string()).min(1).max(5) });
export const analysisOutput = z.object({
  dimensions: z.array(z.object({ key: z.enum(['content', 'impact', 'relevance', 'readability']), rating: z.number().int().min(0).max(4), reason: z.string().max(1200), evidenceRefs: z.array(z.string()).min(1).max(5) })).length(4),
  issues: z.array(finding.extend({ severity: z.enum(['critical', 'moderate', 'minor']), suggestion: z.string().max(1200) })).max(12),
  strengths: z.array(finding).max(8),
});
export const resumeWeights = { completeness: 15, content: 20, impact: 20, relevance: 15, readability: 15, formatting: 15 };
export function validateRefs(refs: string[], evidence: Evidence[]) {
  if (!refs.length || refs.some(id => !evidence.some(item => item.id === id))) throw new Error('Ungrounded evidence reference');
}
export function analysisReport(resume: ResumeContent, ai: z.infer<typeof analysisOutput>, evidence: Evidence[], pdfValid: boolean) {
  const keys = ai.dimensions.map(item => item.key);
  if (new Set(keys).size !== 4) throw new Error('Duplicate rubric dimensions');
  for (const item of [...ai.dimensions, ...ai.issues, ...ai.strengths]) validateRefs(item.evidenceRefs, evidence);
  const completeness = [resume.fullName, resume.contact.email, resume.summary, resume.skills.some(item => item.trim()), resume.experience.length || resume.projects.length || resume.education.length, resume.targetRole || resume.headline].filter(Boolean).length;
  const dimensions = [
    { key: 'completeness', rating: Math.round(completeness / 6 * 4), reason: `${completeness}/6 core information groups supplied. Education/projects can demonstrate early-career experience.`, evidenceRefs: [] as string[], assessed: true },
    ...ai.dimensions.map(item => ({ ...item, assessed: true })),
    { key: 'formatting', rating: pdfValid ? 4 : 0, reason: pdfValid ? 'Supported single-column layout successfully rendered with embedded fonts and selectable text. External ATS behavior is not tested.' : 'PDF could not be verified; formatting is not assessed.', evidenceRefs: [] as string[], assessed: pdfValid },
  ].map(item => ({ ...item, weight: resumeWeights[item.key as keyof typeof resumeWeights] }));
  const coverage = dimensions.filter(item => item.assessed).reduce((sum, item) => sum + item.weight, 0);
  return { rubricVersion: 'resume-v1', score: coverage >= 70 ? Math.round(dimensions.filter(item => item.assessed).reduce((sum, item) => sum + item.weight * item.rating / 4, 0) / coverage * 100) : null,
    coverage, dimensions, strengths: ai.strengths, issues: ai.issues, evidence,
    limitations: ['Educational quality estimate, not an official ATS score or hiring prediction.', 'Relevance is estimated against your target role, not a job description.', 'Only the displayed, bounded evidence was analyzed; no achievements were added.'] };
}

export const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export const categories = ['hr', 'technical', 'behavioral', 'project'] as const;
export const questionOutput = z.object({ prompt: z.string().min(10).max(1800), sourceRefs: z.array(z.string()).min(1).max(4), expectedEvidence: z.array(z.string().max(400)).min(2).max(5) });
export const interviewWeights: Record<string, Record<string, number>> = {
  technical: { knowledge: 25, reasoning: 20, project: 15, clarity: 15, relevance: 15, behavioral: 10 },
  project: { knowledge: 15, reasoning: 20, project: 30, clarity: 15, relevance: 15, behavioral: 5 },
  hr: { clarity: 25, relevance: 25, behavioral: 35, reflection: 15 },
  behavioral: { clarity: 25, relevance: 25, behavioral: 35, reflection: 15 },
};
export const evaluationOutput = z.object({
  dimensions: z.array(z.object({ key: z.enum(['knowledge', 'reasoning', 'project', 'clarity', 'relevance', 'behavioral', 'reflection']), rating: z.number().int().min(0).max(4).nullable(), reason: z.string().max(800), excerpts: z.array(z.string().min(1).max(600)).max(3) })).min(1).max(7),
  strengths: z.array(z.string().max(500)).max(4), gaps: z.array(z.string().max(500)).max(5), betterAnswerOutline: z.array(z.string().max(500)).max(5), studyTopics: z.array(z.string().max(200)).max(5),
});
export const answerOutput = z.object({ evaluation: evaluationOutput, nextQuestion: questionOutput.nullable() });
export type Evaluation = z.infer<typeof evaluationOutput> & { score: number | null; coverage: number };
export function evaluateAnswer(category: string, answer: string, evaluation: z.infer<typeof evaluationOutput>): Evaluation {
  const weights = interviewWeights[category], keys = evaluation.dimensions.map(item => item.key);
  if (new Set(keys).size !== keys.length || keys.some(key => !(key in weights)) || Object.keys(weights).some(key => !keys.includes(key as typeof keys[number]))) throw new Error('Invalid interview rubric dimensions');
  for (const dimension of evaluation.dimensions) {
    if (!answer.trim() && dimension.rating !== null && dimension.rating !== 0) throw new Error('An empty answer cannot receive positive credit');
    if (dimension.excerpts.some(excerpt => !answer.includes(excerpt))) throw new Error('Answer evidence does not match transcript');
    if (answer.trim() && dimension.rating !== null && !dimension.excerpts.length) throw new Error('Missing answer evidence');
  }
  const coverage = evaluation.dimensions.filter(item => item.rating !== null).reduce((sum, item) => sum + weights[item.key], 0);
  const score = coverage >= 70 ? Math.round(evaluation.dimensions.reduce((sum, item) => sum + (item.rating ?? 0) / 4 * weights[item.key], 0) / coverage * 100) : null;
  return { ...evaluation, score, coverage };
}
export function sessionReport(category: string, turns: { answer?: string | null; evaluation?: Evaluation }[]) {
  const evaluated = turns.filter(turn => turn.evaluation), weights = interviewWeights[category];
  const dimensions = Object.entries(weights).map(([key, weight]) => {
    const rows = evaluated.flatMap(turn => turn.evaluation!.dimensions.filter(row => row.key === key && row.rating !== null));
    return { key, weight, rating: rows.length ? rows.reduce((sum, row) => sum + row.rating!, 0) / rows.length : null, samples: rows.length };
  });
  const coverage = dimensions.filter(row => row.rating !== null).reduce((sum, row) => sum + row.weight, 0);
  const substantive = evaluated.filter(turn => (turn.answer?.trim().length ?? 0) >= 40).length;
  const score = substantive >= 3 && coverage >= 70 ? Math.round(dimensions.reduce((sum, row) => sum + (row.rating ?? 0) / 4 * row.weight, 0) / coverage * 100) : null;
  return { rubricVersion: `interview-${category}-v1`, score, coverage, answered: evaluated.length, substantive, dimensions,
    summary: score === null ? 'Partial practice report. At least three substantive answers and 70% dimension coverage are needed for an overall score.' : `Completed practice with ${evaluated.length} evaluated answers. Review the evidence and next steps below.`,
    studyTopics: [...new Set(evaluated.flatMap(turn => turn.evaluation!.studyTopics))].slice(0, 8),
    disclaimer: 'Educational AI feedback, not hiring probability. Scores use answer evidence, not appearance, accent or inferred emotion.' };
}
export function nextDifficulty(initial: string, evaluations: Evaluation[]) {
  let index = levels.indexOf(initial as typeof levels[number]);
  const scores = evaluations.slice(-2).map(value => value.score).filter((value): value is number => value !== null);
  if (scores.length === 2) index += scores.every(score => score >= 80) ? 1 : scores.every(score => score <= 40) ? -1 : 0;
  return levels[Math.max(0, Math.min(3, index))];
}
