import { motion } from 'motion/react'
import { SquareArrowOutUpRight, X } from 'lucide-react'
import type { Session } from '@shared/types'
import { Avatar } from './Avatar'
import { PermissionPanel } from './PermissionPanel'
import { QuestionPanel } from './QuestionPanel'
import { EditableTitle } from './EditableTitle'

export const needsYou = (s: Session) =>
  s.status === 'needs-permission' || s.status === 'asks-question' || s.status === 'waiting'

export function moodOf(s: Session): 'working' | 'alert' | 'idle' {
  if (s.status === 'needs-permission' || s.status === 'asks-question') return 'alert'
  return s.status === 'working' ? 'working' : 'idle'
}

export function statusLine(s: Session): string {
  if (s.flash) return s.flash
  if (s.status === 'needs-permission') return 'needs permission'
  if (s.status === 'asks-question') return 'asks a question'
  return s.activity
}

export function folderOf(s: Session): string {
  return s.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || s.repo || 'Claude session'
}

/** Your name for the session if you set one, otherwise the folder it's running in. */
export function titleOf(s: Session): string {
  return s.customTitle || folderOf(s)
}

export function Progress({ s }: { s: Session }) {
  const total = s.tasks.length
  const done = s.tasks.filter((t) => t.status === 'completed').length
  const folder = folderOf(s)
  const where = [s.customTitle && s.repo ? s.repo : s.repo !== folder ? s.repo : null, s.branch].filter(Boolean).join(' · ')
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold tabular-nums">
        {total > 0 && <span className="text-lime">{done}/{total} </span>}
        <span className="font-medium text-muted">{where}</span>
      </span>
      <div className="relative h-[3px] min-w-6 flex-1 overflow-hidden rounded-full bg-line">
        {total > 0 ? (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-lime"
            initial={false}
            animate={{ width: `${(done / total) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
        ) : s.status === 'working' ? (
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-lime/60"
            animate={{ left: ['-35%', '100%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
      </div>
    </div>
  )
}

export function SessionCard({ s, onOpen }: { s: Session; onOpen(): void }) {
  const api = window.huddle
  const alert = !!s.pending
  const highlight = alert || !!s.flash
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`group rounded-xl border bg-card transition-colors ${
        alert ? 'border-lime shadow-[0_0_0_3px_rgba(212,245,60,0.08)]' : 'border-transparent hover:bg-card-hover'
      }`}
    >
      <div className="flex cursor-pointer items-start gap-3 px-3 pt-2.5 pb-2.5" onClick={onOpen}>
        <Avatar id={s.id} mood={moodOf(s)} />
        <div className="min-w-0 flex-1">
          <EditableTitle s={s} className="text-[13.5px] leading-5" />
          <div
            className={`truncate text-[12px] leading-4 ${
              highlight || s.status === 'waiting' ? 'font-medium text-lime' : 'text-muted'
            }`}
          >
            {statusLine(s)}
          </div>
          <Progress s={s} />
        </div>
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <button
            title="Jump to terminal tab"
            className="no-drag rounded-md p-1 text-muted hover:bg-line hover:text-ink"
            onClick={(e) => {
              e.stopPropagation()
              api?.jump(s.id)
            }}
          >
            <SquareArrowOutUpRight size={14} />
          </button>
          <button
            title="Dismiss"
            className="no-drag rounded-md p-1 text-faint hover:bg-line hover:text-ink"
            onClick={(e) => {
              e.stopPropagation()
              api?.dismiss(s.id)
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {s.pending?.kind === 'permission' && <PermissionPanel pending={s.pending} />}
      {s.pending?.kind === 'question' && <QuestionPanel pending={s.pending} />}
    </motion.div>
  )
}
