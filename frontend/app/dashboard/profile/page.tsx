'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { FloppyDisk, CheckCircle } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type Profile } from '@/lib/api'
import {
  PageHeader,
  Button,
  Field,
  inputClass,
  ErrorNote,
  card,
} from '@/components/dashboard/ui'

export default function ProfilePage() {
  const { getToken } = useAuth()
  const { user } = useUser()

  const [form, setForm] = useState<Profile>({
    bio: '',
    skills: [],
    github: '',
    linkedin: '',
    portfolio: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch<{ user: Profile }>('/api/users/me', getToken)
      .then((d) => {
        if (cancelled || !d.user) return
        setForm({
          bio: d.user.bio ?? '',
          skills: d.user.skills ?? [],
          github: d.user.github ?? '',
          linkedin: d.user.linkedin ?? '',
          portfolio: d.user.portfolio ?? '',
        })
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [getToken])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await apiFetch('/api/users/update-profile', getToken, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your name and email come from your sign-in account. Everything here is yours to edit, and it feeds into the resumes and questions we generate."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <form onSubmit={save} className={`${card} p-6 lg:col-span-7`}>
          {loading ? (
            <div className="grid gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-5">
              <Field label="Bio" hint="A couple of sentences about what you build.">
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </Field>

              <Field label="Skills" hint="Comma separated.">
                <input
                  className={inputClass}
                  value={form.skills.join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      skills: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="React, TypeScript, Node.js"
                />
              </Field>

              <Field label="GitHub">
                <input
                  className={inputClass}
                  value={form.github}
                  onChange={(e) => setForm({ ...form, github: e.target.value })}
                  placeholder="https://github.com/you"
                />
              </Field>

              <Field label="LinkedIn">
                <input
                  className={inputClass}
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/you"
                />
              </Field>

              <Field label="Portfolio">
                <input
                  className={inputClass}
                  value={form.portfolio}
                  onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                  placeholder="https://yoursite.dev"
                />
              </Field>

              {error && <ErrorNote>{error}</ErrorNote>}

              <div className="flex items-center gap-4">
                <Button type="submit" loading={saving}>
                  {!saving && <FloppyDisk size={16} />}
                  Save profile
                </Button>
                {saved && (
                  <span className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle size={16} weight="fill" />
                    Saved
                  </span>
                )}
              </div>
            </div>
          )}
        </form>

        <aside className={`${card} h-fit p-6 lg:col-span-5`}>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Account
          </h2>
          <dl className="mt-4 grid gap-4">
            <div>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">Name</dt>
              <dd className="mt-1 text-zinc-950 dark:text-zinc-50">
                {user?.fullName || 'Not set'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">Email</dt>
              <dd className="mt-1 break-all text-zinc-950 dark:text-zinc-50">
                {user?.primaryEmailAddress?.emailAddress || 'Not set'}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Change your name, email, or password from the avatar menu in the top right.
          </p>
        </aside>
      </div>
    </>
  )
}
