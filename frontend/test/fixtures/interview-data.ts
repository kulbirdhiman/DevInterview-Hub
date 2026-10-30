import type { InterviewSession } from '../../lib/api'
export const interviewFixture: InterviewSession = {
  _id: 'abcdefabcdefabcdefabcdef', role: 'Developer', category: 'technical', difficulty: 'intermediate', language: 'English', state: 'awaiting_answer',
  revision: 1, resumeRevision: 0, createdAt: new Date().toISOString(), activeMs: 0, lastActiveAt: new Date().toISOString(), durationMinutes: 15, maxQuestions: 6, endRequested: false,
  evidence: [{ id: 'summary', section: 'summary', text: 'Built an internal TypeScript tool.' }],
  turns: [{ _id: '111111111111111111111111', prompt: 'Explain the architecture of the internal tool on your resume.', intent: 'topic', difficulty: 'intermediate', sourceRefs: ['summary'], expectedEvidence: ['Hidden criteria for the opening question'] }],
}
