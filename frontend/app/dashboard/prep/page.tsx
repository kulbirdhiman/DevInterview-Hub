'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Sparkle, Trash, ChatsCircle } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type PrepSession, type Resume } from '@/lib/api'
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
import PrepRunner from '@/components/dashboard/PrepRunner'

const LEVELS = ['easy', 'medium', 'hard'] as const

export default function PrepPage() {
  const { getToken } = useAuth()

  const [sessions, setSessions] = useState<PrepSession[] | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [active, setActive] = useState<PrepSession | null>(null)
  const [error, setError] = useState('')

  const [targetRole, setTargetRole] = useState('')
  const [stack, setStack] = useState('')
  const [difficulty, setDifficulty] = useState<(typeof LEVELS)[number]>('medium')
  const [count, setCount] = useState(6)
  const [resumeId, setResumeId] = useState('')
  const [building, setBuilding] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        apiFetch<{ sessions: PrepSession[] }>('/api/prep', getToken),
        apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken),
      ])
      setSessions(s.sessions ?? [])
      setResumes(r.resumes ?? [])
    } catch (e) {
      setError(errorMessage(e))
      setSessions([])
    }
  }, [getToken])

  useEffect(() => {
    load()
  }, [load])

  async function build(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBuilding(true)
    try {
      const d = await apiFetch<{ session: PrepSession }>('/api/prep', getToken, {
        method: 'POST',
        body: JSON.stringify({
          targetRole,
          stack: stack.split(',').map((s) => s.trim()).filter(Boolean),
          difficulty,
          count,
          resumeId: resumeId || undefined,
        }),
      })
      setActive(d.session)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBuilding(false)
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/prep/${id}`, getToken, { method: 'DELETE' })
      if (active?._id === id) setActive(null)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (active) {
    return (
      <PrepRunner
        session={active}
        onBack={() => {
          setActive(null)
          load()
        }}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Interview prep"
        description="Generate questions for the role you are chasing, answer them in your own words, and get scored feedback on what you actually said."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <section className={`${card} p-6 lg:col-span-7`}>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            New practice set
          </h2>

          <form onSubmit={build} className="mt-5 grid gap-5">
            <Field label="Role you are preparing for">
              <input
                className={inputClass}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Backend Engineer"
                required
              />
            </Field>

            <Field label="Stack" hint="Comma separated. Leave blank to keep it general.">
              <input
                className={inputClass}
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="Node.js, MongoDB, Docker"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Difficulty">
                <select
                  className={inputClass}
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as (typeof LEVELS)[number])
                  }
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l[0].toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Questions">
                <input
                  type="number"
                  min={3}
                  max={12}
                  className={inputClass}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </Field>
            </div>

            {resumes.length > 0 && (
              <Field
                label="Base it on a resume"
                hint="Grounds some questions in work you have actually done."
              >
                <select
                  className={inputClass}
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                >
                  <option value="">No resume</option>
                  {resumes.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            <div className="flex items-center gap-4">
              <Button type="submit" loading={building}>
                {!building && <Sparkle size={16} weight="fill" />}
                {building ? 'Writing questions' : 'Generate questions'}
              </Button>
            </div>
          </form>
        </section>

        <section className="lg:col-span-5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Your sessions
          </h2>

          <div className="mt-4">
            {sessions === null ? (
              <SkeletonList rows={2} />
            ) : sessions.length === 0 ? (
              <EmptyState
                title="No practice sets yet"
                description="Generate one and it stays here with your answers and scores, so you can see progress over time."
              />
            ) : (
              <ul className="grid gap-3">
                {sessions.map((s) => {
                  const answered = s.questions.filter((q) => q.answeredAt).length
                  return (
                    <li key={s._id} className={`${card} flex items-center gap-4 p-4`}>
                      <ChatsCircle
                        size={22}
                        weight="duotone"
                        className="shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                      <button
                        onClick={() => setActive(s)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                          {s.targetRole}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {answered} of {s.questions.length} answered · {s.difficulty}
                        </p>
                      </button>
                      {s.status === 'completed' && <Badge tone="accent">Done</Badge>}
                      <Button
                        variant="danger"
                        onClick={() => remove(s._id)}
                        aria-label={`Delete ${s.targetRole} session`}
                        className="px-3"
                      >
                        <Trash size={16} />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
