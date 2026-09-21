'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react'
import { apiFetch, errorMessage, type PrepQuestion, type PrepSession } from '@/lib/api'
import { Button, ErrorNote, inputClass, card, Badge } from './ui'

const KIND_LABEL: Record<PrepQuestion['kind'], string> = {
  coding: 'Coding',
  'system-design': 'System design',
  behavioural: 'Behavioural',
  concept: 'Concept',
}

/** Walks one question at a time so the page stays a single task, not a wall of forms. */
export default function PrepRunner({
  session,
  onBack,
}: {
  session: PrepSession
  onBack: () => void
}) {
  const { getToken } = useAuth()
  const [questions, setQuestions] = useState<PrepQuestion[]>(session.questions)
  const [index, setIndex] = useState(() => {
    const firstUnanswered = session.questions.findIndex((q) => !q.answeredAt)
    return firstUnanswered === -1 ? 0 : firstUnanswered
  })
  const [answer, setAnswer] = useState(session.questions[0]?.answer ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const question = questions[index]
  const answeredCount = questions.filter((q) => q.answeredAt).length
  const reviewed = Boolean(question?.answeredAt)

  function go(next: number) {
    setIndex(next)
    setAnswer(questions[next]?.answer ?? '')
    setError('')
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const d = await apiFetch<{ question: PrepQuestion }>(
        `/api/prep/${session._id}/questions/${question._id}/answer`,
        getToken,
        { method: 'POST', body: JSON.stringify({ answer }) }
      )
      setQuestions((qs) => qs.map((q) => (q._id === question._id ? d.question : q)))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!question) return null

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" />
          All sessions
        </Button>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {answeredCount} of {questions.length} answered
        </p>
      </div>

      {/* Progress across the set. */}
      <div className="mb-6 flex gap-1.5" role="list" aria-label="Question progress">
        {questions.map((q, i) => (
          <button
            key={q._id}
            role="listitem"
            onClick={() => go(i)}
            aria-label={`Question ${i + 1}${q.answeredAt ? ', answered' : ''}`}
            aria-current={i === index ? 'step' : undefined}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === index
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : q.answeredAt
                  ? 'bg-emerald-300 dark:bg-emerald-500/50'
                  : 'bg-zinc-200 dark:bg-zinc-800'
            }`}
          />
        ))}
      </div>

      <article className={`${card} p-6 sm:p-8`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{KIND_LABEL[question.kind]}</Badge>
          <Badge>{question.difficulty}</Badge>
          <span className="text-sm text-zinc-500 dark:text-zinc-500">
            Question {index + 1}
          </span>
        </div>

        <h2 className="mt-4 text-xl leading-relaxed font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-zinc-50">
          {question.prompt}
        </h2>

        <div className="mt-6">
          <label
            htmlFor="answer"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Your answer
          </label>
          <textarea
            id="answer"
            className={`${inputClass} mt-2 min-h-[180px] resize-y leading-relaxed`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer as if you were speaking to the interviewer."
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={submit} loading={submitting}>
            {!submitting && <PaperPlaneTilt size={16} weight="fill" />}
            {reviewed ? 'Answer again' : 'Get feedback'}
          </Button>
          {index > 0 && (
            <Button variant="ghost" onClick={() => go(index - 1)}>
              Previous
            </Button>
          )}
          {index < questions.length - 1 && (
            <Button variant="secondary" onClick={() => go(index + 1)}>
              Next question
            </Button>
          )}
        </div>

        {reviewed && (
          <section className="mt-8 border-t border-zinc-200 pt-7 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Feedback
              </h3>
              {typeof question.score === 'number' && (
                <p className="font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {question.score}
                  <span className="text-base text-zinc-500 dark:text-zinc-500">/10</span>
                </p>
              )}
            </div>

            {question.feedback && (
              <p className="mt-3 max-w-[70ch] leading-relaxed text-zinc-700 dark:text-zinc-300">
                {question.feedback}
              </p>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {question.strengths && question.strengths.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    What worked
                  </h4>
                  <ul className="mt-2 grid gap-2">
                    {question.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-2 leading-relaxed text-zinc-700 dark:text-zinc-300"
                      >
                        <CheckCircle
                          size={17}
                          weight="fill"
                          className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {question.improvements && question.improvements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Work on this
                  </h4>
                  <ul className="mt-2 grid gap-2">
                    {question.improvements.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-2 leading-relaxed text-zinc-700 dark:text-zinc-300"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {question.lookFor.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  What a strong answer covers
                </summary>
                <ul className="mt-3 grid gap-2">
                  {question.lookFor.map((p, i) => (
                    <li
                      key={i}
                      className="flex gap-2 leading-relaxed text-zinc-600 dark:text-zinc-400"
                    >
                      <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
                        ·
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </article>
    </>
  )
}
