import Link from 'next/link'
import { ArrowRight, CheckCircle, FileText, Lightbulb, Layout } from '@phosphor-icons/react/dist/ssr'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><FileText size={19} weight="fill" /></span>
          ResumeCraft
        </Link>
        <Link href="/dashboard" className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">Open studio</Link>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-16 pb-28 sm:px-8 lg:grid-cols-2 lg:pt-24">
        <div>
          <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-emerald-700 uppercase">Your career, clearly presented</p>
          <h1 className="max-w-[11ch] text-5xl leading-[0.98] font-semibold tracking-tighter sm:text-7xl">Make your resume work harder.</h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-zinc-600">Analyze your experience, rebuild it with a template you like, and get precise suggestions before you apply.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/dashboard/resume" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-500">Build my resume <ArrowRight size={17} weight="bold" /></Link>
            <a href="#how" className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-700">How it works</a>
          </div>
        </div>
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-2xl shadow-emerald-950/10 sm:p-9">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-5"><span className="font-semibold">Resume health</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">82 / 100</span></div>
          {[['Impact statements', 'Add metrics to 3 experience bullets', 'Almost there'], ['Role alignment', 'Highlight React and TypeScript earlier', 'Strong'], ['Structure', 'Your sections are easy to scan', 'Strong']].map(([title, body, status]) => <div key={title} className="flex gap-4 border-b border-zinc-100 py-5 last:border-0"><CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" /><div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-zinc-500">{body}</p></div><span className="ml-auto text-xs font-medium text-emerald-700">{status}</span></div>)}
        </div>
      </section>

      <section id="how" className="border-y border-stone-200 bg-white py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><p className="text-sm font-semibold tracking-[0.18em] text-emerald-700 uppercase">A better application workflow</p><h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">Start with what you have. Leave with a resume you can send.</h2><div className="mt-14 grid gap-5 md:grid-cols-3">{[[FileText,'1. Analyze','Paste your existing resume or rough notes. We find the content worth keeping and the gaps to fill.'],[Layout,'2. Shape it','Choose a template and recreate your experience in a clean, recruiter-friendly structure.'],[Lightbulb,'3. Improve it','Use tailored suggestions to sharpen each section for the job you want.']].map(([Icon,title,body]) => { const ItemIcon = Icon as typeof FileText; return <article key={title as string} className="rounded-2xl bg-stone-50 p-7"><ItemIcon size={25} weight="duotone" className="text-emerald-600"/><h3 className="mt-8 text-xl font-semibold">{title as string}</h3><p className="mt-3 leading-relaxed text-zinc-600">{body as string}</p></article>})}</div></div></section>
      <section className="mx-auto max-w-7xl px-5 py-24 text-center sm:px-8"><h2 className="text-4xl font-semibold tracking-tight">Ready to tell a stronger story?</h2><Link href="/dashboard/resume" className="mt-7 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 font-medium text-white">Open ResumeCraft <ArrowRight size={17} /></Link></section>
    </main>
  )
}
