import { UserButton } from '@clerk/nextjs'
import CareerProfileForm from '@/components/profile/CareerProfileForm'
import { PageHeader } from '@/components/dashboard/ui'

export default function OnboardingPage() {
  return <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between"><span className="font-semibold">DevInterview Hub</span><UserButton /></div>
      <PageHeader title="Let’s personalize your preparation" description="Tell us where you are in your career and what you’re working toward. You can update these details at any time." />
      <CareerProfileForm onboarding />
    </div>
  </main>
}
