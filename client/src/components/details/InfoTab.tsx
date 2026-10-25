import type { ReactNode } from 'react'
import type { SessionRecord } from '../../../../desktop/src/core/types'
import { useAppState } from '../../hooks/useAppState'
import { formatBytes } from '../../lib/format'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="m-0 min-w-0 truncate font-mono text-[12px] text-text-2">{children ?? '—'}</dd>
    </>
  )
}

export function InfoTab({ record: r }: { record: SessionRecord }) {
  // Only the status line knows these; shown when it has refreshed for this session while connected.
  const extras = useAppState().sessionExtras[r.id]
  const extrasText = extras && [
    extras.text,
    extras.effort && `effort ${extras.effort}`,
    extras.thinking !== null && `thinking ${extras.thinking ? 'on' : 'off'}`,
  ].filter(Boolean).join(' · ')

  return (
    <dl className="m-0 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-y-1.5">
      <Row label="Surface">{r.entrypoint}</Row>
      <Row label="Claude Code">{r.version}</Row>
      <Row label="File size">{formatBytes(r.fileSize)}</Row>
      <Row label="Title from">{r.titleSource}</Row>
      <Row label="Session ID">{r.id}</Row>
      {r.live && <Row label="pid">{r.live.pid}</Row>}
      {r.live?.name && <Row label="Live name">{r.live.name}</Row>}
      {extrasText && (
        <Row label="Status line">
          <span aria-label="From your Claude Code status line" title={`From your Claude Code status line: ${extrasText}`} className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="shrink-0 px-1 rounded border border-line-strong text-[10px] text-faint">&gt;_</span>
            <span className="truncate">{extrasText}</span>
          </span>
        </Row>
      )}
    </dl>
  )
}
