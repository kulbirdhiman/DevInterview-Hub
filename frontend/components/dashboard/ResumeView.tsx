'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { apiFetch, downloadFile, errorMessage, type Resume, type ResumeContent, type ResumeVersion } from '@/lib/api'
import { sectionLabels } from '@/lib/resume/content'
import { useResumeDraft } from '@/lib/resume/useResumeDraft'
import ResumePreview from '@/components/resume/ResumePreview'
import ResumeAnalysisPanel from '@/components/analysis/ResumeAnalysisPanel'
import SectionEditor from '@/components/resume/SectionEditor'
import { Button, ErrorNote, Field, inputClass, card } from './ui'

export default function ResumeView({ resume, onBack, onSaved }: {
  resume: Resume; onBack: () => void; onSaved: (resume: Resume) => void
}) {
  const { getToken } = useAuth()
  const editor = useResumeDraft(resume, onSaved)
  const { draft, update } = editor
  const [section, setSection] = useState('contact')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [versionError, setVersionError] = useState('')
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER'>('A4')
  const [dragging, setDragging] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const loadVersions = useCallback(async () => {
    try {
      const result = await apiFetch<{ versions: ResumeVersion[] }>(`/api/resumes/${resume._id}/versions`, getToken)
      setVersions(result.versions); setVersionsLoaded(true); setVersionError('')
    } catch (error) { setVersionError(errorMessage(error)) }
  }, [getToken, resume._id])
  useEffect(() => { void loadVersions() }, [loadVersions])

  function set<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) { update(d => ({ ...d, [key]: value })) }
  const label = (key: string) => sectionLabels[key] ?? draft.customSections.find(item => `custom:${item.id}` === key)?.title ?? 'Custom section'

  function reorder(from: string, to: string) {
    if (from === to || busy) return
    update(d => {
      const order = [...d.sectionOrder]
      const source = order.indexOf(from), destination = order.indexOf(to)
      if (source < 0 || destination < 0) return d
      order.splice(destination, 0, ...order.splice(source, 1))
      return { ...d, sectionOrder: order }
    })
    setAnnouncement(`Moved ${label(from)}.`)
  }
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setActionError('')
    try { await action() } catch (error) { setActionError(errorMessage(error)) } finally { setBusy(false) }
  }
  async function createVersion() {
    await editor.persist()
    const { resume: saved } = await apiFetch<{ resume: Resume }>(`/api/resumes/${resume._id}/versions`, getToken, {
      method: 'POST', body: JSON.stringify({ expectedRevision: editor.revision.current, label: versionLabel.trim() || 'Saved version' }),
    })
    editor.accept(saved); setVersionLabel(''); await loadVersions()
  }
  async function restore(version: ResumeVersion) {
    if (!window.confirm(`Restore “${version.label}”? Your current draft will be saved in history first.`)) return
    await run(async () => {
      await editor.persist()
      const { resume: restored } = await apiFetch<{ resume: Resume }>(`/api/resumes/${resume._id}/versions/${version._id}/restore`, getToken, {
        method: 'POST', body: JSON.stringify({ expectedRevision: editor.revision.current }),
      })
      editor.accept(restored, true); setSection('contact'); await loadVersions()
    })
  }
  const statusLabel = { saved: 'All changes saved', unsaved: 'Unsaved changes', saving: 'Saving…', error: 'Save failed — draft kept in this tab', conflict: 'Conflict — autosave paused' }[editor.status]
  const unavailable = editor.status === 'conflict' || editor.status === 'error'
  const activeSection = section === 'contact' || draft.sectionOrder.includes(section) ? section : 'contact'

  return <>
    <div className="resume-editor-controls mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await editor.persist(); onBack() })}>← All resumes</Button>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className={`text-sm ${unavailable ? 'text-red-600 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{statusLabel}</span>
          <Button variant="secondary" disabled={busy || unavailable} onClick={() => void run(editor.persist)}>Save now</Button>
          <label className="text-sm">Page size <select aria-label="PDF page size" className="rounded border border-zinc-300 bg-transparent p-2 dark:border-zinc-700" value={pageSize} onChange={e => setPageSize(e.target.value as 'A4' | 'LETTER')}><option>A4</option><option value="LETTER">Letter</option></select></label>
          <Button disabled={busy || unavailable} onClick={() => void run(async () => { await editor.persist(); await downloadFile(`/api/resumes/${resume._id}/pdf`, getToken, { expectedRevision: editor.revision.current, pageSize }, 'resume.pdf') })}>Download PDF</Button>
          <Button variant="secondary" onClick={editor.downloadDraft}>Download draft JSON</Button>
          <Button variant="secondary" disabled={busy || editor.dirty || unavailable} onClick={() => { setMobileTab('preview'); window.setTimeout(() => window.print(), 50) }}>Print preview</Button>
        </div>
      </div>
      {editor.error && <ErrorNote>{editor.error}</ErrorNote>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      {unavailable && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 p-4 text-sm">
        <p className="basis-full">Your draft stays in this tab. Download a copy before reloading or leaving.</p>
        {editor.status === 'error' && <Button variant="secondary" disabled={busy} onClick={() => void run(editor.retry)}>Retry save</Button>}
        <Button variant="secondary" disabled={busy} onClick={() => {
          if (window.confirm('Replace the draft in this tab with the saved resume? Download your draft first if you want to keep it.')) void run(editor.reload)
        }}>Reload saved resume</Button>
      </div>}
      <div className="flex gap-2 lg:hidden" aria-label="Editor view">
        <Button variant={mobileTab === 'edit' ? 'primary' : 'secondary'} aria-pressed={mobileTab === 'edit'} onClick={() => setMobileTab('edit')}>Edit</Button>
        <Button variant={mobileTab === 'preview' ? 'primary' : 'secondary'} aria-pressed={mobileTab === 'preview'} onClick={() => setMobileTab('preview')}>Preview</Button>
      </div>
    </div>
    <div className="resume-editor-layout grid items-start gap-6 lg:grid-cols-2">
      <div className={`resume-editor-form min-w-0 space-y-6 ${mobileTab === 'preview' ? 'hidden lg:block' : ''}`}>
        <fieldset disabled={busy} className={`${card} min-w-0 space-y-5 p-5 disabled:opacity-60`}>
          <legend className="px-1 font-semibold">Resume details</legend>
          <Field label="Resume title"><input className={inputClass} maxLength={120} value={draft.title} onChange={e => set('title', e.target.value)} /></Field>
          <Field label="Target role"><input className={inputClass} maxLength={120} value={draft.targetRole} onChange={e => set('targetRole', e.target.value)} /></Field>
          <p className="text-xs text-zinc-500">Autosaves after you pause typing. Saved versions are separate checkpoints.</p>
        </fieldset>
        <fieldset disabled={busy} className={`${card} min-w-0 p-5 disabled:opacity-60`}>
          <legend className="px-1 font-semibold">Sections</legend>
          <p className="mb-4 text-sm text-zinc-500">Drag the handle to reorder sections, or use the arrow buttons. Contact details stay at the top.</p>
          <button type="button" aria-pressed={activeSection === 'contact'} onClick={() => setSection('contact')} className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-sm ${activeSection === 'contact' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Contact details</button>
          <ol className="space-y-2">
            {draft.sectionOrder.map((key, index) => <li key={key} onDragOver={event => { if (dragging) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (dragging) reorder(dragging, key); setDragging(null) }} className={`flex items-center gap-1 rounded-lg border p-1 ${activeSection === key ? 'border-emerald-500' : 'border-zinc-200 dark:border-zinc-700'}`}>
              <button type="button" draggable onDragStart={event => { event.dataTransfer.setData('text/plain', key); event.dataTransfer.effectAllowed = 'move'; setDragging(key) }} onDragEnd={() => setDragging(null)} aria-label={`Drag ${label(key)} to reorder; keyboard users can use arrow buttons`} className="cursor-grab px-2 py-2 text-zinc-500">⠿</button>
              <button type="button" aria-pressed={activeSection === key} onClick={() => setSection(key)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm">{label(key)}</button>
              <button type="button" className="rounded px-3 py-2 disabled:opacity-30" disabled={!index} aria-label={`Move ${label(key)} up`} onClick={() => reorder(key, draft.sectionOrder[index - 1])}>↑</button>
              <button type="button" className="rounded px-3 py-2 disabled:opacity-30" disabled={index === draft.sectionOrder.length - 1} aria-label={`Move ${label(key)} down`} onClick={() => reorder(key, draft.sectionOrder[index + 1])}>↓</button>
            </li>)}
          </ol>
          <p className="sr-only" aria-live="polite">{announcement}</p>
          <Button className="mt-4" variant="secondary" disabled={draft.customSections.length >= 5} onClick={() => {
            const id = crypto.randomUUID(), key = `custom:${id}`
            update(d => ({ ...d, customSections: [...d.customSections, { id, title: 'Custom section', body: '' }], sectionOrder: [...d.sectionOrder, key] })); setSection(key)
          }}>Add custom section ({draft.customSections.length}/5)</Button>
        </fieldset>
        <fieldset disabled={busy} className={`${card} min-w-0 space-y-5 p-5 disabled:opacity-60`}>
          <legend className="px-1 font-semibold">{activeSection === 'contact' ? 'Contact details' : label(activeSection)}</legend>
          {activeSection === 'contact' ? <div className="grid gap-4">
            <Field label="Full name"><input autoComplete="name" className={inputClass} maxLength={120} value={draft.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
            <Field label="Professional headline"><input className={inputClass} maxLength={200} value={draft.headline} onChange={e => set('headline', e.target.value)} /></Field>
            {(['email', 'phone', 'location', 'website', 'linkedin', 'github'] as const).map(key => <Field key={key} label={{ email: 'Email', phone: 'Phone', location: 'Location', website: 'Portfolio / website', linkedin: 'LinkedIn URL', github: 'GitHub URL' }[key]}>
              <input className={inputClass} maxLength={key === 'email' ? 254 : key === 'phone' ? 50 : key === 'location' ? 150 : 500} value={draft.contact[key]} onChange={e => update(d => ({ ...d, contact: { ...d.contact, [key]: e.target.value } }))} />
            </Field>)}
          </div> : <SectionEditor sectionKey={activeSection} content={draft} onChange={update} />}
        </fieldset>
        <fieldset disabled={busy} className={`${card} min-w-0 space-y-4 p-5 disabled:opacity-60`}>
          <legend className="px-1 font-semibold">Layout and style</legend>
          <p className="text-sm text-zinc-500">Layout changes preserve every section. Choose from the supported settings below.</p>
          {([
            ['template', 'Template', ['ats', 'minimal', 'developer']],
            ['font', 'Font family', ['sans', 'serif', 'mono']],
            ['fontSize', 'Text size', ['small', 'medium', 'large']],
            ['spacing', 'Section spacing', ['compact', 'comfortable', 'spacious']],
            ['color', 'Accent color', ['slate', 'emerald', 'blue', 'burgundy']],
          ] as const).map(([key, title, choices]) => <Field key={key} label={title}><select className={inputClass} value={draft.presentation[key]} onChange={e => update(d => ({ ...d, presentation: { ...d.presentation, [key]: e.target.value } }))}>{choices.map(choice => <option key={choice} value={choice}>{choice === 'ats' ? 'ATS-friendly' : choice[0].toUpperCase() + choice.slice(1)}</option>)}</select></Field>)}
        </fieldset>
        <ResumeAnalysisPanel resumeId={resume._id} revision={editor.meta.revision} flush={editor.persist} getRevision={() => editor.revision.current} />
        <section className={`${card} space-y-4 p-5`}>
          <h2 className="font-semibold">Saved versions</h2>
          <p className="text-sm text-zinc-500">Keep up to 30 immutable checkpoints. Restoring adds a checkpoint of your current draft first.</p>
          <Field label="Version label"><input className={inputClass} maxLength={100} disabled={busy} value={versionLabel} onChange={e => setVersionLabel(e.target.value)} placeholder="Frontend developer application" /></Field>
          <Button disabled={busy || unavailable || editor.meta.versionCount >= 30} onClick={() => void run(createVersion)}>Save version ({editor.meta.versionCount}/30)</Button>
          {versionError && <><ErrorNote>{versionError}</ErrorNote><Button variant="secondary" onClick={() => void loadVersions()}>Retry history</Button></>}
          {!versionsLoaded && !versionError && <p role="status">Loading history…</p>}
          {versionsLoaded && !versions.length && <p className="text-sm text-zinc-500">No saved versions yet. Autosave keeps your current draft.</p>}
          <ul className="space-y-3">{versions.map(version => <li key={version._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><div className="min-w-0"><p className="break-words text-sm font-medium">{version.label}</p><p className="text-xs text-zinc-500">{new Date(version.createdAt).toLocaleString()} · revision {version.sourceRevision}</p></div><div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => void run(() => downloadFile(`/api/resumes/${resume._id}/pdf`, getToken, { versionId: version._id, expectedRevision: editor.revision.current, pageSize }, 'resume-version.pdf'))}>PDF</Button><Button variant="secondary" disabled={busy || unavailable || editor.meta.versionCount >= 30} onClick={() => void restore(version)}>Restore</Button></div></li>)}</ul>
        </section>
      </div>
      <div className={`resume-preview-column min-w-0 lg:sticky lg:top-6 ${mobileTab === 'edit' ? 'hidden lg:block' : ''}`}>
        <p className="resume-editor-controls mb-3 text-sm text-zinc-500">Live preview · empty sections are omitted</p>
        <ResumePreview content={draft} />
      </div>
    </div>
  </>
}
