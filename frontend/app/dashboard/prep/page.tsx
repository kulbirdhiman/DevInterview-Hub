'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type InterviewSession, type Resume, type PrepSession, type Profile } from '@/lib/api'
import { PageHeader, Button, Field, inputClass, ErrorNote, EmptyState, card } from '@/components/dashboard/ui'
import InterviewRoom from '@/components/interviews/InterviewRoom'

export default function PracticePage() {
  const { getToken } = useAuth()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [legacy, setLegacy] = useState<PrepSession[]>([])
  const [active, setActive] = useState<InterviewSession | null>(null)
  const [resumeId, setResumeId] = useState('')
  const [role, setRole] = useState('')
  const [category, setCategory] = useState('technical')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [language, setLanguage] = useState('English')
  const [durationMinutes, setDuration] = useState(5)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [aiConfigured, setAIConfigured] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const key = useRef<string | null>(null)
  const load = useCallback(async () => {
    try {
      const [resumeData, sessionData, legacyData, profile, ai] = await Promise.all([
        apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken), apiFetch<{ sessions: InterviewSession[] }>('/api/interviews', getToken),
        apiFetch<{ sessions: PrepSession[] }>('/api/prep', getToken), apiFetch<{ user: Profile }>('/api/users/me', getToken), apiFetch<{ configured: boolean }>('/api/ai/status', getToken),
      ])
      setAIConfigured(ai.configured); setResumes(resumeData.resumes); setSessions(sessionData.sessions); setLegacy(legacyData.sessions)
      setResumeId(current => current || resumeData.resumes[0]?._id || '')
      setRole(current => current || profile.user.targetRole || resumeData.resumes[0]?.targetRole || '')
      setLanguage(profile.user.interviewLanguage || 'English'); setLoaded(true); setError('')
    } catch (error) { setError(errorMessage(error)) }
  }, [getToken])
  useEffect(() => { void load() }, [load])
  async function start() {
    setBusy(true); setError(''); key.current ??= crypto.randomUUID()
    try {
      const selected = resumes.find(resume => resume._id === resumeId)
      const data = await apiFetch<{ session: InterviewSession }>('/api/interviews', getToken, { method: 'POST', headers: { 'Idempotency-Key': key.current }, body: JSON.stringify({ resumeId, expectedRevision: selected?.revision ?? 0, role, category, difficulty, language, durationMinutes }) })
      setActive(data.session); key.current = null
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  async function open(id: string) {
    setBusy(true); setError('')
    try { const data = await apiFetch<{ session: InterviewSession }>(`/api/interviews/${id}`, getToken); setActive(data.session) }
    catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this interview, transcript and report? This cannot be undone.')) return
    try { await apiFetch(`/api/interviews/${id}`, getToken, { method: 'DELETE' }); await load() }
    catch (error) { setError(errorMessage(error)) }
  }
  if (active) return <InterviewRoom key={active._id} initial={active} onBack={() => { setActive(null); void load() }} />
  return <>
    <PageHeader title="Interview practice" description="Practice one question at a time with follow-ups based on your real resume and answers." />
    {error && <div className="mb-6 space-y-3"><ErrorNote>{error}</ErrorNote><Button variant="secondary" onClick={() => void load()}>Refresh setup and history</Button></div>}
    {aiConfigured === false && <p className="mb-5 rounded-xl border border-amber-300 p-4 text-sm">AI practice is temporarily unavailable. Your history remains accessible; resume editing and PDF export are still available. Contact an administrator to enable AI services.</p>}
    {!loaded && !error && <p role="status">Loading practice setup…</p>}
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form className={`${card} grid gap-5 p-6`} onSubmit={e => { e.preventDefault(); void start() }}>
        <h2 className="text-lg font-semibold">Set up a text interview</h2>
        <Field label="Resume"><select className={inputClass} required value={resumeId} onChange={e => { setResumeId(e.target.value); const resume = resumes.find(item => item._id === e.target.value); if (resume?.targetRole) setRole(resume.targetRole); key.current = null }}><option value="">Select a resume</option>{resumes.map(resume => <option key={resume._id} value={resume._id}>{resume.title}</option>)}</select></Field>
        <Field label="Target role"><input className={inputClass} maxLength={120} value={role} required onChange={e => { setRole(e.target.value); key.current = null }} /></Field>
        <Field label="Round"><select className={inputClass} value={category} onChange={e => { setCategory(e.target.value); key.current = null }}>{[['hr', 'HR'], ['technical', 'Technical'], ['behavioral', 'Behavioral'], ['project', 'Project discussion']].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></Field>
        <Field label="Difficulty"><select className={inputClass} value={difficulty} onChange={e => { setDifficulty(e.target.value); key.current = null }}>{['beginner', 'intermediate', 'advanced', 'expert'].map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Language"><select className={inputClass} value={language} onChange={e => { setLanguage(e.target.value); key.current = null }}><option>English</option><option>Hindi</option></select></Field>
        <Field label="Practice budget"><select className={inputClass} value={durationMinutes} onChange={e => { setDuration(Number(e.target.value)); key.current = null }}><option value={5}>5 minutes</option><option value={15}>15 minutes</option></select></Field>
        <p className="text-sm text-zinc-500">Up to six questions, with adaptive follow-ups. Your submitted text and resume snapshot are processed by the configured AI provider. No audio or video is recorded.</p>
        <Button type="submit" loading={busy} disabled={!resumeId || !loaded || aiConfigured !== true}>Start practice</Button>
      </form>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Interview history</h2>
        {loaded && !sessions.length && <EmptyState title="Your first practice starts here" description="Complete a session to see per-answer feedback and track progress." />}
        {sessions.map(session => <article key={session._id} className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}><button disabled={busy} className="min-w-0 flex-1 text-left" onClick={() => void open(session._id)}><p className="font-medium">{session.role}</p><p className="mt-1 text-sm text-zinc-500">{session.category} · {session.state.replaceAll('_', ' ')} · {session.turns.filter(turn => turn.answeredAt).length} answers</p><p className="mt-1 text-xs text-zinc-500">{new Date(session.createdAt).toLocaleString()}{session.report?.score != null ? ` · ${session.report.score}/100` : ''}</p></button><Button variant="danger" onClick={() => void remove(session._id)}>Delete</Button></article>)}
        {!!legacy.length && <details className={`${card} p-5`}><summary className="cursor-pointer font-medium">Legacy practice history ({legacy.length})</summary><p className="mt-3 text-sm text-zinc-500">Original 0–10 feedback is preserved separately and is not compared against the new rubric.</p>{legacy.map(session => <details key={session._id} className="mt-3 border-t border-zinc-200 py-3 dark:border-zinc-700"><summary className="cursor-pointer">{session.targetRole} · {new Date(session.createdAt).toLocaleDateString()}</summary>{session.questions.map(question => <div key={question._id} className="mt-4 space-y-2 text-sm"><h3 className="font-medium">{question.prompt}</h3><p className="whitespace-pre-wrap">{question.answer || 'Not answered.'}</p><p>{question.score == null ? 'Not assessed' : `${question.score}/10`}</p><p>{question.feedback}</p></div>)}</details>)}</details>}
      </section>
    </div>
  </>
}
