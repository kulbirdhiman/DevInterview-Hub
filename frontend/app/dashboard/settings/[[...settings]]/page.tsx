import { Suspense } from 'react'
import { UserProfile } from '@clerk/nextjs'
import Link from 'next/link'
import { PageHeader } from '@/components/dashboard/ui'

export default function SettingsPage() {
  return <>
    <PageHeader title="Account settings" description="Manage your identity, verified email addresses, connected accounts and account security." />
    <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">Looking for your career goals or interview preferences? <Link className="underline underline-offset-4" href="/dashboard/profile">Edit your career profile</Link>.</p>
    <Suspense fallback={<p role="status">Loading account settings…</p>}>
      <UserProfile routing="path" path="/dashboard/settings" appearance={{ elements: { rootBox: 'w-full', cardBox: 'w-full max-w-full' } }} />
    </Suspense>
  </>
}
