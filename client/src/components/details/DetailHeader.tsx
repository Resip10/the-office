import { useState } from 'react'
import type { SessionRecord } from '../../../../desktop/src/core/types'
import { UNTITLED, isUntitled, relativeTime, stateOf } from '../../lib/list'
import { StateDot } from '../StateDot'
import { CopyButton } from '../ui/copy-button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { BranchIcon, FolderIcon, MoreIcon, PencilIcon } from '../ui/icons'
import { Tooltip } from '../ui/tooltip'

const button =
  'focus-ring inline-flex items-center justify-center gap-1.5 h-[30px] px-3 rounded-[7px] border border-line-strong bg-control text-[12.5px] font-medium text-text-2 hover:text-text hover:border-muted disabled:opacity-40 disabled:cursor-not-allowed'
const primary =
  'focus-ring inline-flex items-center h-[30px] px-3 rounded-[7px] bg-accent text-on-accent text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed'

const STATE_TEXT: Record<string, string> = { running: 'text-run', idle: 'text-idle', waiting: 'text-wait' }

const dateTime = (ts: number) =>
  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

interface Props {
  record: SessionRecord
  pinned: boolean
  continuedListed: boolean
  onSelect: (id: string) => void
  continueDisabled: boolean
  onContinue: () => void
}

export function DetailHeader({ record: r, pinned, continuedListed, onSelect, continueDisabled, onContinue }: Props) {
  const [editing, setEditing] = useState(false)
  const state = stateOf(r)
  const untitled = isUntitled(r)
  const path = r.projectPath
  const stateWord = state.charAt(0).toUpperCase() + state.slice(1) + (r.live?.waitingFor ? ` · ${r.live.waitingFor}` : '')
  const lastActive = `last active ${relativeTime(r.lastActivityAt, Date.now())}`
  const when = r.createdAt !== null ? `Started ${dateTime(r.createdAt)}, ${lastActive}` : lastActive.charAt(0).toUpperCase() + lastActive.slice(1)

  const resume = (
    <button className={primary} disabled={!r.projectExists} onClick={() => window.sessionTray.resume(r.id)}>
      {state === 'running' ? 'Open another' : 'Resume'}
    </button>
  )

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        {editing ? (
          <input
            autoFocus
            aria-label="Session name"
            defaultValue={r.title}
            onKeyDown={e => {
              if (e.key === 'Enter') { window.sessionTray.rename(r.id, e.currentTarget.value); setEditing(false) }
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={() => setEditing(false)}
            className="min-w-0 flex-1 bg-sunken border border-line-strong rounded-md px-2 py-0.5 text-[22px] font-semibold tracking-tight text-text outline-none"
          />
        ) : (
          <>
            <h1
              className={`m-0 min-w-0 truncate text-[22px] font-semibold tracking-tight ${untitled ? 'text-muted' : ''}`}
              title={untitled ? UNTITLED : r.title}
            >
              {untitled ? UNTITLED : r.title}
            </h1>
            <Tooltip content="Rename">
              <button
                aria-label="Rename"
                onClick={() => setEditing(true)}
                className="focus-ring flex shrink-0 items-center justify-center w-6 h-6 rounded-md text-muted hover:text-text hover:bg-hover"
              >
                <PencilIcon width={13} height={13} />
              </button>
            </Tooltip>
          </>
        )}
        {r.live && (
          <span className={`flex shrink-0 items-center gap-1.5 text-[12.5px] ${STATE_TEXT[state] ?? 'text-other'}`}>
            <StateDot state={state} />
            {stateWord}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {r.projectExists ? resume : (
            <Tooltip content="Project folder no longer exists">
              <span tabIndex={0} className="focus-ring rounded-[7px]">{resume}</span>
            </Tooltip>
          )}
          <button className={button} disabled={continueDisabled} onClick={onContinue}>Continue in…</button>
          <DropdownMenu>
            <Tooltip content="More actions">
              <DropdownMenuTrigger asChild>
                <button aria-label="More actions" className={`${button} w-[30px] px-0`}>
                  <MoreIcon />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => window.sessionTray.togglePin(r.id)}>{pinned ? 'Unpin' : 'Pin'}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.sessionTray.reveal(r.id)}>Reveal file</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.sessionTray.reveal(r.id)}>Open transcript</DropdownMenuItem>
              <Tooltip content={r.live ? 'Running sessions cannot be archived' : 'Hide from lists. Restore it from Cleanup → Archive.'}>
                <DropdownMenuItem disabled={r.live !== null} onSelect={() => window.sessionTray.archive([r.id])}>Archive</DropdownMenuItem>
              </Tooltip>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 min-w-0 text-[12.5px] text-muted">
        {path && (
          <span className="flex items-center gap-1.5 min-w-0">
            <FolderIcon width={13} height={13} className="shrink-0 text-faint" />
            <span className="truncate font-mono text-[12px]">{path}</span>
            {!r.projectExists && <span>(missing)</span>}
            <CopyButton label="Copy project path" onCopy={() => window.sessionTray.copyText(path)} />
          </span>
        )}
        {r.gitBranch && (
          <span className="flex items-center gap-1.5 min-w-0">
            <BranchIcon width={13} height={13} className="shrink-0 text-faint" />
            <span className="truncate font-mono text-[12px]">{r.gitBranch}</span>
          </span>
        )}
        <span>{when}</span>
        {continuedListed && r.continuedInId && (
          <button className="focus-ring rounded text-accent-text hover:underline" onClick={() => onSelect(r.continuedInId as string)}>
            Continued in<span aria-hidden="true"> →</span>
          </button>
        )}
      </div>
    </div>
  )
}
