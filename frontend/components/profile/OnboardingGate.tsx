'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch, errorMessage, type Profile } from '@/lib/api'
import { Button, ErrorNote } from '@/components/dashboard/ui'

export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, userId } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<{ userId: string; complete: boolean; error?: string } | null>(null)
  // Account security must remain available even during incomplete onboarding.
  const settings = pathname.startsWith('/dashboard/settings')

  useEffect(() => {
    if (!isLoaded || !userId || settings) return
    let canceled = false
    apiFetch<{ user: Profile }>('/api/users/me', getToken)
      .then(({ user }) => {
        if (canceled) return
        const complete = Boolean(user.onboardingCompletedAt)
        setStatus({ userId, complete })
        if (!complete) router.replace('/onboarding')
      })
      .catch(e => { if (!canceled) setStatus({ userId, complete: false, error: errorMessage(e) }) })
    return () => { canceled = true }
  }, [getToken, isLoaded, userId, router, settings, attempt])

  if (settings) return children
  if (status?.userId === userId && status?.error) return <div className="space-y-4">
    <ErrorNote>{status.error}</ErrorNote>
    <Button onClick={() => { setStatus(null); setAttempt(value => value + 1) }}>Retry</Button>
  </div>
  if (!isLoaded || !userId || status?.userId !== userId || !status?.complete) return <p role="status">Checking your profile…</p>
  return children
}
