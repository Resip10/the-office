import type { McpServerInfo, PluggedIn } from '../../../../desktop/src/core/types'
import { relativeTime } from '../../lib/list'

const STATUS: Record<NonNullable<McpServerInfo['status']>, { label: string; color: string }> = {
  connected: { label: 'connected', color: 'text-idle' },
  'needs-auth': { label: 'needs auth', color: 'text-wait' },
  failed: { label: 'failed', color: 'text-wait' },
  pending: { label: 'pending', color: 'text-run' },
  'not-loaded': { label: 'not loaded', color: 'text-faint' },
}

const chip = 'shrink-0 px-1.5 rounded-full border border-line-strong text-[10px] text-text-2'

function scopeLabel(s: McpServerInfo): string {
  return s.scope === 'plugin' && s.source ? `plugin · ${s.source}` : s.scope
}

// MCP servers and plugins the session's project has access to; DetailPanel reads them when the details open.
export function PluggedInTab({ data }: { data: PluggedIn }) {
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="m-0 p-0 list-none font-mono text-[11.5px]">
        {data.servers.map(s => {
          const st = s.status ? STATUS[s.status] : null
          return (
            <li key={`${s.scope}:${s.source}:${s.name}`} className="flex items-center gap-2 py-0.5">
              <span className={st?.color ?? 'text-faint'} aria-hidden="true">●</span>
              <span className="flex-1 min-w-0 truncate text-text">
                {s.name}{s.command && <span className="text-faint"> · {s.command}</span>}
              </span>
              <span className={chip}>{scopeLabel(s)}</span>
              {st && <span className={`shrink-0 w-[76px] text-right ${st.color === 'text-idle' ? 'text-muted' : st.color}`}>{st.label}</span>}
            </li>
          )
        })}
        {data.plugins.map(p => (
          <li key={p.id} className="flex items-center gap-2 py-0.5">
            <span className="text-faint" aria-hidden="true">◆</span>
            <span className={`flex-1 min-w-0 truncate ${p.enabled ? 'text-text' : 'text-muted'}`} title={p.id}>
              {p.name}{p.version && <span className="text-faint"> {p.version}</span>}
            </span>
            <span className={chip}>{p.scope}</span>
            <span className="shrink-0 w-[76px] text-right text-muted">{p.enabled ? 'plugin' : 'plugin · off'}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 px-2 py-1.5 rounded-md bg-sunken font-mono text-[11px] text-muted">
        {data.loadedAt !== null
          ? `Not live: status as loaded when this session started (${relativeTime(data.loadedAt, Date.now())}). `
          : 'No status: this session has no record of the tools it loaded. '}
        List as configured now.
      </p>
    </div>
  )
}
