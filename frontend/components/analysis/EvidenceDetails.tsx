import type { Evidence } from '@/lib/api'

export default function EvidenceDetails({ refs, evidence }: { refs: string[]; evidence: Evidence[] }) {
  if (!refs.length) return null
  return <details className="mt-2 text-sm"><summary className="cursor-pointer text-emerald-700 dark:text-emerald-300">View source evidence</summary><ul className="mt-2 space-y-2">{refs.map(id => {
    const item = evidence.find(row => row.id === id)
    return <li key={id} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800"><p className="text-xs font-medium">{item?.section ?? id}</p><p className="mt-1 whitespace-pre-wrap break-words">{item?.text ?? 'Source not available.'}</p></li>
  })}</ul></details>
}
