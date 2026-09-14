'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'

const steps = [
  {
    title: 'Open a room',
    body: 'Sign in and start a session. The room gets an id the moment it exists, so there is nothing to configure first.',
  },
  {
    title: 'Send the link',
    body: 'Paste it into the thread you are already in. The candidate opens it in their browser and joins the same room.',
  },
  {
    title: 'Work the problem together',
    body: 'They write, you watch it happen, and you talk it through on camera without either side sharing a screen.',
  },
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // The rail fills as you read. It maps scroll position to progress through
  // the sequence, which is the one thing a numbered list cannot show.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 65%', 'end 60%'],
  })
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    restDelta: 0.001,
  })

  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32"
    >
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <h2 className="max-w-[16ch] text-3xl leading-[1.1] font-semibold tracking-tighter text-balance text-zinc-950 sm:text-5xl dark:text-zinc-50">
            How an interview runs
          </h2>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            From an empty calendar slot to a candidate writing code, without a
            setup call in between.
          </p>

          <Link
            href="/interview"
            className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium whitespace-nowrap text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Start interviewing
            <ArrowRight
              size={16}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <div ref={ref} className="relative lg:col-span-7">
          {/* Track */}
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[15px] w-px bg-zinc-200 dark:bg-zinc-800"
          />
          {/* Progress fill */}
          <motion.div
            aria-hidden
            style={{ scaleY: reduce ? 1 : scaleY }}
            className="absolute top-2 bottom-2 left-[15px] w-px origin-top bg-emerald-500 dark:bg-emerald-400"
          />

          <ol className="space-y-12">
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative pl-12"
              >
                <span
                  aria-hidden
                  className="absolute top-1.5 left-[9px] h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-white dark:border-emerald-400 dark:bg-zinc-950"
                />
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[54ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {step.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
