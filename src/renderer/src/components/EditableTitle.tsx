import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { Session } from '@shared/types'
import { folderOf, titleOf } from './SessionCard'

/** Session name with an inline rename: pencil on hover (or click the name with editOnClick). Enter saves, Esc cancels, empty resets to the folder name. */
export function EditableTitle({ s, className, editOnClick }: { s: Session; className: string; editOnClick?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const start = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(titleOf(s))
    setEditing(true)
  }
  const commit = () => {
    if (!editing) return
    setEditing(false)
    const next = draft.trim()
    if (next === titleOf(s)) return
    window.huddle?.rename(s.id, next === folderOf(s) ? '' : next)
  }

  if (editing)
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={60}
        placeholder={folderOf(s)}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={commit}
        className={`no-drag -mx-1 w-[calc(100%+0.5rem)] rounded-md bg-panel px-1 font-semibold text-ink outline-none ring-1 ring-lime/70 select-text ${className}`}
      />
    )

  return (
    <div className="group/title flex min-w-0 items-center gap-1">
      <span
        className={`truncate font-semibold ${className} ${editOnClick ? 'cursor-text' : ''}`}
        onClick={editOnClick ? start : undefined}
        title={editOnClick ? 'Click to rename' : s.title ? `First prompt: ${s.title}` : undefined}
      >
        {titleOf(s)}
      </span>
      <button
        title="Rename"
        onClick={start}
        className="no-drag shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity group-hover/title:opacity-100 hover:text-ink focus:opacity-100"
      >
        <Pencil size={11} />
      </button>
    </div>
  )
}
