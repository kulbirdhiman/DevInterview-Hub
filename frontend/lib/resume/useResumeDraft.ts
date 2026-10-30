'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ApiError, apiFetch, errorMessage, type Resume, type ResumeContent } from '@/lib/api'
import { normalizeResume, resumeContent } from './content'

export function useResumeDraft(initial: Resume, onSaved: (resume: Resume) => void) {
  const { getToken } = useAuth()
  const [draft, setDraft] = useState(() => resumeContent(initial))
  const [meta, setMeta] = useState(() => normalizeResume(initial))
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'>('saved')
  const [error, setError] = useState('')
  const current = useRef(draft)
  const revision = useRef(initial.revision ?? 0)
  const saved = useRef(JSON.stringify(draft))
  const inFlight = useRef<Promise<void> | null>(null)
  const blocked = useRef(false)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const update = useCallback((change: (value: ResumeContent) => ResumeContent) => {
    current.current = change(current.current)
    setDraft(current.current)
    if (!blocked.current) setStatus('unsaved')
  }, [])

  const persist = useCallback(async function persist(): Promise<void> {
    while (inFlight.current) await inFlight.current
    if (blocked.current) throw new Error('Resolve the save error before continuing.')
    const content = current.current
    const signature = JSON.stringify(content)
    if (signature === saved.current) { setStatus('saved'); return }
    const task = (async () => {
      setStatus('saving')
      setError('')
      try {
        const result = await apiFetch<{ resume: Resume }>(`/api/resumes/${initial._id}`, getToken, {
          method: 'PUT', body: JSON.stringify({ expectedRevision: revision.current, content }),
        })
        revision.current = result.resume.revision
        saved.current = signature
        setMeta(normalizeResume(result.resume))
        onSavedRef.current(result.resume)
        setStatus(JSON.stringify(current.current) === signature ? 'saved' : 'unsaved')
      } catch (caught) {
        blocked.current = true
        setStatus(caught instanceof ApiError && caught.status === 409 ? 'conflict' : 'error')
        setError(errorMessage(caught))
        throw caught
      } finally { inFlight.current = null }
    })()
    inFlight.current = task
    await task
    // Edits made during an HTTP request are saved afterward, never replaced
    // by the older response and never sent with the older revision.
    if (JSON.stringify(current.current) !== saved.current) await persist()
  }, [getToken, initial._id])

  useEffect(() => {
    if (status !== 'unsaved') return
    const timer = window.setTimeout(() => { void persist().catch(() => {}) }, 750)
    return () => window.clearTimeout(timer)
  }, [draft, status, persist])

  const dirty = JSON.stringify(draft) !== saved.current
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const guardNavigation = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      if (!anchor || anchor.target === '_blank' || anchor.download || !anchor.href || anchor.href === window.location.href) return
      if (!window.confirm('Your latest resume changes have not been saved. Leave this page and discard unsaved changes?')) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', guardNavigation, true)
    }
  }, [dirty])

  async function retry() {
    if (status === 'conflict') return
    blocked.current = false
    await persist()
  }
  function accept(resume: Resume, replaceContent = false) {
    const normalized = normalizeResume(resume)
    revision.current = normalized.revision
    setMeta(normalized)
    blocked.current = false
    setError('')
    if (replaceContent) {
      current.current = resumeContent(normalized)
      saved.current = JSON.stringify(current.current)
      setDraft(current.current)
    }
    setStatus('saved')
    onSavedRef.current(normalized)
  }
  async function reload() {
    if (inFlight.current) await inFlight.current.catch(() => {})
    const { resume } = await apiFetch<{ resume: Resume }>(`/api/resumes/${initial._id}`, getToken)
    accept(resume, true)
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'resume-draft.json'; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { draft, meta, status, error, dirty, update, persist, retry, reload, accept, downloadDraft, revision }
}
