import { motion } from 'motion/react'
import { Check, ChevronLeft, LoaderCircle, SquareTerminal } from 'lucide-react'
import type { Session } from '@shared/types'
import { Avatar } from './Avatar'
import { PermissionPanel } from './PermissionPanel'
import { QuestionPanel } from './QuestionPanel'
import { Progress, moodOf, statusLine } from './SessionCard'
import { EditableTitle } from './EditableTitle'

export function SessionDetail({ s, onBack }: { s: Session; onBack(): void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.18 }}
      className="space-y-2"
    >
      <div className={`rounded-xl border bg-card ${s.pending ? 'border-lime' : 'border-transparent'}`}>
        <div className="flex items-start gap-3 px-3 pt-2.5 pb-2.5">
          <button title="Back" onClick={onBack} className="no-drag -ml-1 mt-2 rounded-md p-0.5 text-muted hover:bg-line hover:text-ink">
            <ChevronLeft size={16} />
          </button>
          <Avatar id={s.id} mood={moodOf(s)} size={34} />
          <div className="min-w-0 flex-1">
            <EditableTitle s={s} className="text-[15px] leading-5" editOnClick />
            <div className={`truncate text-[12px] leading-4 ${s.pending || s.flash || s.status === 'waiting' ? 'font-medium text-lime' : 'text-muted'}`}>
              {statusLine(s)}
            </div>
            <Progress s={s} />
          </div>
        </div>
        {s.pending?.kind === 'permission' && <PermissionPanel pending={s.pending} />}
        {s.pending?.kind === 'question' && <QuestionPanel pending={s.pending} />}
      </div>

      {s.tasks.length > 0 && (
        <ul className="max-h-56 space-y-0.5 overflow-auto rounded-xl bg-card px-3 py-2">
          {s.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-[3px] text-[12.5px] leading-4">
              {t.status === 'completed' ? (
                <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-muted/70">
                  <Check size={9} strokeWidth={3.5} className="text-panel" />
                </span>
              ) : t.status === 'in_progress' ? (
                <LoaderCircle size={14} className="shrink-0 animate-spin text-lime" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-faint" />
              )}
              <span
                className={`truncate ${
                  t.status === 'completed' ? 'text-muted' : t.status === 'in_progress' ? 'font-semibold text-ink' : 'text-muted'
                }`}
              >
                {t.status === 'in_progress' && t.activeForm ? t.activeForm : t.subject}
              </span>
            </li>
          ))}
        </ul>
      )}

      {s.terminal && (
        <div className="rounded-xl bg-card px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <SquareTerminal size={12} /> Terminal
            {s.terminal.running && <LoaderCircle size={11} className="animate-spin text-lime" />}
          </div>
          <pre className="max-h-44 overflow-auto font-mono text-[11px] leading-[15px] break-all whitespace-pre-wrap select-text">
            <span className="text-lime">$ </span>
            <span className="text-ink">{s.terminal.command}</span>
            {s.terminal.output !== null && s.terminal.output !== '' && (
              <span className="text-muted">{'\n' + s.terminal.output.split('\n').slice(-12).join('\n')}</span>
            )}
          </pre>
        </div>
      )}

      {s.tasks.length === 0 && !s.terminal && (
        <div className="rounded-xl bg-card px-3 py-3 text-[12px] text-muted">Nothing to show yet. Steps appear as Claude works.</div>
      )}
    </motion.div>
  )
}
