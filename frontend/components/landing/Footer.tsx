import Link from 'next/link'
import { BracketsAngle } from '@phosphor-icons/react/dist/ssr'

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Why it works', href: '#why' },
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Create account', href: '/sign-up' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-3 sm:px-6">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 dark:bg-emerald-400">
              <BracketsAngle size={18} weight="bold" className="text-white dark:text-zinc-950" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              DevInterview Hub
            </span>
          </Link>
          <p className="mt-4 max-w-[34ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
            A shared editor and live video for technical interviews, self-hosted on
            your own stack.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.heading}>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {column.heading}
            </h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <p className="border-t border-zinc-200 pt-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          DevInterview Hub
        </p>
      </div>
    </footer>
  )
}
