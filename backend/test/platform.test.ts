import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resumeContentSchema } from '../src/schemas/resume.schema';
import { analysisReport, analysisOutput, evaluateAnswer, sessionReport, resumeEvidence, interviewWeights } from '../src/platform/rubrics';
import { pdfRuns, renderPdf, resumeBlocks } from '../src/platform/pdf';

const resume = resumeContentSchema.parse({ fullName: 'Asha Rao', targetRole: 'Developer', contact: { email: 'asha@example.com' }, summary: 'Built internal tools.', skills: ['TypeScript'], projects: [{ name: 'Career tracker', description: 'Built a tracker.', tech: ['TypeScript'], link: '' }] });

test('resume quality uses a transparent weighted sum, preserves evidence, rejects invented citations', () => {
  const evidence = resumeEvidence(resume);
  const output = analysisOutput.parse({ dimensions: ['content', 'impact', 'relevance', 'readability'].map(key => ({ key, rating: 3, reason: 'Specific evidence present.', evidenceRefs: ['summary'] })), issues: [], strengths: [{ title: 'Concrete work', detail: 'Describes internal tools.', evidenceRefs: ['summary'] }] });
  const report = analysisReport(resume, output, evidence, true);
  assert.equal(report.score, 83); // completeness 4, four model dimensions 3, formatting 4
  assert.equal(report.coverage, 100);
  const partial = analysisReport(resume, output, evidence, false);
  assert.equal(partial.coverage, 85);
  output.strengths[0].evidenceRefs = ['invented-employer'];
  assert.throws(() => analysisReport(resume, output, evidence, true), /Ungrounded/);
});

test('interview grading requires exact excerpts and enough substantive answers for totals', () => {
  const answer = 'I built an internal tool and documented its tradeoffs for the team.';
  const dimensions = Object.keys(interviewWeights.hr).map(key => ({ key: key as 'clarity' | 'relevance' | 'behavioral' | 'reflection', rating: 3, reason: 'Concrete example.', excerpts: ['I built an internal tool'] }));
  const evaluation = evaluateAnswer('hr', answer, { dimensions, strengths: ['Concrete example'], gaps: [], betterAnswerOutline: ['State your role and the outcome.'], studyTopics: [] });
  assert.equal(evaluation.score, 75);
  assert.equal(sessionReport('hr', [{ answer, evaluation }]).score, null);
  assert.equal(sessionReport('hr', Array(3).fill({ answer, evaluation })).score, 75);
  assert.throws(() => evaluateAnswer('hr', answer, { ...evaluation, dimensions: dimensions.map(row => ({ ...row, excerpts: ['Invented quote'] })) }), /does not match/);
  assert.throws(() => evaluateAnswer('hr', '', { ...evaluation, dimensions: dimensions.map(row => ({ ...row, excerpts: [] })) }), /empty answer/);
});

test('PDFs embed fonts, support Hindi runs, preserve section order and reject unsupported symbols', async () => {
  assert.equal(pdfRuns('नमस्ते Asha', 'NotoSans')[0].font, 'NotoSansDevanagari');
  assert.throws(() => pdfRuns('Rocket 🚀', 'NotoSans'), /U\+1F680/);
  const ordered = { ...resume, sectionOrder: ['projects', 'summary', 'experience', 'skills', 'education', 'certifications', 'achievements'] };
  assert.equal(resumeBlocks(ordered).filter(block => block.kind === 'section')[0].text, 'Projects');
  const buffer = await renderPdf(ordered);
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 5000);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  const document = await loading.promise;
  const extracted: string[] = [];
  for (let page = 1; page <= document.numPages; page++) {
    const text = await (await document.getPage(page)).getTextContent();
    extracted.push(...text.items.flatMap(item => 'str' in item ? [item.str] : []));
  }
  await loading.destroy();
  const text = extracted.join(' ');
  assert.ok(text.includes('Asha Rao'));
  assert.ok(text.includes('Career tracker'));
  assert.ok(text.indexOf('Projects') < text.indexOf('Summary'));
  assert.ok(text.includes('asha@example.com'));
});
