import CareerProfileForm from '@/components/profile/CareerProfileForm'
import { PageHeader } from '@/components/dashboard/ui'

export default function ProfilePage() {
  return <>
    <PageHeader title="Your career profile" description="Keep your background, target role and preparation preferences up to date." />
    <CareerProfileForm />
  </>
}
