'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type Resume } from '@/lib/api'
import { defaultPresentation } from '@/lib/resume/content'
import { PageHeader, Button, Field, inputClass, ErrorNote, EmptyState, SkeletonList, card } from '@/components/dashboard/ui'
import ResumeView from '@/components/dashboard/ResumeView'

export default function ResumesPage() {
  const { getToken } = useAuth()
  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [selected, setSelected] = useState<Resume | null>(null)
  const [title, setTitle] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [rawInput, setRawInput] = useState('')
  const [template, setTemplate] = useState<'ats' | 'minimal' | 'developer'>('ats')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken)
      setResumes(data.resumes); setError('')
    } catch (caught) { setError(errorMessage(caught)) }
  }, [getToken])
  useEffect(() => { void load() }, [load])

  async function create(withAI: boolean) {
    setBusy(true); setError('')
    try {
      const input = { title: title.trim() || `${targetRole.trim() || 'My'} resume`, targetRole,
        presentation: { ...defaultPresentation, template }, ...(withAI ? { rawInput } : {}) }
      const data = await apiFetch<{ resume: Resume }>(withAI ? '/api/resumes/generate' : '/api/resumes', getToken, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) })
      setSelected(data.resume); setRawInput(''); await load()
    } catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }
  async function open(id: string) {
    setBusy(true); setError('')
    try { const data = await apiFetch<{ resume: Resume }>(`/api/resumes/${id}`, getToken); setSelected(data.resume) }
    catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }
  async function remove(resume: Resume) {
    if (!window.confirm(`Delete “${resume.title}”, its saved versions and analyses? Interview snapshots remain in interview history. This cannot be undone.`)) return
    setBusy(true); setError('')
    try { await apiFetch(`/api/resumes/${resume._id}`, getToken, { method: 'DELETE' }); await load() }
    catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }
  if (selected) return <ResumeView key={selected._id} resume={selected} onBack={() => { setSelected(null); void load() }} onSaved={saved => {
    setResumes(current => current?.map(item => item._id === saved._id ? saved : item) ?? null)
  }} />

  return <>
    <PageHeader title="Resume studio" description="Build your resume section by section, preview it live, and keep versions for different opportunities." />
    {error && <div className="mb-6 space-y-3"><ErrorNote>{error}</ErrorNote><Button variant="secondary" onClick={() => void load()}>Retry loading resumes</Button></div>}
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <form className={`${card} grid gap-5 p-6`} onSubmit={event => { event.preventDefault(); void create(false) }}>
        <h2 className="text-lg font-semibold">Create a resume</h2>
        <Field label="Resume title"><input className={inputClass} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="My developer resume" /></Field>
        <Field label="Target role"><input className={inputClass} maxLength={120} value={targetRole} onChange={event => setTargetRole(event.target.value)} placeholder="Full-stack developer" /></Field>
        <Field label="Starting layout" hint="Change it later without losing content."><select className={inputClass} value={template} onChange={event => setTemplate(event.target.value as typeof template)}><option value="ats">ATS-friendly</option><option value="minimal">Minimal</option><option value="developer">Developer</option></select></Field>
        <Button type="submit" loading={busy} disabled={Boolean(resumes?.length)}>Create blank resume</Button>
        {!!resumes?.length && <p className="text-sm text-zinc-500">The free beta includes one active resume with up to 30 saved versions. Open your existing resume, or delete it to create a new one.</p>}
        <details className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium">Start with an AI-assisted draft instead</summary>
          <div className="mt-5 grid gap-4">
            <Field label="Your career notes" hint="Use your actual experience. Review all generated content before using it."><textarea className={inputClass} rows={7} maxLength={30000} value={rawInput} onChange={event => setRawInput(event.target.value)} placeholder="Paste your resume text or describe your work, projects and education…" /></Field>
            <Button type="button" variant="secondary" disabled={busy || Boolean(resumes?.length) || rawInput.trim().length < 40} onClick={() => void create(true)}>Generate editable draft</Button>
          </div>
        </details>
      </form>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Your resumes</h2>
        {resumes === null ? !error && <SkeletonList rows={2} /> : !resumes.length ? <EmptyState title="Start with your own story" description="Create a blank resume and add your experience. No AI key is needed for the editor." /> : <ul className="grid gap-3">{resumes.map(resume => <li key={resume._id} className={`${card} flex items-center gap-3 p-4`}>
          <button type="button" disabled={busy} onClick={() => void open(resume._id)} className="min-w-0 flex-1 text-left disabled:opacity-50"><p className="truncate font-medium">{resume.title}</p><p className="mt-1 text-sm text-zinc-500">{resume.targetRole || 'General resume'} · {resume.versionCount ?? 0} versions</p><p className="mt-1 text-xs text-zinc-500">Updated {new Date(resume.updatedAt).toLocaleString()}</p></button>
          <Button variant="danger" disabled={busy} onClick={() => void remove(resume)} aria-label={`Delete ${resume.title}`}>Delete</Button>
        </li>)}</ul>}
      </section>
    </div>
  </>
}
