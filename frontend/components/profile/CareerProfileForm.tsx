'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, emptyProfile, errorMessage, type Profile } from '@/lib/api'
import { Button, ErrorNote, Field, inputClass, card } from '@/components/dashboard/ui'

export default function CareerProfileForm({ onboarding = false }: { onboarding?: boolean }) {
  const { getToken, isLoaded, userId } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const [form, setForm] = useState<Profile>(emptyProfile)
  const [skills, setSkills] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoaded || !userId) return
    let canceled = false
    apiFetch<{ user: Partial<Profile> }>('/api/users/me', getToken)
      .then(({ user: profile }) => {
        if (canceled) return
        if (onboarding && profile.onboardingCompletedAt) {
          router.replace('/dashboard')
          return
        }
        // Select editable fields explicitly; identity/role fields never go back
        // through the profile mutation endpoint.
        const next = { ...emptyProfile }
        for (const key of Object.keys(emptyProfile) as (keyof typeof emptyProfile)[]) {
          Object.assign(next, { [key]: profile[key] ?? emptyProfile[key] })
        }
        next.displayName ||= [profile.firstName, profile.lastName].filter(Boolean).join(' ')
        setForm(next)
        setSkills(next.skills.join(', '))
        setLoadFailed(false)
        setError('')
      })
      .catch(e => {
        if (!canceled) { setLoadFailed(true); setError(errorMessage(e)) }
      })
      .finally(() => { if (!canceled) setLoading(false) })
    return () => { canceled = true }
  }, [getToken, isLoaded, userId, onboarding, router, attempt])

  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setSaved('')
  }

  async function save(complete: boolean) {
    if (saving) return
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const body = { ...form, skills: [...new Set(skills.split(',').map(s => s.trim()).filter(Boolean))] }
      await apiFetch(complete ? '/api/users/onboarding/complete' : '/api/users/update-profile', getToken, {
        method: complete ? 'POST' : 'PUT', body: JSON.stringify(body),
      })
      if (complete) { router.replace('/dashboard'); return }
      setSaved(onboarding ? 'Draft saved. You can return and finish later.' : 'Profile saved.')
    } catch (e) { setError(errorMessage(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className={`${card} p-6`} role="status">Loading your profile…</div>
  if (loadFailed) return <div className={`${card} space-y-4 p-6`}>
    <ErrorNote>{error}</ErrorNote>
    <Button onClick={() => { setLoading(true); setAttempt(a => a + 1) }}>Retry loading profile</Button>
  </div>

  return (
    <form className={`${card} p-6 sm:p-8`} noValidate onSubmit={e => { e.preventDefault(); void save(onboarding) }}>
      <fieldset disabled={saving} className="grid min-w-0 gap-6 disabled:opacity-70">
        <legend className="mb-6 text-lg font-semibold">{onboarding ? 'Your career direction' : 'Career profile'}</legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {onboarding ? 'Name, experience level and target role are required. Other details can be added later.' : 'These details help personalize your preparation. Manage your sign-in name, email and password in account settings.'}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" hint="The name you want to use in your career profile.">
            <input autoComplete="name" className={inputClass} value={form.displayName} maxLength={120} required={onboarding} onChange={e => change('displayName', e.target.value)} />
          </Field>
          <Field label="Experience level">
            <select className={inputClass} value={form.experienceLevel} required={onboarding} onChange={e => change('experienceLevel', e.target.value as Profile['experienceLevel'])}>
              <option value="">Select your experience</option>
              <option value="student">Student</option><option value="fresher">Fresher</option>
              <option value="early-career">Early career</option><option value="experienced">Experienced professional</option>
            </select>
          </Field>
          <Field label="Target job role">
            <input className={inputClass} value={form.targetRole} maxLength={120} required={onboarding} placeholder="Full-stack developer" onChange={e => change('targetRole', e.target.value)} />
          </Field>
          <Field label="Target industry (optional)">
            <input className={inputClass} value={form.targetIndustry} maxLength={120} placeholder="Software, finance, healthcare…" onChange={e => change('targetIndustry', e.target.value)} />
          </Field>
        </div>
        <Field label="Education (optional)">
          <textarea className={inputClass} rows={3} maxLength={2000} value={form.education} placeholder="Qualification, institution and graduation year" onChange={e => change('education', e.target.value)} />
        </Field>
        <Field label="Technical skills (optional)" hint="Separate skills with commas. Up to 50 skills.">
          <input className={inputClass} value={skills} maxLength={4000} placeholder="React, TypeScript, PostgreSQL" onChange={e => { setSkills(e.target.value); setSaved('') }} />
        </Field>
        <Field label="Career goals (optional)">
          <textarea className={inputClass} rows={3} maxLength={2000} value={form.careerGoals} placeholder="What would you like to achieve next?" onChange={e => change('careerGoals', e.target.value)} />
        </Field>
        <Field label="Preferred interview language" hint="Saved for interview setup. Language availability depends on the practice mode.">
          <select className={inputClass} value={form.interviewLanguage} onChange={e => change('interviewLanguage', e.target.value as Profile['interviewLanguage'])}>
            <option>English</option><option>Hindi</option>
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Annual salary minimum (optional)">
            <input className={inputClass} type="number" min={0} max={1000000000} step={1} value={form.salaryMin ?? ''} onChange={e => change('salaryMin', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Annual salary maximum (optional)">
            <input className={inputClass} type="number" min={0} max={1000000000} step={1} value={form.salaryMax ?? ''} onChange={e => change('salaryMax', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Salary currency">
            <select className={inputClass} value={form.salaryCurrency} onChange={e => change('salaryCurrency', e.target.value as Profile['salaryCurrency'])}>
              {['INR', 'USD', 'EUR', 'GBP'].map(currency => <option key={currency}>{currency}</option>)}
            </select>
          </Field>
        </div>
        {!onboarding && <>
          <Field label="Bio (optional)"><textarea className={inputClass} rows={3} maxLength={2000} value={form.bio} onChange={e => change('bio', e.target.value)} /></Field>
          {(['github', 'linkedin', 'portfolio'] as const).map(key => <Field key={key} label={key === 'github' ? 'GitHub' : key === 'linkedin' ? 'LinkedIn' : 'Portfolio'}>
            <input type="url" className={inputClass} maxLength={300} value={form[key]} placeholder="https://…" onChange={e => change(key, e.target.value)} />
          </Field>)}
        </>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{saved}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving}>{onboarding ? 'Complete setup' : 'Save profile'}</Button>
          {onboarding && <Button type="button" variant="secondary" disabled={saving} onClick={() => void save(false)}>Save draft</Button>}
          {!onboarding && <Link className="text-sm underline underline-offset-4" href="/dashboard/settings">Account settings</Link>}
        </div>
      </fieldset>
      {user?.primaryEmailAddress && <p className="mt-6 break-all text-xs text-zinc-500">Signed in as {user.primaryEmailAddress.emailAddress}</p>}
    </form>
  )
}
