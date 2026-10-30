'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { apiFetch, downloadFile, errorMessage } from '@/lib/api'
import { PageHeader, Button, Field, inputClass, ErrorNote, card } from '@/components/dashboard/ui'

type Usage = { plan: string; limits: { metric: string; limit: number; used: number; period: string }[]; resets: string }
const names: Record<string, string> = { resumeSlots: 'Active resumes', resumeAI: 'AI resume drafts', analysis: 'Resume analyses', interview: 'Interview sessions', pdf: 'PDF downloads', dataExport: 'Account exports', providerCalls: 'AI call attempts (including retries)' }
export default function PrivacyPage() {
  const { getToken } = useAuth(), { signOut } = useClerk()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [retentionDays, setRetention] = useState(90)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const load = useCallback(async () => {
    try { const [usage, preferences] = await Promise.all([apiFetch<Usage>('/api/usage', getToken), apiFetch<{ retentionDays: number }>('/api/account/preferences', getToken)]); setUsage(usage); setRetention(preferences.retentionDays); setError('') }
    catch (error) { setError(errorMessage(error)) }
  }, [getToken])
  useEffect(() => { void load() }, [load])
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <>
    <PageHeader title="Usage and privacy" description="Control your preparation data and see the limits for the free beta." />
    {error && <div className="mb-5 space-y-3"><ErrorNote>{error}</ErrorNote><Button variant="secondary" onClick={() => void load()}>Refresh</Button></div>}
    {message && <p role="status" className="mb-5 rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{message}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className={`${card} space-y-4 p-6`}><h2 className="text-lg font-semibold">{usage?.plan ?? 'Loading usage…'}</h2>{usage?.limits.map(row => <div key={row.metric}><div className="flex justify-between gap-3 text-sm"><span>{names[row.metric] ?? row.metric}</span><span>{row.used}/{row.limit}</span></div><meter aria-label={names[row.metric] ?? row.metric} className="mt-1 h-3 w-full" min={0} max={row.limit} value={Math.min(row.used, row.limit)} /></div>)}<p className="text-sm text-zinc-500">{usage?.resets}</p><p className="text-sm text-zinc-500">Existing resumes are preserved even if above the beta allowance. Deleting a resource does not refund completed AI usage. Failed analysis/start jobs release product allowances; provider attempts still count.</p></section>
      <div className="space-y-6">
        <section className={`${card} space-y-4 p-6`}><h2 className="text-lg font-semibold">Analysis and interview retention</h2><Field label="Keep analyses and interview transcripts for"><select className={inputClass} value={retentionDays} disabled={busy} onChange={e => setRetention(Number(e.target.value))}>{[30, 90, 180].map(days => <option key={days} value={days}>{days} days</option>)}</select></Field><p className="text-sm text-zinc-500">Changing this applies to existing and future analyses/interviews. Expired records are removed by the cleanup sweep. Resumes and saved versions remain until you delete them. This text-only beta records no camera or microphone data.</p><Button disabled={busy} onClick={() => void run(async () => { await apiFetch('/api/account/preferences', getToken, { method: 'PUT', body: JSON.stringify({ retentionDays }) }); setMessage('Retention saved.') })}>Save retention</Button></section>
        <section className={`${card} space-y-4 p-6`}><h2 className="text-lg font-semibold">Export your account data</h2><p className="text-sm text-zinc-500">Download JSON containing your app profile, resumes and saved versions, analyses, transcripts, reports and usage records. The download contains personal data; store it somewhere private.</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await downloadFile('/api/account/export', getToken, {}, 'career-data.json'); await load(); setMessage('Account data downloaded.') })}>Download account data</Button></section>
        <section className={`${card} space-y-4 border-red-200 p-6 dark:border-red-900`}><h2 className="text-lg font-semibold">Delete your account</h2><p className="text-sm text-zinc-500">This immediately disables app access and queues deletion of your app data and Clerk identity. The operation cannot be undone. Minimal deletion tombstones and operational audit records remain; backups and provider processing follow their own published retention windows.</p><Button variant="danger" disabled={busy} onClick={() => setDeleting(value => !value)}>{deleting ? 'Cancel deletion' : 'Delete account…'}</Button>{deleting && <><Field label="Type DELETE to confirm permanent account deletion"><input className={inputClass} disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></Field><Button variant="danger" disabled={busy || confirmation !== 'DELETE'} onClick={() => void run(async () => { await apiFetch('/api/account/deletion', getToken, { method: 'POST', body: JSON.stringify({ confirmation }) }); setMessage('Deletion queued. Signing out…'); await signOut({ redirectUrl: '/' }) })}>Permanently delete my account</Button></>}</section>
      </div>
    </div>
  </>
}
