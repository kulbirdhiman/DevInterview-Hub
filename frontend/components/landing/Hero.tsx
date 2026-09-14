'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'

const headline = ['The', 'whole', 'technical', 'interview', 'in', 'one', 'tab.']
const headlineText = headline.join(' ')

export default function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // Parallax drift on the hero image as the page leaves. Driven by motion
  // values, never React state, so scrolling never re-renders the tree.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '14%'])
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0])

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100dvh] items-center overflow-hidden pt-24 pb-16"
    >
      {/* Ambient wash. Slow, low-contrast, purely atmospheric. */}
      <motion.div
        aria-hidden
        style={{ opacity: reduce ? 1 : fade }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full bg-emerald-500/10 blur-[120px] dark:bg-emerald-500/15" />
        <div className="absolute top-1/3 -left-40 h-[30rem] w-[30rem] rounded-full bg-teal-400/10 blur-[120px] dark:bg-teal-400/10" />
      </motion.div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8">
        {/* Copy. Asymmetric: 6 of 12 columns, not a centered stack. */}
        <div className="lg:col-span-6">
          {/* The words are split into spans to stagger them, so the readable
              sentence lives on aria-label and the fragments are hidden. */}
          <h1
            aria-label={headlineText}
            className="text-[2.6rem] leading-[1.05] font-semibold tracking-tighter text-balance text-zinc-950 sm:text-6xl lg:text-[3.6rem] dark:text-zinc-50"
          >
            {headline.map((word, i) => (
              <motion.span
                key={word + i}
                aria-hidden
                initial={reduce ? false : { opacity: 0, y: '0.4em' }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.1 + i * 0.055,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="mr-[0.25em] inline-block"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-[46ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            A shared code editor and live video in the same window. No installs, no
            screen sharing, no setup call before the real call.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.74, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            {/* /interview is gated by the Clerk proxy, so signed-out visitors
                land on sign-in and arrive in the room straight after. */}
            <Link
              href="/interview"
              className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-[15px] font-medium whitespace-nowrap text-white transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
            >
              Start interviewing
              <ArrowRight
                size={17}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center rounded-full border border-zinc-300 px-6 py-3 text-[15px] font-medium whitespace-nowrap text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              See how it works
            </a>
          </motion.div>
        </div>

        {/* Visual. Offset one column right for asymmetry. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6"
        >
          <motion.div
            style={{ y: reduce ? 0 : imageY }}
            className="relative aspect-[20/11] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/40"
          >
            <Image
              src="/code-playground.png"
              alt="The shared editor running a JavaScript function with its console output beside it"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-left-top"
            />
          </motion.div>
        </motion.div>
      </div>

      <div id="nav-sentinel" className="absolute bottom-0 h-px w-full" />
    </section>
  )
}
