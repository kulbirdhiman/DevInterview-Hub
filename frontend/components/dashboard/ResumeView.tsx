'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, FloppyDisk, Printer } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type Resume } from '@/lib/api'
import { Button, ErrorNote, inputClass, card, Badge } from './ui'

/**
 * Renders a generated resume and lets the user correct anything the model got
 * wrong. Editing is inline rather than a separate form so what you see on the
 * page is what prints.
 */
export default function ResumeView({
  resume,
  onBack,
  onSaved,
}: {
  resume: Resume
  onBack: () => void
  onSaved: (r: Resume) => void
}) {
  const { getToken } = useAuth()
  const [draft, setDraft] = useState<Resume>(resume)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof Resume>(key: K, value: Resume[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const d = await apiFetch<{ resume: Resume }>(
        `/api/resumes/${resume._id}`,
        getToken,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: draft.title,
            targetRole: draft.targetRole,
            fullName: draft.fullName,
            headline: draft.headline,
            summary: draft.summary,
            skills: draft.skills,
            experience: draft.experience,
            projects: draft.projects,
            education: draft.education,
          }),
        }
      )
      onSaved(d.resume)
      setEditing(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" />
          All resumes
        </Button>

        <div className="flex items-center gap-2">
          {draft.generatedByAI && <Badge tone="accent">Written with AI</Badge>}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </Button>
          {editing ? (
            <Button onClick={save} loading={saving}>
              {!saving && <FloppyDisk size={16} />}
              Save changes
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 print:hidden">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <article className={`${card} p-8 sm:p-10 print:border-0 print:bg-white`}>
        {editing ? (
          <div className="grid gap-4">
            <input
              className={inputClass}
              value={draft.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="Full name"
            />
            <input
              className={inputClass}
              value={draft.headline}
              onChange={(e) => set('headline', e.target.value)}
              placeholder="Headline"
            />
            <textarea
              className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
              value={draft.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="Summary"
            />
            <input
              className={inputClass}
              value={draft.skills.join(', ')}
              onChange={(e) =>
                set(
                  'skills',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder="Skills, comma separated"
            />
          </div>
        ) : (
          <header>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 print:text-black">
              {draft.fullName || 'Unnamed'}
            </h2>
            {draft.headline && (
              <p className="mt-1 text-lg text-emerald-700 dark:text-emerald-400 print:text-black">
                {draft.headline}
              </p>
            )}
            {draft.summary && (
              <p className="mt-4 max-w-[70ch] leading-relaxed text-zinc-700 dark:text-zinc-300 print:text-black">
                {draft.summary}
              </p>
            )}
            {draft.skills.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {draft.skills.map((s) => (
                  <li key={s}>
                    <Badge>{s}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </header>
        )}

        {draft.experience.length > 0 && (
          <Section title="Experience">
            {draft.experience.map((e, i) => (
              <div key={i} className="mb-6 last:mb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-semibold text-zinc-950 dark:text-zinc-50 print:text-black">
                    {e.role}
                    {e.company && (
                      <span className="font-normal text-zinc-600 dark:text-zinc-400 print:text-black">
                        {' '}
                        at {e.company}
                      </span>
                    )}
                  </h4>
                  {(e.start || e.end) && (
                    <span className="font-mono text-sm text-zinc-500 dark:text-zinc-500 print:text-black">
                      {e.start} {e.end && `- ${e.end}`}
                    </span>
                  )}
                </div>
                <ul className="mt-2 grid gap-1.5">
                  {e.bullets.map((b, bi) => (
                    <li
                      key={bi}
                      className="flex gap-2 leading-relaxed text-zinc-700 dark:text-zinc-300 print:text-black"
                    >
                      <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
                        ·
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        {draft.projects.length > 0 && (
          <Section title="Projects">
            {draft.projects.map((p, i) => (
              <div key={i} className="mb-5 last:mb-0">
                <h4 className="font-semibold text-zinc-950 dark:text-zinc-50 print:text-black">
                  {p.name}
                </h4>
                <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300 print:text-black">
                  {p.description}
                </p>
                {p.tech.length > 0 && (
                  <p className="mt-1.5 font-mono text-sm text-zinc-500 dark:text-zinc-500 print:text-black">
                    {p.tech.join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {draft.education.length > 0 && (
          <Section title="Education">
            {draft.education.map((ed, i) => (
              <div key={i} className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-zinc-800 dark:text-zinc-200 print:text-black">
                  <strong className="font-semibold">{ed.degree}</strong>
                  {ed.school && `, ${ed.school}`}
                </span>
                {ed.year && (
                  <span className="font-mono text-sm text-zinc-500 dark:text-zinc-500 print:text-black">
                    {ed.year}
                  </span>
                )}
              </div>
            ))}
          </Section>
        )}
      </article>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-zinc-200 pt-7 dark:border-zinc-800 print:border-zinc-300">
      <h3 className="mb-5 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-500 print:text-black">
        {title}
      </h3>
      {children}
    </section>
  )
}
