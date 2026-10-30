'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { apiFetch, errorMessage, type DashboardStats } from '@/lib/api'
import { PageHeader, Field, inputClass, Button, card, ErrorNote } from '@/components/dashboard/ui'

export default function DashboardOverview() {
  const { getToken } = useAuth(), { user } = useUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [category, setCategory] = useState('technical')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const data = await apiFetch<{ stats: DashboardStats }>('/api/dashboard', getToken); setStats(data.stats); setError('') }
    catch (error) { setError(errorMessage(error)) }
  }, [getToken])
  useEffect(() => {
    let canceled = false
    apiFetch<{ stats: DashboardStats }>('/api/dashboard', getToken).then(data => { if (!canceled) setStats(data.stats) }).catch(error => { if (!canceled) setError(errorMessage(error)) })
    return () => { canceled = true }
  }, [getToken])
  const series = stats?.series.filter(item => item.category === category) ?? []
  const average = series.length ? Math.round(series.reduce((sum, item) => sum + item.score, 0) / series.length) : null
  const tiles = [
    ['Resumes', stats?.resumeCount], ['Completed interviews', stats?.completedInterviews],
    ['Latest resume quality', stats?.latestResumeScore == null ? 'Not assessed' : `${stats.latestResumeScore}/100${stats.latestResumeStale ? ' (older revision)' : ''}`],
    [`Average ${category} score`, average == null ? 'Not assessed' : `${average}/100`],
  ]
  const points = series.map((item, index) => ({ x: 35 + (series.length > 1 ? index / (series.length - 1) * 430 : 215), y: 160 - item.score * 1.35, ...item }))
  return <>
    <PageHeader title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`} description="Your saved resumes, evidence-based feedback and interview progress." />
    {error && <div className="mb-5 space-y-3"><ErrorNote>{error}</ErrorNote><Button variant="secondary" onClick={() => void load()}>Retry dashboard</Button></div>}
    <div className="mb-6 max-w-sm"><Field label="Interview round for averages and chart"><select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>{[['technical', 'Technical'], ['hr', 'HR'], ['behavioral', 'Behavioral'], ['project', 'Project discussion']].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></Field></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([label, value]) => <div key={label} className={`${card} p-5`}><p className="text-sm text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold">{stats ? value : 'Loading…'}</p></div>)}</div>
    <section className={`${card} mt-8 space-y-5 p-6`}>
      <h2 className="text-lg font-semibold">Interview improvement</h2><p className="text-sm text-zinc-500">Only scored sessions from the selected round and its current rubric are compared. Partial reports and legacy scores are excluded.</p>
      {!series.length ? <p className="py-6 text-zinc-500">Complete a session with at least three substantive answers to start this chart.</p> : <>
        <figure><svg viewBox="0 0 500 190" role="img" aria-label={`${category} interview scores over time`} className="w-full text-emerald-600 dark:text-emerald-400">
          {[0, 25, 50, 75, 100].map(score => <g key={score}><line x1={35} y1={160 - score * 1.35} x2={480} y2={160 - score * 1.35} stroke="currentColor" opacity={0.15} /><text x={2} y={164 - score * 1.35} fill="currentColor" fontSize={10}>{score}</text></g>)}
          {points.length > 1 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} />}
          {points.map(point => <circle key={point.id} cx={point.x} cy={point.y} r={4} fill="currentColor"><title>{new Date(point.date).toLocaleDateString()}: {point.score}/100</title></circle>)}
        </svg><figcaption className="text-sm text-zinc-500">{series.length} scored sessions · {series[0].rubricVersion}</figcaption></figure>
        <details className="text-sm"><summary className="cursor-pointer">View chart data</summary><table className="mt-3 w-full text-left"><thead><tr><th>Date</th><th>Score</th><th>Rubric</th></tr></thead><tbody>{series.map(item => <tr key={item.id}><td className="py-2">{new Date(item.date).toLocaleString()}</td><td>{item.score}/100</td><td>{item.rubricVersion}</td></tr>)}</tbody></table></details>
      </>}
    </section>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{[['/dashboard/resume', 'Improve your resume', 'Edit sections, download a PDF and review quality feedback.'], ['/dashboard/prep', 'Practice an interview', 'Answer resume-grounded questions and review evidence-linked feedback.'], ['/dashboard/privacy', 'Usage and privacy', 'Check beta allowances, control retention and export or delete your data.']].map(([href, title, text]) => <Link key={href} href={href} className={`${card} p-6 hover:border-emerald-500`}><h2 className="font-semibold">{title} →</h2><p className="mt-2 text-sm text-zinc-500">{text}</p></Link>)}</div>
    {!!stats?.legacySessionCount && <p className="mt-6 text-sm text-zinc-500">{stats.legacySessionCount} legacy practice sessions remain available in interview history with their original rubric.</p>}
  </>
}
