'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, errorMessage } from '@/lib/api'
import { PageHeader, Button, ErrorNote, card } from '@/components/dashboard/ui'

type Operations = { databaseReady: boolean; workerHeartbeatSeconds: number | null; aiConfigured: boolean; uptimeSeconds: number; requests: number; serverErrors: number; p95Ms: number | null; note: string; tasks: { _id: string; count: number }[]; models: { _id: string; calls: number; inputTokens: number; outputTokens: number; configuredCostUsd: number; unpricedCalls: number }[]; failedTasks: { _id: string; type: string; attempts: number; adminRetries: number; errorCode: string }[] }
export default function OperationsPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<Operations | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setData(await apiFetch<Operations>('/api/ops', getToken)); setError('') } catch (error) { setError(errorMessage(error)) }
  }, [getToken])
  useEffect(() => { void load() }, [load])
  async function retry(id: string) {
    setBusy(true)
    try { await apiFetch(`/api/ops/tasks/${id}/retry`, getToken, { method: 'POST', body: '{}' }); await load() }
    catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <>
    <PageHeader title="Operations" description="Administrator-only health, background task recovery and AI usage metadata." action={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>} />
    {error && <ErrorNote>{error}</ErrorNote>}
    {data && <div className="space-y-6">
      <section className={`${card} grid gap-4 p-6 sm:grid-cols-3`}>{[['Database', data.databaseReady ? 'Ready' : 'Unavailable'], ['Worker heartbeat', data.workerHeartbeatSeconds == null ? 'Not started' : `${data.workerHeartbeatSeconds}s ago`], ['AI configuration', data.aiConfigured ? 'Configured' : 'Not configured'], ['Process uptime', `${data.uptimeSeconds}s`], ['Requests / server errors', `${data.requests} / ${data.serverErrors}`], ['Sample p95 latency', data.p95Ms == null ? 'Not measured' : `${data.p95Ms}ms`]].map(([label, value]) => <div key={label}><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}</section>
      <section className={`${card} p-6`}><h2 className="font-semibold">Task queue</h2><ul className="mt-3 flex flex-wrap gap-5">{data.tasks.map(row => <li key={row._id}>{row._id}: {row.count}</li>)}</ul></section>
      <section className={`${card} overflow-x-auto p-6`}><h2 className="font-semibold">AI usage (retained 90-day records)</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Model</th><th>Calls</th><th>Input / output tokens</th><th>Configured cost (USD)</th><th>Unpriced calls</th></tr></thead><tbody>{data.models.map(row => <tr key={row._id} className="border-t border-zinc-200 dark:border-zinc-700"><td className="py-3">{row._id}</td><td>{row.calls}</td><td>{row.inputTokens} / {row.outputTokens}</td><td>${row.configuredCostUsd.toFixed(4)}</td><td>{row.unpricedCalls}</td></tr>)}</tbody></table><p className="mt-3 text-sm text-zinc-500">{data.note}</p></section>
      <section className={`${card} space-y-4 p-6`}><h2 className="font-semibold">Failed tasks</h2>{!data.failedTasks.length && <p className="text-sm text-zinc-500">No failed tasks in the retained queue.</p>}{data.failedTasks.map(task => <div key={task._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"><div className="min-w-0"><p className="font-medium">{task.type} · {task.errorCode}</p><p className="break-all text-xs text-zinc-500">{task._id}</p><p className="text-xs text-zinc-500">Attempts: {task.attempts}; admin retries: {task.adminRetries}/2</p></div><Button variant="secondary" disabled={busy || task.adminRetries >= 2} onClick={() => void retry(task._id)}>Retry task</Button></div>)}</section>
    </div>}
  </>
}
