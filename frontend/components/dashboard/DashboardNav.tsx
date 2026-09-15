'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  SquaresFour,
  FileText,
  ChatsCircle,
  User,
  VideoCamera,
  BracketsAngle,
} from '@phosphor-icons/react'

const links = [
  { href: '/dashboard', label: 'Overview', icon: SquaresFour },
  { href: '/dashboard/resume', label: 'Resumes', icon: FileText },
  { href: '/dashboard/prep', label: 'Interview prep', icon: ChatsCircle },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/interview', label: 'Practice room', icon: VideoCamera },
]

export default function DashboardNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-400">
            <BracketsAngle size={18} weight="bold" className="text-white dark:text-zinc-950" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-zinc-900 sm:block dark:text-zinc-50">
            DevInterview Hub
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map(({ href, label, icon: Icon }) => {
            // Overview must match exactly or every child route lights it up.
            const active =
              href === '/dashboard' ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                }`}
              >
                <Icon size={17} weight={active ? 'fill' : 'regular'} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            )
          })}
        </nav>

        <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-full' } }} />
      </div>
    </header>
  )
}
