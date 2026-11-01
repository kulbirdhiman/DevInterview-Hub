import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchReport, matchSchema } from '../src/platform/phase2';
import { resumeContentSchema } from '../src/schemas/resume.schema';
import { resumeEvidence } from '../src/platform/rubrics';
const evidence = resumeEvidence(resumeContentSchema.parse({ summary: 'Built tools with TypeScript.' }));
test('job match score renormalizes assessed weights and suppresses low coverage', () => {
  const requirements = (['requirements', 'scope', 'responsibilities', 'terminology'] as const).map((dimension, index) => ({ requirement: 'Build tools', priority: 'mandatory' as const, dimension, support: index === 1 ? 'partial' as const : 'supported' as const, reason: 'Explicit evidence.', evidenceRefs: ['summary'] }));
  assert.equal(matchReport(matchSchema.parse({ requirements, preparation: [] }), evidence).score, 88);
  const unknown = requirements.map(row => ({ ...row, support: 'unclear' as const }));
  assert.equal(matchReport({ requirements: unknown, preparation: [] }, evidence).score, null);
  assert.equal(matchReport({ requirements: unknown, preparation: [] }, evidence).coverage, 0);
});
test('job match rejects invented or absent supporting references', () => {
  const row = { requirement: 'TypeScript', priority: 'mandatory' as const, dimension: 'requirements' as const, support: 'supported' as const, reason: 'Explicit skill.', evidenceRefs: [] as string[] };
  assert.throws(() => matchReport({ requirements: [row], preparation: [] }, evidence), /need evidence/);
  assert.throws(() => matchReport({ requirements: [{ ...row, evidenceRefs: ['invented'] }], preparation: [] }, evidence), /Ungrounded/);
});
