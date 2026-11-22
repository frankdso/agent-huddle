import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, Volume2, VolumeX, X } from 'lucide-react'
import type { HuddleState, Session } from '@shared/types'
import { SessionCard, needsYou } from './components/SessionCard'
import { SessionDetail } from './components/SessionDetail'
import { chime, loadSoundOn, saveSoundOn } from './sound'
import { installMock } from './mock'

if (!window.huddle) installMock()

export function App() {
  const [state, setState] = useState<HuddleState>({ sessions: [], notice: null })
  const [openId, setOpenId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [soundOn, setSoundOn] = useState(loadSoundOn)
  const rootRef = useRef<HTMLDivElement>(null)
  const prevNeeds = useRef(new Map<string, string>())
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  useEffect(
    () =>
      window.huddle!.onState((next) => {
        let ring = false
        const seen = new Map<string, string>()
        for (const s of next.sessions) {
          const key = needsYou(s) ? s.status : ''
          seen.set(s.id, key)
          if (key && prevNeeds.current.get(s.id) !== key) ring = true
        }
        prevNeeds.current = seen
        if (ring && soundRef.current) chime()
        setState(next)
      }),
    []
  )

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => window.huddle?.setHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sessions = state.sessions
  const open: Session | undefined = sessions.find((s) => s.id === openId)
  useEffect(() => {
    if (openId && !open) setOpenId(null)
  }, [openId, open])

  const working = sessions.some((s) => s.status === 'working')
  const waitingOnYou = sessions.filter((s) => s.pending).length

  return (
    <div ref={rootRef} className="p-2.5">
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-panel shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
        <header className="drag flex h-10 items-center gap-2 pr-1.5 pl-3.5">
          <span className="relative grid h-2 w-2 place-items-center">
            {working && <span className="absolute h-2 w-2 animate-ping rounded-full bg-lime/60" />}
            <span className={`h-2 w-2 rounded-full ${sessions.length ? 'bg-lime' : 'bg-faint'}`} />
          </span>
          <span className="text-[13.5px] font-semibold">Agent Huddle</span>
          <span className="text-[13px] font-medium text-faint tabular-nums">{sessions.length}</span>
          {collapsed && waitingOnYou > 0 && (
            <span className="rounded-full bg-lime px-1.5 text-[10.5px] font-bold text-black">{waitingOnYou} waiting</span>
          )}
          <div className="ml-auto flex items-center">
            <IconBtn title={soundOn ? 'Mute' : 'Unmute'} onClick={() => { setSoundOn(!soundOn); saveSoundOn(!soundOn) }}>
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </IconBtn>
            <IconBtn title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </IconBtn>
            <IconBtn title="Hide (it keeps running in the tray)" onClick={() => window.huddle?.hide()}>
              <X size={15} />
            </IconBtn>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="max-h-[640px] space-y-1.5 overflow-y-auto px-2 pb-2">
                {state.notice && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11.5px] leading-4 text-amber-200">
                    {state.notice}
                  </div>
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  {open ? (
                    <SessionDetail key={'d' + open.id} s={open} onBack={() => setOpenId(null)} />
                  ) : sessions.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 pt-1 pb-3">
                      <div className="text-[13px] font-semibold">No Claude sessions yet</div>
                      <div className="mt-0.5 text-[12px] leading-4 text-muted">
                        Start <span className="font-mono text-ink">claude</span> in any terminal and it shows up here.
                      </div>
                    </motion.div>
                  ) : (
                    sessions.map((s) => <SessionCard key={s.id} s={s} onOpen={() => setOpenId(s.id)} />)
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="no-drag grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-line hover:text-ink">
      {children}
    </button>
  )
}
