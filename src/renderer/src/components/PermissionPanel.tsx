import { motion } from 'motion/react'
import type { PendingView } from '@shared/types'

export function Btn({
  children,
  primary,
  disabled,
  onClick
}: {
  children: React.ReactNode
  primary?: boolean
  disabled?: boolean
  onClick(): void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`no-drag h-7 rounded-full px-3 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
        primary ? 'bg-lime text-black hover:bg-[#e2ff5a]' : 'bg-line text-ink hover:bg-[#34353c]'
      }`}
    >
      {children}
    </button>
  )
}

export function PermissionPanel({ pending }: { pending: PendingView }) {
  const api = window.huddle
  const decide = (kind: 'allow' | 'deny' | 'defer') => api?.decide(pending.id, { kind })
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="overflow-hidden px-3 pb-3"
    >
      <div className="rounded-lg bg-panel p-2.5">
        <pre className="max-h-24 overflow-auto font-mono text-[11.5px] leading-4 break-all whitespace-pre-wrap text-ink/90 select-text">
          {pending.summary}
        </pre>
        <div className="mt-2.5 flex gap-1.5">
          <Btn primary onClick={() => decide('allow')}>Allow</Btn>
          <Btn onClick={() => decide('deny')}>Deny</Btn>
          <Btn onClick={() => decide('defer')}>In Terminal</Btn>
        </div>
      </div>
    </motion.div>
  )
}
