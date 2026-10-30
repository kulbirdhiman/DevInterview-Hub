'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type ResumeAnalysis } from '@/lib/api'
import { Button, ErrorNote, Field, inputClass, card } from '@/components/dashboard/ui'
import EvidenceDetails from './EvidenceDetails'

export default function ResumeAnalysisPanel({ resumeId, revision, flush, getRevision }: { resumeId: string; revision: number; flush: () => Promise<void>; getRevision: () => number }) {
  const { getToken } = useAuth()
  const [history, setHistory] = useState<ResumeAnalysis[]>([])
  const [active, setActive] = useState<ResumeAnalysis | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiConfigured, setAIConfigured] = useState<boolean | null>(null)
  const key = useRef<string | null>(null)
  const load = useCallback(async () => {
    try { const [data, ai] = await Promise.all([apiFetch<{ analyses: ResumeAnalysis[] }>(`/api/resumes/${resumeId}/analyses`, getToken), apiFetch<{ configured: boolean }>('/api/ai/status', getToken)]); setAIConfigured(ai.configured); setHistory(data.analyses); setActive(data.analyses[0] ?? null); setError('') }
    catch (error) { setError(errorMessage(error)) }
  }, [resumeId, getToken])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (active?.state !== 'pending') return
    let canceled = false
    const poll = async () => {
      try { const data = await apiFetch<{ analysis: ResumeAnalysis }>(`/api/analyses/${active._id}`, getToken); if (!canceled) { setActive(data.analysis); setError('') } }
      catch (error) { if (!canceled) setError(errorMessage(error)) }
    }
    const timer = window.setInterval(() => void poll(), 2000)
    return () => { canceled = true; window.clearInterval(timer) }
  }, [active?._id, active?.state, getToken])
  async function analyze() {
    setBusy(true); setError('')
    try {
      await flush(); key.current ??= crypto.randomUUID()
      const data = await apiFetch<{ analysis: ResumeAnalysis }>(`/api/resumes/${resumeId}/analyses`, getToken, { method: 'POST', headers: { 'Idempotency-Key': key.current }, body: JSON.stringify({ expectedRevision: getRevision() }) })
      setActive(data.analysis); setHistory(rows => [data.analysis, ...rows.filter(row => row._id !== data.analysis._id)]); key.current = null
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const report = active?.report
  return <section id="resume-analysis" className={`${card} space-y-4 p-5`}>
    <h2 className="text-lg font-semibold">Resume quality analysis</h2>
    <p className="text-sm text-zinc-500">Evidence-based educational feedback. This is not an official ATS score or a prediction of interview selection.</p>
    <Button loading={busy} disabled={aiConfigured !== true || active?.state === 'pending'} onClick={() => void analyze()}>Analyze saved resume</Button>
    {aiConfigured === false && <p className="text-sm text-amber-700 dark:text-amber-300">AI analysis is currently unavailable. You can continue editing and exporting PDFs. Contact an administrator to enable AI services.</p>}
    {error && <ErrorNote>{error}</ErrorNote>}
    {active?.state === 'pending' && <p role="status">Analysis queued or running. You can leave and return; your request is saved.</p>}
    {active?.state === 'failed' && <ErrorNote>Analysis could not finish after bounded retries. Your resume is unchanged; the analysis allowance was released. Start a new analysis or contact support.</ErrorNote>}
    {history.length > 1 && <Field label="Analysis history"><select className={inputClass} value={active?._id ?? ''} onChange={e => { const selected = history.find(row => row._id === e.target.value); if (selected) setActive(selected) }}>{history.map(item => <option key={item._id} value={item._id}>Revision {item.revision} · {new Date(item.createdAt).toLocaleString()}</option>)}</select></Field>}
    {active && active.revision !== revision && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">This report uses revision {active.revision}. The current resume is revision {revision}; analyze again for updated feedback.</p>}
    {report && <>
      <p className="text-3xl font-semibold">{report.score === null ? 'Not assessed' : `${report.score}/100`}</p>
      <p className="text-xs text-zinc-500">{report.rubricVersion} · {report.coverage}% rubric coverage</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Weighted resume rubric</caption><thead><tr><th className="py-2">Dimension</th><th>Weight</th><th>Rating</th></tr></thead><tbody>{report.dimensions.map(item => <tr key={item.key} className="border-t border-zinc-200 dark:border-zinc-700"><td className="py-3 pr-3"><strong className="capitalize">{item.key}</strong><p className="mt-1 font-normal text-zinc-500">{item.reason}</p><EvidenceDetails refs={item.evidenceRefs} evidence={report.evidence} /></td><td>{item.weight}%</td><td>{item.assessed ? `${item.rating}/4` : 'Not assessed'}</td></tr>)}</tbody></table></div>
      <details className="text-sm"><summary className="cursor-pointer">How the score works</summary><p className="mt-2">Ratings: 0 absent/unusable, 1 major gaps, 2 adequate, 3 strong, 4 clear and well supported. The server calculates the weighted total. Unassessed dimensions are excluded and weights renormalized; totals need at least 70% coverage. True qualitative outcomes are valid, and missing numbers are not permission to invent them.</p></details>
      <h3 className="font-semibold">Strengths</h3>
      {!report.strengths.length && <p className="text-sm text-zinc-500">No supported strengths identified in this analysis.</p>}
      {report.strengths.map((item, index) => <div key={index} className="rounded-xl border border-emerald-200 p-3 dark:border-emerald-900"><h4 className="font-medium">{item.title}</h4><p className="mt-1 text-sm">{item.detail}</p><EvidenceDetails refs={item.evidenceRefs} evidence={report.evidence} /></div>)}
      <h3 className="font-semibold">Issues and suggestions</h3>
      {!report.issues.length && <p className="text-sm text-zinc-500">No issues identified by this analysis.</p>}
      {report.issues.map((item, index) => <div key={index} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><p className="text-xs font-semibold uppercase">{item.severity}</p><h4 className="mt-1 font-medium">{item.title}</h4><p className="mt-1 text-sm">{item.detail}</p><p className="mt-2 text-sm"><strong>Next step:</strong> {item.suggestion}</p><EvidenceDetails refs={item.evidenceRefs} evidence={report.evidence} /></div>)}
      <details className="text-sm"><summary className="cursor-pointer">Limitations</summary><ul className="mt-2 list-disc space-y-2 pl-5">{report.limitations.map(value => <li key={value}>{value}</li>)}</ul></details>
    </>}
  </section>
}
