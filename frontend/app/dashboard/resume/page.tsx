'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { CheckCircle, FileText, Lightbulb, MagicWand, Palette, Plus, Sparkle, Trash } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type Resume } from '@/lib/api'
import { PageHeader, Button, Field, inputClass, ErrorNote, EmptyState, SkeletonList, Badge, card } from '@/components/dashboard/ui'
import ResumeView from '@/components/dashboard/ResumeView'

const templates = [
  { id: 'classic', name: 'Classic', description: 'Clear and familiar', swatch: 'bg-zinc-900' },
  { id: 'modern', name: 'Modern', description: 'Bold, spacious layout', swatch: 'bg-emerald-600' },
  { id: 'minimal', name: 'Minimal', description: 'Simple and focused', swatch: 'bg-stone-400' },
]

export default function ResumesPage() {
  const { getToken } = useAuth()
  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [selected, setSelected] = useState<Resume | null>(null)
  const [tab, setTab] = useState<'build' | 'suggestions'>('build')
  const [targetRole, setTargetRole] = useState('')
  const [rawInput, setRawInput] = useState('')
  const [template, setTemplate] = useState('classic')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { const data = await apiFetch<{ resumes: Resume[] }>('/api/resumes', getToken); setResumes(data.resumes ?? []) }
    catch (caught) { setError(errorMessage(caught)); setResumes([]) }
  }, [getToken])
  useEffect(() => { load() }, [load])

  const suggestions = useMemo(() => {
    const words = rawInput.trim().split(/\s+/).filter(Boolean).length
    const hasMetrics = /\d+[%+]|\$\d+|\d+ (users|customers|people|projects)/i.test(rawInput)
    const hasAction = /(built|led|improved|created|launched|reduced|increased|designed)/i.test(rawInput)
    return [
      { title: 'Add measurable impact', detail: hasMetrics ? 'You already have measurable outcomes. Keep those numbers near the start of each bullet.' : 'Add a result, scale, or time saved to show the impact of your work.', done: hasMetrics },
      { title: 'Lead with action', detail: hasAction ? 'Your experience includes strong action verbs.' : 'Start experience bullets with verbs such as Built, Improved, Led, or Designed.', done: hasAction },
      { title: 'Give us more context', detail: words >= 80 ? 'You have enough detail to create a strong first draft.' : 'Include companies, projects, tools, and education for a more complete draft.', done: words >= 80 },
      { title: 'Tailor for a role', detail: targetRole ? `Your draft will be tailored for ${targetRole}.` : 'Add a target role so your headline and skills can match the jobs you want.', done: Boolean(targetRole) },
    ]
  }, [rawInput, targetRole])

  async function generate(event: React.FormEvent) {
    event.preventDefault(); setError(''); setGenerating(true)
    try {
      const data = await apiFetch<{ resume: Resume }>('/api/resumes/generate', getToken, { method: 'POST', body: JSON.stringify({ rawInput, targetRole, title: `${targetRole || 'My'} ${templates.find((item) => item.id === template)?.name} resume` }) })
      setSelected(data.resume); setRawInput(''); await load()
    } catch (caught) { setError(errorMessage(caught)) } finally { setGenerating(false) }
  }
  async function remove(id: string) {
    try { await apiFetch(`/api/resumes/${id}`, getToken, { method: 'DELETE' }); if (selected?._id === id) setSelected(null); await load() }
    catch (caught) { setError(errorMessage(caught)) }
  }
  if (selected) return <ResumeView resume={selected} onBack={() => setSelected(null)} onSaved={(resume) => { setSelected(resume); load() }} />

  return <>
    <PageHeader title="Resume studio" description="Analyze your experience, choose a template, and build a resume tailored to the role you want." />
    <div className="mb-7 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
      {([['build', 'Build resume'], ['suggestions', 'Suggestions']] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === id ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>{id === 'build' ? <MagicWand className="mr-2 inline" size={16} /> : <Lightbulb className="mr-2 inline" size={16} />}{label}</button>)}
    </div>
    {tab === 'build' ? <div className="grid gap-8 lg:grid-cols-12">
      <section className={`${card} p-6 lg:col-span-7`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Start with your story</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your existing resume, LinkedIn notes, or rough bullet points all work.</p></div><Badge tone="accent">AI assisted</Badge></div>
        <form onSubmit={generate} className="mt-6 grid gap-5"><Field label="Target role" hint="This helps tailor your headline and the skills we prioritize."><input className={inputClass} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Product Designer" /></Field><Field label="Your experience" hint="Include accomplishments, projects, skills, companies, education, and anything you are proud of."><textarea className={`${inputClass} min-h-[220px] resize-y leading-relaxed`} value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder="Paste your current resume here, or write rough notes about your career..." /></Field>
          <div><div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"><Palette size={17} /> Choose a template</div><div className="grid gap-3 sm:grid-cols-3">{templates.map((item) => <button type="button" onClick={() => setTemplate(item.id)} key={item.id} className={`rounded-xl border p-3 text-left transition ${template === item.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-400/10' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800'}`}><span className={`mb-5 block h-16 rounded-lg ${item.swatch}`} /><span className="block font-medium">{item.name}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.description}</span></button>)}</div></div>
          {error && <ErrorNote>{error}</ErrorNote>}<div className="flex items-center gap-4"><Button type="submit" loading={generating}>{!generating && <Sparkle size={16} weight="fill" />}{generating ? 'Creating your resume' : 'Analyze and create'}</Button><span className="text-sm text-zinc-500">{rawInput.trim().length < 40 ? 'Add a few sentences to begin' : 'Your draft is ready to analyze'}</span></div>
        </form></section>
      <SavedResumes resumes={resumes} onOpen={setSelected} onDelete={remove} />
    </div> : <section className="grid gap-5 lg:grid-cols-12"><div className={`${card} p-6 lg:col-span-7`}><h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Suggestions for your next draft</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">They update as you add your experience and choose a target role.</p><div className="mt-6 grid gap-3">{suggestions.map((item) => <div key={item.title} className="flex gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><CheckCircle size={20} weight={item.done ? 'fill' : 'regular'} className={item.done ? 'shrink-0 text-emerald-500' : 'shrink-0 text-zinc-400'} /><div><p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.detail}</p></div></div>)}</div></div><aside className={`${card} h-fit p-6 lg:col-span-5`}><h3 className="font-semibold">Need a fresh analysis?</h3><p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Add your resume details in the builder, then use these suggestions to improve the draft before you create it.</p><Button variant="secondary" className="mt-5" onClick={() => setTab('build')}><Plus size={16} /> Add resume details</Button></aside></section>}
  </>
}

function SavedResumes({ resumes, onOpen, onDelete }: { resumes: Resume[] | null; onOpen: (resume: Resume) => void; onDelete: (id: string) => void }) {
  return <section className="lg:col-span-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Your resumes</h2>{resumes && <Badge>{resumes.length} saved</Badge>}</div><div className="mt-4">{resumes === null ? <SkeletonList rows={2} /> : resumes.length === 0 ? <EmptyState title="Your first draft starts here" description="Paste your experience and we’ll turn it into an editable resume." /> : <ul className="grid gap-3">{resumes.map((resume) => <li key={resume._id} className={`${card} flex items-center gap-3 p-4`}><FileText size={21} weight="duotone" className="shrink-0 text-emerald-600" /><button onClick={() => onOpen(resume)} className="min-w-0 flex-1 text-left"><p className="truncate font-medium text-zinc-950 dark:text-zinc-50">{resume.title}</p><p className="mt-1 truncate text-sm text-zinc-500">{resume.targetRole || 'General resume'} · Updated {new Date(resume.updatedAt).toLocaleDateString()}</p></button><Button variant="danger" onClick={() => onDelete(resume._id)} aria-label={`Delete ${resume.title}`} className="px-3"><Trash size={16} /></Button></li>)}</ul>}</div></section>
}
