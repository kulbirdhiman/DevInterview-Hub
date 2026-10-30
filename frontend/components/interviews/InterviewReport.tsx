import type { InterviewSession } from '@/lib/api'
import { card } from '@/components/dashboard/ui'

export default function InterviewReport({ session }: { session: InterviewSession }) {
  const report = session.report
  const ranked = session.turns.map((turn, index) => ({ score: turn.evaluation?.score, index })).filter((row): row is { score: number; index: number } => typeof row.score === 'number').sort((a, b) => b.score - a.score)
  return <section className="space-y-5">
    {report && <div className={`${card} space-y-4 p-6`}>
      <h2 className="text-xl font-semibold">Practice report</h2>
      <p className="text-3xl font-semibold">{report.score === null ? 'Partial report — no overall score' : `${report.score}/100`}</p>
      <p>{report.summary}</p><p className="text-sm text-zinc-500">{report.rubricVersion} · {report.coverage}% coverage · {report.answered} assessed answers</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Dimension</th><th>Weight</th><th>Rating / 4</th><th>Answers</th></tr></thead><tbody>{report.dimensions.map(item => <tr key={item.key} className="border-t border-zinc-200 dark:border-zinc-700"><td className="py-2 capitalize">{item.key}</td><td>{item.weight}%</td><td>{item.rating === null ? 'Not assessed' : item.rating.toFixed(1)}</td><td>{item.samples}</td></tr>)}</tbody></table></div>
      {ranked.length > 0 && <p className="text-sm">Highest assessed answer: question {ranked[0].index + 1}. {ranked.length > 1 && `Practice next: question ${ranked.at(-1)!.index + 1}.`} Compare the actual evidence below.</p>}
      {report.studyTopics.length > 0 && <><h3 className="font-semibold">Next practice topics</h3><ul className="list-disc space-y-1 pl-5">{report.studyTopics.map(topic => <li key={topic}>{topic}</li>)}</ul></>}
      <p className="text-sm text-zinc-500">{report.disclaimer}</p>
    </div>}
    {session.turns.filter(turn => turn.answeredAt).map((turn, index) => <details key={turn._id} className={`${card} p-5`} open={session.state === 'completed'}>
      <summary className="cursor-pointer font-semibold">Answer {index + 1} · {turn.evaluation?.score == null ? 'Not assessed' : `${turn.evaluation.score}/100`}</summary>
      <h3 className="mt-4 font-medium">{turn.prompt}</h3><p className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-800">{turn.answer || 'Skipped — no answer provided.'}</p>
      {!turn.evaluation ? <p className="mt-3 text-sm text-zinc-500">Your answer is saved. Evaluation is pending or unavailable.</p> : <div className="mt-4 space-y-4">
        {turn.evaluation.dimensions.map(item => <div key={item.key}><h4 className="text-sm font-semibold capitalize">{item.key}: {item.rating === null ? 'Not assessed' : `${item.rating}/4`}</h4><p className="mt-1 text-sm">{item.reason}</p>{item.excerpts.map((excerpt, i) => <blockquote key={i} className="mt-2 border-l-2 border-emerald-500 pl-3 text-sm text-zinc-600 dark:text-zinc-400">“{excerpt}”</blockquote>)}</div>)}
        {([['Strengths', turn.evaluation.strengths], ['Missing information / improvements', turn.evaluation.gaps], ['Better answer outline', turn.evaluation.betterAnswerOutline], ['Study topics', turn.evaluation.studyTopics]] as const).map(([title, values]) => values.length > 0 && <div key={title}><h4 className="text-sm font-semibold">{title}</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{values.map((value, i) => <li key={i}>{value}</li>)}</ul></div>)}
        {!!turn.expectedEvidence?.length && <details className="text-sm"><summary className="cursor-pointer">What this question assessed</summary><ul className="mt-2 list-disc pl-5">{turn.expectedEvidence.map(value => <li key={value}>{value}</li>)}</ul></details>}
      </div>}
    </details>)}
  </section>
}
