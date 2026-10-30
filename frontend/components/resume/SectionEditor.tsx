'use client'

import type { ResumeContent } from '@/lib/api'
import { Button, Field, inputClass } from '@/components/dashboard/ui'

type ListKey = 'experience' | 'projects' | 'education' | 'certifications' | 'achievements'
type Entry = { id?: string; [key: string]: string | string[] | undefined }
type Specification = { key: string; label: string; max: number; multiline?: boolean; list?: 'lines' | 'commas' }
const definitions: Record<ListKey, { empty: Entry; fields: Specification[] }> = {
  experience: { empty: { company: '', role: '', start: '', end: '', bullets: [] }, fields: [
    { key: 'role', label: 'Role', max: 200 }, { key: 'company', label: 'Employer', max: 200 },
    { key: 'start', label: 'Start date', max: 40 }, { key: 'end', label: 'End date or Present', max: 40 },
    { key: 'bullets', label: 'Responsibilities and impact (one bullet per line)', max: 30000, multiline: true, list: 'lines' },
  ] },
  projects: { empty: { name: '', description: '', tech: [], link: '' }, fields: [
    { key: 'name', label: 'Project name', max: 200 }, { key: 'description', label: 'Description', max: 3000, multiline: true },
    { key: 'tech', label: 'Technologies (comma separated)', max: 2400, list: 'commas' }, { key: 'link', label: 'Project URL', max: 500 },
  ] },
  education: { empty: { school: '', degree: '', year: '' }, fields: [
    { key: 'school', label: 'Institution', max: 200 }, { key: 'degree', label: 'Qualification', max: 200 }, { key: 'year', label: 'Dates or graduation year', max: 60 },
  ] },
  certifications: { empty: { name: '', issuer: '', date: '', link: '' }, fields: [
    { key: 'name', label: 'Certification', max: 200 }, { key: 'issuer', label: 'Issuer', max: 200 }, { key: 'date', label: 'Date', max: 60 }, { key: 'link', label: 'Credential URL', max: 500 },
  ] },
  achievements: { empty: { title: '', description: '', date: '' }, fields: [
    { key: 'title', label: 'Achievement', max: 200 }, { key: 'description', label: 'Description', max: 2000, multiline: true }, { key: 'date', label: 'Date', max: 60 },
  ] },
}

export default function SectionEditor({ sectionKey, content, onChange }: {
  sectionKey: string; content: ResumeContent; onChange: (change: (draft: ResumeContent) => ResumeContent) => void
}) {
  if (sectionKey === 'summary') return <Field label="Professional summary"><textarea className={inputClass} rows={6} maxLength={4000} value={content.summary} onChange={e => onChange(d => ({ ...d, summary: e.target.value }))} /></Field>
  if (sectionKey === 'skills') return <Field label="Skills" hint="Comma separated, up to 50 skills. Include only skills you can discuss."><textarea className={inputClass} rows={4} maxLength={4000} value={content.skills.join(',')} onChange={e => onChange(d => ({ ...d, skills: e.target.value.split(',') }))} /></Field>
  if (sectionKey.startsWith('custom:')) {
    const id = sectionKey.slice(7)
    const section = content.customSections.find(item => item.id === id)
    if (!section) return null
    return <div className="grid gap-4">
      <Field label="Section title"><input className={inputClass} maxLength={80} value={section.title} onChange={e => onChange(d => ({ ...d, customSections: d.customSections.map(item => item.id === id ? { ...item, title: e.target.value } : item) }))} /></Field>
      <Field label="Section content"><textarea className={inputClass} rows={7} maxLength={4000} value={section.body} onChange={e => onChange(d => ({ ...d, customSections: d.customSections.map(item => item.id === id ? { ...item, body: e.target.value } : item) }))} /></Field>
      <Button variant="danger" onClick={() => { if (window.confirm(`Remove “${section.title}” and its content?`)) onChange(d => ({ ...d, customSections: d.customSections.filter(item => item.id !== id), sectionOrder: d.sectionOrder.filter(key => key !== sectionKey) })) }}>Remove custom section</Button>
    </div>
  }
  const key = sectionKey as ListKey
  const spec = definitions[key]
  if (!spec) return null
  const entries = content[key] as Entry[]
  function setEntries(next: Entry[]) { onChange(d => ({ ...d, [key]: next })) }
  function move(index: number, delta: number) {
    const next = [...entries]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    setEntries(next)
  }
  return <div className="grid gap-5">
    {!entries.length && <p className="text-sm text-zinc-500">No entries yet. Empty sections are omitted from the preview.</p>}
    {entries.map((entry, index) => <fieldset className="min-w-0 space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700" key={entry.id ?? index}>
      <legend className="px-1 text-sm font-medium">Entry {index + 1}</legend>
      {spec.fields.map(field => {
        const raw = entry[field.key]
        const value = Array.isArray(raw) ? raw.join(field.list === 'lines' ? '\n' : ',') : raw ?? ''
        const change = (input: string) => setEntries(entries.map((item, i) => i === index ? { ...item, [field.key]: field.list ? input.split(field.list === 'lines' ? '\n' : ',') : input } : item))
        return <Field key={field.key} label={field.label}>{field.multiline ? <textarea className={inputClass} rows={4} maxLength={field.max} value={value} onChange={e => change(e.target.value)} /> : <input className={inputClass} maxLength={field.max} value={value} placeholder={field.key === 'link' ? 'https://…' : undefined} onChange={e => change(e.target.value)} />}</Field>
      })}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move entry ${index + 1} up`}>↑</Button>
        <Button variant="secondary" disabled={index === entries.length - 1} onClick={() => move(index, 1)} aria-label={`Move entry ${index + 1} down`}>↓</Button>
        <Button variant="danger" onClick={() => { if (window.confirm('Remove this entry and its content?')) setEntries(entries.filter((_, i) => i !== index)) }}>Remove entry</Button>
      </div>
    </fieldset>)}
    <Button variant="secondary" disabled={entries.length >= 20} onClick={() => setEntries([...entries, { ...spec.empty, id: crypto.randomUUID() }])}>Add entry{entries.length >= 20 ? ' (limit reached)' : ''}</Button>
  </div>
}
