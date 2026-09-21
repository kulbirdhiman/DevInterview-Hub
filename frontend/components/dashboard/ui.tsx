'use client'

import type { ReactNode } from 'react'
import { Warning, SpinnerGap } from '@phosphor-icons/react'

export const card =
  'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[60ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}) {
  const variants = {
    primary:
      'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300',
    secondary:
      'border border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
    ghost:
      'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    danger:
      'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
  }
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {loading && <SpinnerGap size={16} weight="bold" className="animate-spin" />}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      {children}
      {hint && <span className="text-sm text-zinc-600 dark:text-zinc-400">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-zinc-950 placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500'

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    >
      <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className={`${card} px-6 py-14 text-center`}>
      <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-[46ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

/** Skeleton rows that match the shape of the list they stand in for. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${card} animate-pulse p-6`}>
          <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'warn'
}) {
  const tones = {
    neutral:
      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    accent:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
