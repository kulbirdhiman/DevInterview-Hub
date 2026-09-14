import { Lightning, Browsers, ShieldCheck, Cube, SquaresFour } from '@phosphor-icons/react/dist/ssr'
import Reveal from './Reveal'

const cardBase =
  'rounded-2xl border border-zinc-200 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-900/50'

export default function WhyUs() {
  return (
    <section id="why" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
      <Reveal>
        <h2 className="max-w-[18ch] text-3xl leading-[1.1] font-semibold tracking-tighter text-balance text-zinc-950 sm:text-5xl dark:text-zinc-50">
          Why teams keep it open all day
        </h2>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Most interview tooling asks everyone to install something, then spends the
          first ten minutes failing to share a screen.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Patterned surface cell */}
        <Reveal className="lg:col-span-7">
          <article className="relative flex h-full min-h-[22rem] flex-col justify-end overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 p-7 dark:border-zinc-800">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.13) 1px, transparent 0)',
                backgroundSize: '22px 22px',
              }}
            />
            <div
              aria-hidden
              className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-emerald-500/20 blur-[90px]"
            />
            <div className="relative">
              <Browsers size={22} weight="duotone" className="text-emerald-400" />
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                Nothing for the candidate to install
              </h3>
              <p className="mt-2 max-w-[42ch] leading-relaxed text-zinc-400">
                They open a link in the browser they already have and start typing.
              </p>
            </div>
          </article>
        </Reveal>

        {/* Gradient cell */}
        <Reveal delay={0.08} className="lg:col-span-5">
          <article className="relative h-full min-h-[22rem] overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-7 dark:border-emerald-900/50 dark:from-emerald-950 dark:via-zinc-900 dark:to-zinc-950">
            <SquaresFour size={22} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Code and video in one window
            </h3>
            <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
              A split view, not two apps fighting for the same screen. You watch how
              someone thinks while they write, without asking them to alt-tab.
            </p>
          </article>
        </Reveal>

        {/* Text cells */}
        <Reveal delay={0.04} className="lg:col-span-5">
          <article className={`${cardBase} h-full`}>
            <Lightning size={22} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Rooms open in a click
            </h3>
            <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
              No scheduling dance and no calendar plugin. Create the room when the
              call starts and share the link in chat.
            </p>
          </article>
        </Reveal>

        <Reveal delay={0.12} className="lg:col-span-7">
          <article className={`${cardBase} h-full`}>
            <ShieldCheck size={22} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Your accounts, your database
            </h3>
            <p className="mt-2 max-w-[52ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Authentication runs through Clerk and candidate records live in your own
              MongoDB. Nothing about your hiring process sits in someone else&apos;s
              analytics pipeline.
            </p>
          </article>
        </Reveal>

        {/* Full-width cell with a real command */}
        <Reveal delay={0.06} className="lg:col-span-12">
          <article className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-7 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <div>
              <Cube size={22} weight="duotone" className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Run the whole stack with one command
              </h3>
              <p className="mt-2 max-w-[52ch] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Frontend, API, and database are containerised. Clone it, add your keys,
                and bring the stack up locally or on your own servers.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-white px-5 py-4 font-mono text-sm text-zinc-800 sm:shrink-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              <code>docker compose up</code>
            </pre>
          </article>
        </Reveal>
      </div>
    </section>
  )
}
