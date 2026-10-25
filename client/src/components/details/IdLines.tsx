import type { SessionRecord } from '../../../../desktop/src/core/types'
import { copyCommand } from '../../../../desktop/src/core/commands'
import { CopyButton } from '../ui/copy-button'
import { Tooltip } from '../ui/tooltip'

// Session id and resume command as plain label/value lines.
export function IdLines({ record: r }: { record: SessionRecord }) {
  const command = copyCommand(r, window.sessionTray.platform)
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-y-1.5">
      <span className="text-[12px] text-muted">Session ID</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="truncate font-mono text-[12px] text-text-2">{r.id}</span>
        <CopyButton label="Copy session ID" onCopy={() => window.sessionTray.copyText(r.id)} />
      </span>
      <span className="text-[12px] text-muted">Resume command</span>
      <span className="flex items-center gap-2 min-w-0">
        <Tooltip content={command}>
          <code tabIndex={0} className="focus-ring min-w-0 truncate rounded font-mono text-[12px] text-text-2">{command}</code>
        </Tooltip>
        <CopyButton label="Copy resume command" onCopy={() => window.sessionTray.copy(r.id)} />
      </span>
    </div>
  )
}
