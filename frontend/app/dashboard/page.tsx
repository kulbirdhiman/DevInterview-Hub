'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { FileText, ChatsCircle, VideoCamera, ArrowRight } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type Stats } from '@/lib/api'
import { PageHeader, card, ErrorNote, Badge } from '@/components/dashboard/ui'

const steps = [
  {
    href: '/dashboard/resume',
    icon: FileText,
    title: 'Build your resume',
    body: 'Describe your background in plain words. Claude turns it into structured resume sections you can edit.',
    cta: 'Open resumes',
  },
  {
    href: '/dashboard/prep',
    icon: ChatsCircle,
    title: 'Practise the questions',
    body: 'Generate a question set for the role you want, answer in your own words, and get scored feedback.',
    cta: 'Start prep',
  },
  {
    href: '/interview',
    icon: VideoCamera,
    title: 'Run a live room',
    body: 'Take it into the shared editor with video when you are ready for a real or mock interview.',
    cta: 'Open room',
  },
]

export default function DashboardOverview() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch<{ stats: Stats }>('/api/prep/stats', getToken)
      .then((d) => !cancelled && d.stats && setStats(d.stats))
      .catch((e) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [getToken])

  const tiles = [
    { label: 'Resumes', value: stats?.resumeCount ?? null },
    { label: 'Prep sessions', value: stats?.sessionCount ?? null },
    { label: 'Questions answered', value: stats?.questionsAnswered ?? null },
    {
      label: 'Average score',
      value: stats?.averageScore ?? null,
      suffix: stats?.averageScore != null ? ' / 10' : '',
    },
  ]

  return (
    <>
      <PageHeader
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`}
        description="Three steps: get your resume in shape, practise the questions you are likely to be asked, then run the real thing in a live room."
      />

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} p-5`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.label}</p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-zinc-50">
              {t.value === null ? (
                <span className="inline-block h-8 w-12 animate-pulse rounded bg-zinc-200 align-middle dark:bg-zinc-800" />
              ) : (
                <>
                  {t.value}
                  {t.suffix && (
                    <span className="text-lg text-zinc-500 dark:text-zinc-500">
                      {t.suffix}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Your workflow
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {steps.map(({ href, icon: Icon, title, body, cta }, i) => (
            <Link
              key={href}
              href={href}
              className={`${card} group flex flex-col p-6 transition-colors hover:border-emerald-400 dark:hover:border-emerald-500/60`}
            >
              <div className="flex items-center justify-between">
                <Icon size={24} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
                <Badge>{`Step ${i + 1}`}</Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
              </h3>
              <p className="mt-2 flex-1 leading-relaxed text-zinc-600 dark:text-zinc-400">
                {body}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {cta}
                <ArrowRight
                  size={15}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
