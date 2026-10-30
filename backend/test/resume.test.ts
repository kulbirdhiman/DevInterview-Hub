import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coreSections, resumeContentSchema, resumeSnapshot, updateResumeSchema } from '../src/schemas/resume.schema';

const customId = '43d7f5d1-a7da-42f5-bcde-72dfba10c942';

test('legacy resume normalization retains every existing core field and supplies new defaults', () => {
  const snapshot = resumeSnapshot({ fullName: 'Asha Rao', skills: ['TypeScript'], experience: [{ company: 'Example', role: 'Developer', bullets: ['Built internal tools'] }], generatedByAI: true, clerkId: 'owner', rawInput: 'private notes' });
  assert.equal(snapshot.fullName, 'Asha Rao');
  assert.deepEqual(snapshot.skills, ['TypeScript']);
  assert.equal(snapshot.experience[0].bullets[0], 'Built internal tools');
  assert.deepEqual(snapshot.sectionOrder, coreSections);
  assert.equal(snapshot.presentation.template, 'classic');
  assert.equal('clerkId' in snapshot, false);
  assert.equal('rawInput' in snapshot, false);
});

test('reordering requires every core/custom section exactly once', () => {
  const custom = { id: customId, title: 'Volunteering', body: 'Community workshop' };
  const content = resumeContentSchema.parse({});
  assert.equal(resumeContentSchema.safeParse({ ...content, sectionOrder: ['summary'] }).success, false);
  assert.equal(resumeContentSchema.safeParse({ ...content, sectionOrder: [...coreSections.slice(1), 'skills'] }).success, false);
  assert.equal(resumeContentSchema.safeParse({ ...content, customSections: [custom] }).success, false);
  assert.equal(resumeContentSchema.safeParse({ ...content, customSections: [custom], sectionOrder: [`custom:${customId}`, ...[...coreSections].reverse()] }).success, true);
});

test('bounded presentation, URLs, ownership fields and aggregate size are validated', () => {
  assert.equal(resumeContentSchema.safeParse({ clerkId: 'another-owner' }).success, false);
  assert.equal(resumeContentSchema.safeParse({ presentation: { fontSize: '500px' } }).success, false);
  assert.equal(resumeContentSchema.safeParse({ contact: { website: 'javascript:alert(1)' } }).success, false);
  assert.equal(resumeContentSchema.safeParse({ customSections: Array(6).fill({ id: customId, title: 'Section', body: '' }) }).success, false);
  assert.equal(resumeContentSchema.safeParse({ experience: Array.from({ length: 20 }, () => ({ company: 'Company', role: 'Role', bullets: Array(30).fill('A'.repeat(1000)) })) }).success, false);
  assert.equal(updateResumeSchema.safeParse({ content: {} }).success, false);
});
