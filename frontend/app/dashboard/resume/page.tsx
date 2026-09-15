'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Sparkle, Trash, FileText } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type Resume } from '@/lib/api'
import {
  PageHeader,
  Button,
  Field,
  inputClass,
  ErrorNote,
  EmptyState,
  SkeletonList,
  Badge,
  card,
} from '@/components/dashboard/ui'
import ResumeView from '@/components/dashboard/ResumeView'

export default function ResumesPage() {
  const { getToken } = useAuth()

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [selected, setSelected] = useState<Resume | null>(null)
  const [error, setError] = useState('')

  const [targetRole, setTargetRole] = useState('')
  const [rawInput, setRawInput] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken)
      setResumes(d.resumes ?? [])
    } catch (e) {
      setError(errorMessage(e))
      setResumes([])
    }
  }, [getToken])

  useEffect(() => {
    load()
  }, [load])

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGenerating(true)
    try {
      const d = await apiFetch<{ resume: Resume }>('/api/resumes/generate', getToken, {
        method: 'POST',
        body: JSON.stringify({ rawInput, targetRole }),
      })
      setSelected(d.resume)
      setRawInput('')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/resumes/${id}`, getToken, { method: 'DELETE' })
      if (selected?._id === id) setSelected(null)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (selected) {
    return (
      <ResumeView
        resume={selected}
        onBack={() => setSelected(null)}
        onSaved={(r) => {
          setSelected(r)
          load()
        }}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Resumes"
        description="Write about your background the way you would explain it to a friend. Claude turns it into structured sections, and you edit anything it gets wrong."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <section className={`${card} p-6 lg:col-span-7`}>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Generate a new resume
          </h2>

          <form onSubmit={generate} className="mt-5 grid gap-5">
            <Field label="Target role">
              <input
                className={inputClass}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Frontend Engineer"
              />
            </Field>

            <Field
              label="Your background"
              hint="Companies, what you built, tools you used, projects, education. Rough notes are fine."
            >
              <textarea
                className={`${inputClass} min-h-[220px] resize-y leading-relaxed`}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={
                  'I have been a frontend developer for about 3 years. At Zapflow I built the customer dashboard in React and moved it to Next.js, which cut load time a lot. Before that I freelanced building sites for local businesses. I know React, TypeScript, Node, MongoDB and some Docker. I studied computer science at Panjab University, finished 2021.'
                }
              />
            </Field>

            {error && <ErrorNote>{error}</ErrorNote>}

            <div className="flex items-center gap-4">
              <Button type="submit" loading={generating}>
                {!generating && <Sparkle size={16} weight="fill" />}
                {generating ? 'Writing your resume' : 'Generate with AI'}
              </Button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {rawInput.trim().length < 40
                  ? 'A few sentences at minimum'
                  : 'Takes around half a minute'}
              </span>
            </div>
          </form>
        </section>

        <section className="lg:col-span-5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Saved resumes
          </h2>

          <div className="mt-4">
            {resumes === null ? (
              <SkeletonList rows={2} />
            ) : resumes.length === 0 ? (
              <EmptyState
                title="Nothing saved yet"
                description="Generate your first resume and it will show up here, ready to edit or reuse for interview prep."
              />
            ) : (
              <ul className="grid gap-3">
                {resumes.map((r) => (
                  <li key={r._id} className={`${card} flex items-center gap-4 p-4`}>
                    <FileText
                      size={22}
                      weight="duotone"
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <button
                      onClick={() => setSelected(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                        {r.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {r.targetRole || 'No target role'} ·{' '}
                        {new Date(r.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                    {r.generatedByAI && <Badge tone="accent">AI</Badge>}
                    <Button
                      variant="danger"
                      onClick={() => remove(r._id)}
                      aria-label={`Delete ${r.title}`}
                      className="px-3"
                    >
                      <Trash size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
