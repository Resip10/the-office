import { prLabel } from '../../lib/format'
import { CopyButton } from '../ui/copy-button'
import { Tooltip } from '../ui/tooltip'

export function PrsTab({ urls }: { urls: string[] }) {
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-1 pl-1">
      {urls.map(url => (
        <li key={url} className="flex items-center gap-2 min-w-0">
          <Tooltip content={url}>
            <button
              type="button"
              onClick={() => window.sessionTray.openUrl(url)}
              className="focus-ring min-w-0 truncate rounded text-left font-mono text-[12.5px] text-accent-text hover:underline"
            >
              {prLabel(url)}
            </button>
          </Tooltip>
          <CopyButton label="Copy link" onCopy={() => window.sessionTray.copyText(url)} />
        </li>
      ))}
    </ul>
  )
}
