import { useState } from 'react'
import { motion } from 'motion/react'
import type { PendingView } from '@shared/types'
import { Btn } from './PermissionPanel'

/** Claude's plan, with Approve / Revise (optional feedback) / In Terminal. */
export function PlanPanel({ pending }: { pending: PendingView }) {
  const api = window.huddle
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const plan = pending.plan?.trim() || 'Claude has a plan ready. Open it in the terminal to read it.'

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden px-3 pb-3">
      <div className="rounded-lg bg-panel p-2.5">
        <div className="mb-1.5 text-[10px] font-bold tracking-wide text-lime uppercase">Plan</div>
        <div className="max-h-56 overflow-auto pr-1 text-[12px] leading-[17px] whitespace-pre-wrap text-ink/90 select-text">
          {plan.split('\n').map((line, i) => {
            const h = /^#{1,6}\s+(.*)$/.exec(line)
            return h ? (
              <div key={i} className="font-semibold text-ink">{h[1]}</div>
            ) : (
              <div key={i}>{line || '\u00a0'}</div>
            )
          })}
        </div>
        {feedbackOpen && (
          <textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) api?.decide(pending.id, { kind: 'deny', message: feedback })
            }}
            placeholder="What should Claude change? (optional)"
            className="no-drag mt-2.5 h-16 w-full resize-none rounded-md bg-card px-2 py-1.5 text-[12px] text-ink outline-none ring-1 ring-line placeholder:text-faint focus:ring-lime/60 select-text"
          />
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {!feedbackOpen ? (
            <>
              <Btn primary onClick={() => api?.decide(pending.id, { kind: 'allow' })}>Approve</Btn>
              <Btn onClick={() => setFeedbackOpen(true)}>Revise</Btn>
              <Btn onClick={() => api?.decide(pending.id, { kind: 'defer' })}>In Terminal</Btn>
            </>
          ) : (
            <>
              <Btn primary onClick={() => api?.decide(pending.id, { kind: 'deny', message: feedback })}>Send feedback</Btn>
              <Btn onClick={() => setFeedbackOpen(false)}>Cancel</Btn>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
