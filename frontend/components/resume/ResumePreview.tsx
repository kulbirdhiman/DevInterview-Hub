import type { CSSProperties, ReactNode } from 'react'
import type { ResumeContent } from '@/lib/api'
import { sectionLabels } from '@/lib/resume/content'

const colors = { slate: '#334155', emerald: '#047857', blue: '#1d4ed8', burgundy: '#9f1239' }
const fonts = { sans: 'Arial, Helvetica, sans-serif', serif: 'Georgia, serif', mono: 'Courier New, monospace' }
const gaps = { compact: 14, comfortable: 22, spacious: 30 }

export default function ResumePreview({ content }: { content: ResumeContent }) {
  const theme = content.presentation
  const style = { '--resume-accent': colors[theme.color], fontFamily: fonts[theme.font], fontSize: { small: 12, medium: 14, large: 16 }[theme.fontSize], lineHeight: 1.6 } as CSSProperties
  const link = (href: string, label?: string) => /^https?:\/\//i.test(href.trim()) ? <a className="underline underline-offset-2" href={href.trim()} target="_blank" rel="noreferrer">{label || href}</a> : <span>{label || href}</span>
  const bullets = (items: string[]) => <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item, index) => item.trim() ? <li key={index}>{item}</li> : null)}</ul>
  const block = (key: string): ReactNode => {
    switch (key) {
      case 'summary': return content.summary.trim() ? <p className="whitespace-pre-wrap">{content.summary}</p> : null
      case 'skills': return content.skills.some(skill => skill.trim()) ? <p>{content.skills.map(s => s.trim()).filter(Boolean).join(' · ')}</p> : null
      case 'experience': return content.experience.length ? content.experience.map((item, index) => <div key={item.id ?? index} className="mb-4 break-inside-avoid last:mb-0"><div className="flex flex-wrap justify-between gap-x-4"><strong>{item.role}{item.company && ` · ${item.company}`}</strong><span>{[item.start, item.end].filter(Boolean).join(' – ')}</span></div>{bullets(item.bullets)}</div>) : null
      case 'projects': return content.projects.length ? content.projects.map((item, index) => <div key={item.id ?? index} className="mb-4 break-inside-avoid last:mb-0"><strong>{item.link ? link(item.link, item.name || 'Project') : item.name}</strong><p className="whitespace-pre-wrap">{item.description}</p>{item.tech.some(s => s.trim()) && <p className="mt-1 text-xs">{item.tech.map(s => s.trim()).filter(Boolean).join(' · ')}</p>}</div>) : null
      case 'education': return content.education.length ? content.education.map((item, index) => <div key={item.id ?? index} className="mb-3 break-inside-avoid last:mb-0"><strong>{item.degree}</strong><p>{[item.school, item.year].filter(Boolean).join(' · ')}</p></div>) : null
      case 'certifications': return content.certifications.length ? content.certifications.map((item, index) => <div key={item.id ?? index} className="mb-3 break-inside-avoid last:mb-0"><strong>{item.link ? link(item.link, item.name || 'Certification') : item.name}</strong><p>{[item.issuer, item.date].filter(Boolean).join(' · ')}</p></div>) : null
      case 'achievements': return content.achievements.length ? content.achievements.map((item, index) => <div key={item.id ?? index} className="mb-3 break-inside-avoid last:mb-0"><strong>{item.title}</strong>{item.date && <span> · {item.date}</span>}<p className="whitespace-pre-wrap">{item.description}</p></div>) : null
      default: {
        const custom = content.customSections.find(section => `custom:${section.id}` === key)
        return custom?.body.trim() ? <p className="whitespace-pre-wrap">{custom.body}</p> : null
      }
    }
  }
  return <article id="resume-preview" style={style} className="resume-preview min-h-[700px] [overflow-wrap:anywhere] rounded-sm border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
    <header className={theme.template === 'modern' ? 'border-l-4 border-[var(--resume-accent)] pl-5' : theme.template === 'minimal' ? '' : 'border-b-2 border-[var(--resume-accent)] pb-5'}>
      <h2 className="text-[2em] leading-tight font-bold">{content.fullName || 'Your name'}</h2>
      {content.headline && <p className="mt-2 text-[1.15em] text-[var(--resume-accent)]">{content.headline}</p>}
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.88em]">{[content.contact.email, content.contact.phone, content.contact.location].filter(Boolean).map((value, index) => <span key={index}>{value}</span>)}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.88em]">{(['website', 'linkedin', 'github'] as const).map(key => content.contact[key] && <span key={key}>{link(content.contact[key])}</span>)}</div>
    </header>
    {content.sectionOrder.map(key => {
      const body = block(key)
      if (!body) return null
      const title = sectionLabels[key] ?? content.customSections.find(section => `custom:${section.id}` === key)?.title ?? 'Custom section'
      return <section key={key} style={{ marginTop: gaps[theme.spacing] }}><h3 className={`mb-2 text-[0.95em] font-bold text-[var(--resume-accent)] ${theme.template === 'minimal' ? '' : 'border-b border-zinc-200 pb-1 uppercase tracking-wide'}`}>{title}</h3>{body}</section>
    })}
  </article>
}
