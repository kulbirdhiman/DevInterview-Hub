'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'

export default function FinalCta() {
  const reduce = useReducedMotion()

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:pb-32">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 px-7 py-20 text-center dark:border-zinc-800"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[100px]"
        />

        <h2 className="relative mx-auto max-w-[20ch] text-3xl leading-[1.1] font-semibold tracking-tighter text-balance text-white sm:text-5xl">
          Your next interview could start in a minute
        </h2>
        <p className="relative mx-auto mt-5 max-w-[50ch] text-lg leading-relaxed text-zinc-400">
          Create an account, open a room, and send the link.
        </p>

        <div className="relative mt-9 flex justify-center">
          <Link
            href="/interview"
            className="group inline-flex items-center gap-2 rounded-full bg-emerald-400 px-7 py-3.5 text-[15px] font-medium whitespace-nowrap text-zinc-950 transition-all hover:bg-emerald-300 active:scale-[0.98]"
          >
            Start interviewing
            <ArrowRight
              size={17}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
