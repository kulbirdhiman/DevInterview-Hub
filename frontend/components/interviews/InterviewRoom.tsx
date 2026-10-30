'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type InterviewSession, type InterviewTurn } from '@/lib/api'
import { Button, ErrorNote, Field, inputClass, card, Badge } from '@/components/dashboard/ui'
import EvidenceDetails from '@/components/analysis/EvidenceDetails'
import InterviewReport from './InterviewReport'

export default function InterviewRoom({ initial, onBack }: { initial: InterviewSession; onBack: () => void }) {
  const { getToken } = useAuth()
  const [session, setSession] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const load = useCallback(async () => {
    const data = await apiFetch<{ session: InterviewSession }>(`/api/interviews/${initial._id}`, getToken)
    setSession(data.session); setError('')
  }, [initial._id, getToken])
  useEffect(() => {
    if (!['preparing', 'processing'].includes(session.state)) return
    let canceled = false
    const timer = window.setInterval(() => {
      apiFetch<{ session: InterviewSession }>(`/api/interviews/${initial._id}`, getToken).then(data => { if (!canceled) { setSession(data.session); setError('') } }).catch(error => { if (!canceled) setError(errorMessage(error)) })
    }, 2000)
    return () => { canceled = true; window.clearInterval(timer) }
  }, [initial._id, session.state, getToken])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (!hasDraft) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasDraft])
  async function control(action: 'pause' | 'resume' | 'end') {
    if (action === 'end' && !window.confirm('End this practice session and create a report from the answers already submitted? Unsubmitted text is not included.')) return
    setBusy(true); setError('')
    try { const data = await apiFetch<{ session: InterviewSession }>(`/api/interviews/${session._id}/${action}`, getToken, { method: 'POST', body: JSON.stringify({ expectedRevision: session.revision }) }); setSession(data.session); if (action === 'end') setHasDraft(false) }
    catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  const current = session.turns.at(-1)
  const elapsed = Math.floor((session.activeMs + (session.lastActiveAt ? Math.max(0, now - new Date(session.lastActiveAt).getTime()) : 0)) / 1000)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={() => { if (!hasDraft || window.confirm('Leave this session? Submitted answers are saved; the text you have not submitted will be lost.')) onBack() }}>← All sessions</Button><p className="text-sm text-zinc-500">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} active time · {session.durationMinutes}-minute budget</p></div>
    <div className="flex flex-wrap gap-2"><Badge>{session.category}</Badge><Badge>{session.difficulty}</Badge><Badge>{session.language}</Badge><Badge>{session.state.replaceAll('_', ' ')}</Badge></div>
    <h1 className="text-2xl font-semibold">{session.role} practice</h1><p className="text-sm text-zinc-500">Based on frozen resume revision {session.resumeRevision}. Pauses and AI processing do not count toward active practice time.</p>
    {error && <div className="space-y-3"><ErrorNote>{error}</ErrorNote><Button variant="secondary" disabled={busy} onClick={() => { if (!hasDraft || window.confirm('Reload the session? Keep a copy of unsubmitted text first.')) void load().catch(error => setError(errorMessage(error))) }}>Refresh session</Button></div>}
    {session.state === 'preparing' && <p role="status" className={`${card} p-6`}>Preparing your opening question. This session is saved; you can leave and return.</p>}
    {session.state === 'processing' && <p role="status" className={`${card} p-6`}>{session.endRequested ? 'Finishing feedback for your submitted answer before closing…' : 'Your answer is saved. Evaluating it and preparing a relevant follow-up…'}</p>}
    {session.state === 'failed' && <ErrorNote>Processing failed after bounded retries. Submitted answers are preserved below. End the session for a partial report, or ask an administrator to retry the failed task.</ErrorNote>}
    {(session.state === 'awaiting_answer' || session.state === 'paused') && current && <article className={`${card} space-y-5 p-6`}>
      <p className="text-sm text-zinc-500">Question {session.turns.length} of up to {session.maxQuestions} · {current.intent === 'followup' ? 'Follow-up to your answer' : 'Resume-grounded topic'} · {current.difficulty}</p>
      <h2 className="text-xl font-semibold leading-relaxed">{current.prompt}</h2>
      <EvidenceDetails refs={current.sourceRefs} evidence={session.evidence} />
      {elapsed >= session.durationMinutes * 60 && <p className="text-sm text-amber-700 dark:text-amber-300">Your practice budget is reached. Submit this last answer or end the session.</p>}
      <AnswerForm key={current._id} turn={current} session={session} disabled={busy || session.state === 'paused'} onDirty={setHasDraft} onAccepted={value => { setSession(value); setHasDraft(false) }} />
    </article>}
    {session.state !== 'completed' && <div className="flex flex-wrap gap-3">
      {session.state === 'awaiting_answer' && <Button variant="secondary" disabled={busy} onClick={() => void control('pause')}>Pause</Button>}
      {session.state === 'paused' && <Button disabled={busy} onClick={() => void control('resume')}>Resume</Button>}
      <Button variant="danger" disabled={busy || session.endRequested} onClick={() => void control('end')}>{session.state === 'failed' ? 'End and view partial report' : 'End interview'}</Button>
    </div>}
    <InterviewReport session={session} />
  </div>
}
function AnswerForm({ turn, session, disabled, onDirty, onAccepted }: { turn: InterviewTurn; session: InterviewSession; disabled: boolean; onDirty: (dirty: boolean) => void; onAccepted: (session: InterviewSession) => void }) {
  const { getToken } = useAuth()
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const key = useRef<string | null>(null)
  async function submit(value: string) {
    setBusy(true); setError(''); key.current ??= crypto.randomUUID()
    try {
      const data = await apiFetch<{ session: InterviewSession }>(`/api/interviews/${session._id}/answers`, getToken, { method: 'POST', body: JSON.stringify({ expectedRevision: session.revision, questionId: turn._id, submissionKey: key.current, answer: value }) })
      onAccepted(data.session)
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(answer) }}>
    <Field label="Your answer" hint="Up to 5,000 characters. Submit when you have finished; the interviewer will wait."><textarea className={inputClass} rows={8} maxLength={5000} value={answer} disabled={disabled || busy} onChange={e => { setAnswer(e.target.value); onDirty(Boolean(e.target.value)) }} /></Field>
    {error && <ErrorNote>{error}</ErrorNote>}
    <div className="flex flex-wrap gap-3"><Button type="submit" loading={busy} disabled={disabled || !answer.trim()}>Submit answer</Button><Button type="button" variant="secondary" disabled={disabled || busy} onClick={() => void submit('')}>Skip question (no credit)</Button></div>
  </form>
}
