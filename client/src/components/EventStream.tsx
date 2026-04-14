import { useEffect, useRef, useState } from 'react'
import type { HookEvent } from '../types'
import { EventRow } from './EventRow'

interface Props {
  events: HookEvent[]
}

export function EventStream({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, paused])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    setPaused(!atBottom)
  }

  const visible = events.slice(-200)

  return (
    <div className="border-t border-border shrink-0 flex flex-col" style={{ height: '8rem' }}>
      <div className="flex items-center justify-between px-2 py-0.5 border-b border-border bg-surface">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Event Stream</span>
        {paused && (
          <button
            onClick={() => {
              setPaused(false)
              bottomRef.current?.scrollIntoView()
            }}
            className="text-[10px] text-status-working hover:text-text-primary"
          >
            ↓ resume
          </button>
        )}
        <span className="text-[10px] text-text-muted">{events.length} events</span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1"
      >
        {visible.map(ev => <EventRow key={ev._id} event={ev} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
