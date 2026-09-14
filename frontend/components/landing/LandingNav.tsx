'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SignInButton, UserButton, useUser } from '@clerk/nextjs'
import { BracketsAngle } from '@phosphor-icons/react'

const links = [
  { href: '#why', label: 'Why it works' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
]

export default function LandingNav() {
  const reduce = useReducedMotion()
  const { isLoaded, isSignedIn } = useUser()
  const [lifted, setLifted] = useState(false)

  // Nav gains a border and backdrop once the hero is behind it, so the
  // hero reads as edge-to-edge at rest. IntersectionObserver instead of a
  // scroll listener: no work on frames where nothing changed.
  useEffect(() => {
    const sentinel = document.getElementById('nav-sentinel')
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setLifted(!entry.isIntersecting),
      { rootMargin: '0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.header
      initial={reduce ? false : { y: -72 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        lifted
          ? 'border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80'
          : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-400">
            <BracketsAngle size={18} weight="bold" className="text-white dark:text-zinc-950" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            DevInterview Hub
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Reserve the slot while Clerk resolves so the nav does not reflow. */}
          {!isLoaded && <div aria-hidden className="h-9 w-40" />}

          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <button className="hidden rounded-full px-4 py-2 text-sm text-zinc-600 transition-colors hover:text-zinc-950 sm:block dark:text-zinc-400 dark:hover:text-zinc-50">
                Sign in
              </button>
            </SignInButton>
          )}

          {isLoaded && (
            <Link
              href="/interview"
              className="whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
            >
              Start interviewing
            </Link>
          )}

          {isLoaded && isSignedIn && (
            <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 rounded-full' } }} />
          )}
        </div>
      </nav>
    </motion.header>
  )
}
