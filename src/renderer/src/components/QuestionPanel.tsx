import { useState } from 'react'
import { motion } from 'motion/react'
import type { PendingView } from '@shared/types'
import { Btn } from './PermissionPanel'

export function QuestionPanel({ pending }: { pending: PendingView }) {
  const api = window.huddle
  const questions = pending.questions ?? []
  const [picked, setPicked] = useState<Record<string, string[]>>({})

  const toggle = (q: string, label: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[q] ?? []
      if (!multi) return { ...p, [q]: [label] }
      return { ...p, [q]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label] }
    })

  const complete = questions.length > 0 && questions.every((q) => (picked[q.question] ?? []).length > 0)
  const send = () => {
    const answers: Record<string, string> = {}
    for (const q of questions) answers[q.question] = (picked[q.question] ?? []).join(', ')
    api?.decide(pending.id, { kind: 'answer', answers })
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden px-3 pb-3">
      <div className="max-h-80 space-y-3 overflow-auto rounded-lg bg-panel p-2.5">
        {questions.map((q) => (
          <div key={q.question}>
            {q.header && (
              <span className="mb-1.5 inline-block rounded bg-lime px-1.5 py-px text-[10px] font-bold tracking-wide text-black uppercase">
                {q.header}
              </span>
            )}
            <div className="mb-2 text-[13px] leading-5 font-semibold">{q.question}</div>
            <div className="space-y-1">
              {q.options.map((o) => {
                const on = (picked[q.question] ?? []).includes(o.label)
                return (
                  <button
                    key={o.label}
                    onClick={() => toggle(q.question, o.label, q.multiSelect)}
                    className={`no-drag flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      on ? 'bg-lime/12 ring-1 ring-lime/60' : 'bg-card hover:bg-card-hover'
                    }`}
                  >
                    <span
                      className={`mt-[3px] grid h-3 w-3 shrink-0 place-items-center border ${
                        q.multiSelect ? 'rounded-[3px]' : 'rounded-full'
                      } ${on ? 'border-lime bg-lime' : 'border-faint'}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] leading-4 font-medium">{o.label}</span>
                      {o.description && <span className="block text-[11px] leading-4 text-muted">{o.description}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Btn primary disabled={!complete} onClick={send}>Send</Btn>
          <Btn onClick={() => api?.decide(pending.id, { kind: 'defer' })}>Answer in Terminal</Btn>
        </div>
      </div>
    </motion.div>
  )
}
