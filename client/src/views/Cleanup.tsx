import { useState } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../../../desktop/src/core/types'
import { reasonLabel, type StaleReason } from '../../../desktop/src/core/stale'
import { useListState } from '../hooks/useListState'
import { formatBytes } from '../lib/format'
import { projectName, relativeTime } from '../lib/list'

type Tab = 'stale' | 'archive'
type Rules = Settings['stale']

const label = 'font-mono text-[10.5px] uppercase tracking-[.08em] text-muted'
const button = 'inline-flex items-center h-[30px] px-3 rounded-[7px] border border-line-strong bg-control text-[12.5px] font-medium text-text-2 hover:text-text disabled:opacity-40'
const primary = 'inline-flex items-center h-[30px] px-3 rounded-[7px] bg-accent text-on-accent text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function ruleCards(rules: Rules): Array<{ kind: StaleReason['kind']; text: string; on: boolean; toggle: () => Rules }> {
  const d = DEFAULT_SETTINGS.stale
  return [
    {
      kind: 'idle', on: rules.idleDays !== null, text: `No activity for ${rules.idleDays ?? d.idleDays}d`,
      toggle: () => ({ ...rules, idleDays: rules.idleDays === null ? d.idleDays : null }),
    },
    {
      kind: 'trivial', on: rules.trivialMessages !== null, text: `Fewer than ${rules.trivialMessages ?? d.trivialMessages} messages, no edits`,
      toggle: () => ({ ...rules, trivialMessages: rules.trivialMessages === null ? d.trivialMessages : null }),
    },
    {
      kind: 'folder-gone', on: rules.missingFolder, text: 'Project folder is gone',
      toggle: () => ({ ...rules, missingFolder: !rules.missingFolder }),
    },
  ]
}

export function Cleanup() {
  const s = useListState()
  const [tab, setTab] = useState<Tab>('stale')
  // Rows start checked; track the ones the user unchecked.
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const selected = s.stale.filter(item => !unchecked.has(item.record.id))
  const selectedSize = selected.reduce((sum, item) => sum + item.record.fileSize, 0)
  const archivedRecords = s.records.filter(r => s.archived.includes(r.id))

  const toggleRow = (id: string) => setUnchecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-7 pb-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Clean up</span>
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              {s.stale.length === 0 ? 'Nothing looks stale' : `${plural(s.stale.length, 'session')} look${s.stale.length === 1 ? 's' : ''} stale`}
            </h1>
          </div>
          <span className="ml-auto font-mono text-xs text-muted">Pinned and running sessions are never flagged</span>
        </div>

        <div role="tablist" aria-label="Cleanup" className="flex gap-0.5 self-start p-0.5 rounded-[7px] bg-sunken border border-line">
          {(['stale', 'archive'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-label={t === 'stale' ? 'Stale' : 'Archive'}
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-[5px] text-xs font-medium ${tab === t ? 'bg-line-strong text-text' : 'text-muted hover:text-text'}`}
            >
              {t === 'stale' ? 'Stale' : `Archive${archivedRecords.length ? ` · ${archivedRecords.length}` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'stale' && (
          <>
            <div role="group" aria-label="Rules" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
              {ruleCards(s.settings.stale).map(rule => (
                <label key={rule.kind} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] border text-[13px] ${rule.on ? 'border-line-strong bg-selected' : 'border-line bg-surface'}`}>
                  <input
                    type="checkbox"
                    checked={rule.on}
                    onChange={() => window.sessionTray.setSettings({ stale: rule.toggle() })}
                    className="accent-[var(--accent)] w-3.5 h-3.5 m-0"
                  />
                  <span className="flex-1">{rule.text}</span>
                  <span className="font-mono text-muted tabular-nums">{s.stale.filter(item => item.reasons.some(r => r.kind === rule.kind)).length}</span>
                </label>
              ))}
            </div>

            {s.stale.length > 0 && (
              <div className="overflow-x-auto rounded-[10px] border border-line bg-sunken">
                <table className="w-full border-collapse text-[13px]">
                  <thead className={label}>
                    <tr className="[&>th]:text-left [&>th]:font-normal [&>th]:px-3 [&>th]:py-2 [&>th]:border-b [&>th]:border-line">
                      <th className="w-3.5" />
                      <th>Session</th>
                      <th>Project</th>
                      <th>Why</th>
                      <th className="!text-right">Last active</th>
                      <th className="!text-right">Msgs</th>
                      <th className="!text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.stale.map(({ record: r, reasons }) => (
                      <tr key={r.id} className="hover:bg-hover [&>td]:px-3 [&>td]:py-2.5 [&>td]:border-b [&>td]:border-line [&>td]:whitespace-nowrap">
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.title}`}
                            checked={!unchecked.has(r.id)}
                            onChange={() => toggleRow(r.id)}
                            className="accent-[var(--accent)] w-3.5 h-3.5 m-0"
                          />
                        </td>
                        <td className="max-w-[360px] truncate" title={r.title}>{r.title}</td>
                        <td className="font-mono text-xs text-muted">{projectName(r.projectPath)}</td>
                        <td className="flex gap-1">
                          {reasons.map(reason => (
                            <span key={reason.kind} className="font-mono text-[10.5px] rounded border border-line-strong px-1.5 text-text-2">{reasonLabel(reason)}</span>
                          ))}
                        </td>
                        <td className="font-mono text-xs text-muted text-right">{relativeTime(r.lastActivityAt, s.now)}</td>
                        <td className="font-mono text-xs text-right tabular-nums">{r.messageCount}</td>
                        <td className="font-mono text-xs text-muted text-right">{formatBytes(r.fileSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'archive' && (
          archivedRecords.length === 0
            ? <p className="m-0 text-sm text-muted">No archived sessions. Archived sessions leave your lists; their files stay where they are.</p>
            : (
              <ul className="m-0 p-0 list-none rounded-[10px] border border-line bg-sunken">
                {archivedRecords.map(r => (
                  <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 border-t border-line first:border-t-0">
                    <span className="flex-1 min-w-0 truncate text-[13px]">{r.title}</span>
                    <span className="font-mono text-xs text-muted">{projectName(r.projectPath)} · {relativeTime(r.lastActivityAt, s.now)}</span>
                    <button className={button} onClick={() => window.sessionTray.restore([r.id])}>Restore</button>
                  </li>
                ))}
              </ul>
            )
        )}
      </div>

      {tab === 'stale' && s.stale.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-8 py-3.5 border-t border-line bg-surface">
          <span className="font-mono text-xs">{selected.length} selected · {formatBytes(selectedSize)}</span>
          <span className="text-[12.5px] text-muted">Archived sessions leave your lists. You can restore them from Archive.</span>
          <button className={`${button} ml-auto`} onClick={() => window.sessionTray.keep(s.stale.map(item => item.record.id))}>Keep all</button>
          <button className={primary} disabled={selected.length === 0} onClick={() => window.sessionTray.archive(selected.map(item => item.record.id))}>
            Archive {selected.length}
          </button>
        </div>
      )}
    </div>
  )
}
