import type { Resume, ResumeContent } from '@/lib/api'

export const coreSections = ['summary', 'experience', 'projects', 'skills', 'education', 'certifications', 'achievements'] as const
export const sectionLabels: Record<string, string> = {
  summary: 'Summary', experience: 'Experience', projects: 'Projects', skills: 'Skills',
  education: 'Education', certifications: 'Certifications', achievements: 'Achievements',
}
export const defaultPresentation: ResumeContent['presentation'] = { template: 'classic', font: 'sans', fontSize: 'medium', spacing: 'comfortable', color: 'emerald' }
const defaultContact: ResumeContent['contact'] = { email: '', phone: '', location: '', website: '', linkedin: '', github: '' }

/** Normalize older saved resumes without rewriting their content. */
export function resumeContent(resume: Partial<ResumeContent>): ResumeContent {
  const customSections = resume.customSections ?? []
  return {
    title: resume.title ?? 'Untitled resume', targetRole: resume.targetRole ?? '',
    fullName: resume.fullName ?? '', headline: resume.headline ?? '', summary: resume.summary ?? '',
    contact: { ...defaultContact, ...resume.contact }, skills: resume.skills ?? [],
    experience: resume.experience ?? [], projects: resume.projects ?? [], education: resume.education ?? [],
    certifications: resume.certifications ?? [], achievements: resume.achievements ?? [], customSections,
    sectionOrder: resume.sectionOrder?.length ? resume.sectionOrder : [...coreSections, ...customSections.map(section => `custom:${section.id}`)],
    presentation: { ...defaultPresentation, ...resume.presentation },
  }
}
export function normalizeResume(resume: Resume): Resume {
  return { ...resume, ...resumeContent(resume), revision: resume.revision ?? 0, versionCount: resume.versionCount ?? 0 }
}
