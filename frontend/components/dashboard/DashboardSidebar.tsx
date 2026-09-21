'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  SquaresFour,
  FileText,
  User,
  Sparkle,
  List,
  X,
} from '@phosphor-icons/react'

const links = [
  { href: '/dashboard', label: 'Overview', icon: SquaresFour },
  { href: '/dashboard/resume', label: 'Resume studio', icon: FileText },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-400">
        <Sparkle size={18} weight="fill" className="text-white dark:text-zinc-950" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        ResumeCraft
      </span>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        // Overview must match exactly or every child route lights it up.
        const active =
          href === '/dashboard' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active
                ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            <Icon size={19} weight={active ? 'fill' : 'regular'} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserFooter() {
  const { user } = useUser()
  return (
    <div className="flex items-center gap-3 border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
      <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-full' } }} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {user?.fullName ?? user?.firstName ?? 'Your account'}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">
          {user?.primaryEmailAddress?.emailAddress}
        </p>
      </div>
    </div>
  )
}

export default function DashboardSidebar() {
  const [open, setOpen] = useState(false)

  // The drawer sits above the page, so the body behind it must not scroll.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Desktop: a fixed rail the page content is padded around. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
        <UserFooter />
      </aside>

      {/* Mobile: a top bar that opens the same nav as a drawer. */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur-xl lg:hidden dark:border-zinc-800 dark:bg-zinc-950/85">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="-ml-2 rounded-xl p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          <List size={22} weight="bold" />
        </button>
        <Logo />
        <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-full' } }} />
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="-mr-2 rounded-xl p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserFooter />
          </div>
        </div>
      )}
    </>
  )
}
