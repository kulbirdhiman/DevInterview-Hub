'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage, type InterviewSession } from '@/lib/api'
import { Button, card } from '@/components/dashboard/ui'

export default function ReportComparison({ session }: { session: InterviewSession }) {
  const { getToken } = useAuth()
  const [previous, setPrevious] = useState<InterviewSession | null>(null), [error, setError] = useState('')
  useEffect(() => {
    let canceled = false
    apiFetch<{ sessions: InterviewSession[] }>('/api/interviews', getToken).then(({ sessions }) => {
      const comparable = sessions.filter(row => row._id !== session._id && row.state === 'completed' && row.report?.score != null && row.report.rubricVersion === session.report?.rubricVersion && row.category === session.category && row.difficulty === session.difficulty && row.language === session.language && row.role === session.role && row.durationMinutes === session.durationMinutes && new Date(row.createdAt) < new Date(session.createdAt))
      comparable.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      if (!canceled) setPrevious(comparable[0] ?? null)
    }).catch(e => { if (!canceled) setError(errorMessage(e)) })
    return () => { canceled = true }
  }, [session, getToken])
  function download() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), session }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'practice-report.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const current = session.report
  return <div className={`${card} space-y-3 p-6`}>
    <h3 className="font-semibold">Progress comparison</h3>
    {error ? <p role="status">Comparison unavailable: {error}</p> : previous && current?.score != null ? <>
      <p>Compared with {new Date(previous.createdAt).toLocaleDateString()}: {current.score - previous.report!.score! > 0 ? '+' : ''}{current.score - previous.report!.score!} points.</p>
      <table className="w-full text-left text-sm"><thead><tr><th>Dimension</th><th>Previous / 4</th><th>Current / 4</th></tr></thead><tbody>{current.dimensions.map(row => <tr key={row.key}><td className="py-1">{row.key}</td><td>{previous.report?.dimensions.find(old => old.key === row.key)?.rating?.toFixed(1) ?? 'Unassessed'}</td><td>{row.rating?.toFixed(1) ?? 'Unassessed'}</td></tr>)}</tbody></table>
    </> : <p className="text-sm text-zinc-500">A comparison needs two scored sessions with the same role, round, difficulty, language, duration and rubric. Scores are heuristic; differing questions and resume evidence can affect results.</p>}
    <Button variant="secondary" onClick={download}>Download detailed report (JSON)</Button>
  </div>
}
