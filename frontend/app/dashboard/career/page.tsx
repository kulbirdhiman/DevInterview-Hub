'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type Resume, type ResumeContent, type Evidence, type InterviewSession } from '@/lib/api'
import { Button, ErrorNote, Field, inputClass, card, Badge } from '@/components/dashboard/ui'
import SectionEditor from '@/components/resume/SectionEditor'
import { sectionLabels } from '@/lib/resume/content'
import EvidenceDetails from '@/components/analysis/EvidenceDetails'

type CareerItem = {
  _id: string; kind: 'match' | 'rewrite' | 'import' | 'coach'; state: string; revision: number; resumeId: string; completedDays: number[]
  report?: {
    score?: number | null; coverage?: number; disclaimer?: string; evidence?: Evidence[]; preparation?: string[]
    requirements?: { requirement: string; priority: string; dimension: string; support: string; reason: string; evidenceRefs: string[] }[]
    edits?: { field: string; before: string; after: string; reason: string; evidenceRefs: string[] }[]
    days?: { day: number; exercise: string; completion: string; evidenceRefs: string[]; generalGuidance: boolean; userEdited?: boolean }[]
    content?: ResumeContent; warnings?: string[]; sourceText?: string
  }
}
const names = { match: 'Job match', rewrite: 'Reviewed rewrites', import: 'Resume import', coach: '7-day coach' }
export default function CareerPage() {
  const { getToken } = useAuth()
  const [resumes, setResumes] = useState<Resume[]>([]), [sessions, setSessions] = useState<InterviewSession[]>([])
  const [items, setItems] = useState<CareerItem[]>([]), [resumeId, setResumeId] = useState('')
  const [kind, setKind] = useState<CareerItem['kind']>('match'), [text, setText] = useState(''), [sessionIds, setSessionIds] = useState<string[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const operationKey = useRef<string | null>(null)
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken), apiFetch<{ items: CareerItem[] }>('/api/career', getToken), apiFetch<{ sessions: InterviewSession[] }>('/api/interviews', getToken)])
    setResumes(a.resumes); setResumeId(value => value || a.resumes[0]?._id || ''); setItems(b.items); setSessions(c.sessions.filter(s => s.state === 'completed'))
  }, [getToken])
  useEffect(() => { void load().catch(e => setError(errorMessage(e))) }, [load])
  const pending = items.some(item => item.state === 'pending')
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => { void load().catch(e => setError(errorMessage(e))) }, 2500)
    return () => clearInterval(timer)
  }, [pending, load])
  const selected = resumes.find(resume => resume._id === resumeId)
  async function generate() {
    if (!selected) return
    setBusy(true); setError(''); operationKey.current ??= crypto.randomUUID()
    try {
      await apiFetch('/api/career', getToken, { method: 'POST', headers: { 'Idempotency-Key': operationKey.current }, body: JSON.stringify({ kind, resumeId, expectedRevision: selected.revision, text, sessionIds: kind === 'coach' ? sessionIds : [] }) })
      operationKey.current = null; await load()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <h1 className="text-3xl font-semibold">Career tools</h1>
    <p className="text-zinc-500">Connect your resume to a role, review truthful edits, and practice with a grounded plan. Educational guidance; scores do not predict hiring.</p>
    {error && <ErrorNote>{error}</ErrorNote>}
    <section className={`${card} space-y-5 p-6`}>
      <div className="flex flex-wrap gap-2">{Object.entries(names).map(([value, label]) => <Button key={value} variant={kind === value ? 'primary' : 'secondary'} onClick={() => { setKind(value as CareerItem['kind']); operationKey.current = null }}>{label}</Button>)}</div>
      <Field label="Saved resume"><select className={inputClass} value={resumeId} onChange={e => { setResumeId(e.target.value); operationKey.current = null }}><option value="">Select a resume</option>{resumes.map(resume => <option key={resume._id} value={resume._id}>{resume.title} · revision {resume.revision}</option>)}</select></Field>
      {(kind === 'match' || kind === 'import') && <Field label={kind === 'match' ? 'Paste the job description' : 'Paste resume text'} hint="40–30,000 characters. Source text is sent to the configured AI provider."><textarea className={inputClass} rows={8} maxLength={30000} value={text} onChange={e => { setText(e.target.value); operationKey.current = null }} /></Field>}
      {kind === 'import' && <Field label="Or choose a UTF-8 .txt file" hint="Text-only import, up to 30 KB. PDF/DOCX and OCR are not supported."><input type="file" accept=".txt,text/plain" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return
        try { if (!file.name.toLowerCase().endsWith('.txt') || file.size > 30000) throw new Error('Choose a UTF-8 .txt file of at most 30 KB.')
          const value = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); if (value.includes('\0')) throw new Error('Binary files are not supported.'); setText(value); operationKey.current = null
        } catch (err) { setError(errorMessage(err)) }
      }} /></Field>}
      {kind === 'coach' && <fieldset className="space-y-2"><legend className="font-medium">Completed interviews (optional, up to five)</legend>{sessions.map(session => <label className="block text-sm" key={session._id}><input type="checkbox" checked={sessionIds.includes(session._id)} disabled={!sessionIds.includes(session._id) && sessionIds.length >= 5} onChange={e => { setSessionIds(current => e.target.checked ? [...current, session._id] : current.filter(id => id !== session._id)); operationKey.current = null }} /> {session.role} · {session.category} · {new Date(session.createdAt).toLocaleDateString()}</label>)}</fieldset>}
      <p className="text-sm text-zinc-500">Uses frozen resume evidence and selected evaluated answers. Import sends the supplied text, which may contain contact details. Review personal information before submitting. Eight career tasks per UTC month, subject to provider-call allowance.</p>
      <Button disabled={!selected || busy || (['match', 'import'].includes(kind) && text.trim().length < 40)} loading={busy} onClick={() => void generate()}>Generate {names[kind].toLowerCase()}</Button>
    </section>
    <h2 className="text-xl font-semibold">Saved results</h2>
    {items.map(item => <CareerResult key={`${item._id}:${item.state}`} item={item} onChange={load} />)}
    {!items.length && <p className="text-zinc-500">Your results and review drafts will appear here.</p>}
  </main>
}
function CareerResult({ item, onChange }: { item: CareerItem; onChange: () => Promise<void> }) {
  const { getToken } = useAuth()
  const [selected, setSelected] = useState<number[]>([]), [draft, setDraft] = useState<ResumeContent | null>(item.report?.content ?? null)
  const [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true); setError('')
    try { await apiFetch(`/api/career/${item._id}${path}`, getToken, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); await onChange() }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const report = item.report
  return <article className={`${card} space-y-4 p-6`}>
    <div className="flex justify-between gap-4"><h3 className="text-lg font-semibold">{names[item.kind]} · revision {item.revision}</h3><Badge>{item.state}</Badge></div>
    {item.state === 'pending' && <p role="status">Processing. You can leave and return to this saved task.</p>}
    {item.state === 'failed' && <p>Processing failed after bounded retries. Your allowance was released. Create a new request or ask an administrator to retry.</p>}
    {error && <ErrorNote>{error}</ErrorNote>}
    {report?.requirements && <>
      <p className="text-xl font-semibold">{report.score ?? 'Partial'}{report.score != null ? '/100' : ''} · {report.coverage}% dimension coverage</p>
      <p className="text-sm text-zinc-500">Requirement evidence 50%, scope 25%, responsibilities 15%, terminology 10%. Supported = 1, partial = 0.5, missing = 0; unclear excluded. Assessed weights are renormalized; scores need 70% dimension coverage.</p>
      {report.requirements.map((row, index) => <div key={index} className="space-y-2 border-t border-zinc-200 py-3 dark:border-zinc-800"><p className="font-medium">{row.requirement}</p><p className="text-sm">{row.priority} · {row.dimension} · {row.support}</p><p>{row.reason}</p><EvidenceDetails refs={row.evidenceRefs} evidence={report.evidence ?? []} /></div>)}
      <p className="text-sm text-zinc-500">{report.disclaimer}</p>
      {report.preparation?.map((text, index) => <p key={index}>• {text}</p>)}
    </>}
    {report?.edits?.map((edit, index) => <div key={index} className="space-y-2 border-t py-3"><label className="font-medium"><input type="checkbox" checked={selected.includes(index)} onChange={e => setSelected(current => e.target.checked ? [...current, index] : current.filter(i => i !== index))} /> Approve {edit.field}</label><p className="text-sm text-zinc-500">Before: {edit.before || '(empty)'}</p><p>Proposed: {edit.after}</p><p>{edit.reason}</p><EvidenceDetails refs={edit.evidenceRefs} evidence={report.evidence ?? []} /></div>)}
    {report?.content && draft && <><details><summary className="cursor-pointer font-medium">Original imported text</summary><p className="mt-3 whitespace-pre-wrap text-sm">{report.sourceText}</p></details><p>Review and correct every extracted fact below. Applying replaces the saved content and preserves a checkpoint. Leave uncertain facts empty.</p>{report.warnings?.map((warning, index) => <p key={index} className="text-amber-700">{warning}</p>)}
      {(['title', 'fullName', 'targetRole', 'headline'] as const).map(field => <Field key={field} label={{ title: 'Resume title', fullName: 'Full name', targetRole: 'Target role', headline: 'Headline' }[field]}><input className={inputClass} value={draft[field]} onChange={e => { setDraft({ ...draft, [field]: e.target.value }); setReviewed(false) }} /></Field>)}
      <details><summary className="cursor-pointer font-medium">Contact details</summary><div className="mt-3 space-y-3">{Object.entries(draft.contact).map(([field, value]) => <Field key={field} label={field}><input className={inputClass} value={value} onChange={e => { setDraft({ ...draft, contact: { ...draft.contact, [field]: e.target.value } }); setReviewed(false) }} /></Field>)}</div></details>
      {draft.sectionOrder.map(section => <details key={section}><summary className="cursor-pointer font-medium">{sectionLabels[section] ?? draft.customSections.find(row => `custom:${row.id}` === section)?.title ?? section}</summary><div className="mt-3"><SectionEditor sectionKey={section} content={draft} onChange={change => { setDraft(current => current ? change(current) : current); setReviewed(false) }} /></div></details>)}
    </>}
    {report && ['rewrite', 'import'].includes(item.kind) && <><label className="block text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /> I reviewed the proposed facts and approve these changes.</label><Button disabled={busy || !reviewed || (item.kind === 'rewrite' && !selected.length)} onClick={() => { void action('/apply', 'POST', { expectedRevision: item.revision, edits: selected, confirmation: 'REVIEWED', ...(item.kind === 'import' ? { content: draft } : {}) }) }}>Apply reviewed changes with checkpoint</Button></>}
    {report?.days?.slice().sort((a, b) => a.day - b.day).map(day => <div key={day.day} className="space-y-2 border-t py-3"><label className="font-medium"><input type="checkbox" disabled={busy} checked={item.completedDays.includes(day.day)} onChange={e => void action('/progress', 'PATCH', { completedDays: e.target.checked ? [...item.completedDays, day.day] : item.completedDays.filter(value => value !== day.day) })} /> Day {day.day}: {day.exercise}</label><p>Done when: {day.completion}</p>{day.userEdited && <Badge>Edited by you</Badge>}<details><summary className="cursor-pointer text-sm">Edit this exercise</summary><form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void action(`/days/${day.day}`, 'PATCH', { exercise: fields.get('exercise'), completion: fields.get('completion') }) }}><Field label="Exercise"><textarea className={inputClass} name="exercise" defaultValue={day.exercise} required maxLength={1500} /></Field><Field label="Completion criterion"><textarea className={inputClass} name="completion" defaultValue={day.completion} required maxLength={1500} /></Field><Button type="submit" disabled={busy}>Save exercise</Button></form></details>{day.generalGuidance && <Badge>General guidance</Badge>}<EvidenceDetails refs={day.evidenceRefs} evidence={report.evidence ?? []} /></div>)}
    <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm('Delete this saved result?')) void action('', 'DELETE') }}>Delete result</Button>
  </article>
}
