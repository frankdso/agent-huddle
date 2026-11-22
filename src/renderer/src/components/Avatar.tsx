const PALETTE = ['#5b7cfa', '#f06aa8', '#f5a142', '#9d6cf6', '#2ec4b6', '#ef5f5f']

export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** A small original robot: rounded head, antenna, two pill eyes. Eyes blink while it's working. */
export function Avatar({ id, size = 30, mood }: { id: string; size?: number; mood: 'working' | 'alert' | 'idle' }) {
  const c = colorFor(id)
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 30 36" aria-hidden className="shrink-0">
      <line x1="15" y1="3" x2="15" y2="8" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx="15" cy="3" r="2.2" fill={mood === 'alert' ? '#d4f53c' : c} />
      <rect x="3" y="8" width="24" height="22" rx="6" fill={c} />
      <rect x="6.5" y="11.5" width="17" height="11" rx="3.5" fill="rgba(0,0,0,0.28)" />
      <rect x="10" y="14" width="3" height="6" rx="1.5" fill="#fff">
        {mood === 'working' && (
          <animate attributeName="height" values="6;6;1;6" keyTimes="0;0.9;0.95;1" dur="3.2s" repeatCount="indefinite" />
        )}
      </rect>
      <rect x="17" y="14" width="3" height="6" rx="1.5" fill="#fff">
        {mood === 'working' && (
          <animate attributeName="height" values="6;6;1;6" keyTimes="0;0.9;0.95;1" dur="3.2s" repeatCount="indefinite" />
        )}
      </rect>
      <rect x="8" y="30" width="4" height="4" rx="1.5" fill={c} />
      <rect x="18" y="30" width="4" height="4" rx="1.5" fill={c} />
    </svg>
  )
}
