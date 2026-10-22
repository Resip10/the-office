import { useState } from 'react'
import type { SessionDetails, SessionRecord } from '../../../desktop/src/core/types'
import { continuePreview, handoffPrompt } from '../../../desktop/src/core/handoff-prompt'

type Target = 'claude' | 'clipboard'

interface Props {
  record: SessionRecord
  details: SessionDetails | null
  onClose: () => void
}

const NO_DETAILS: SessionDetails = {
  handoff: { source: 'extract', summary: null, goal: null, lastAsk: null, files: [], branch: null, lastAnswer: null },
  peek: [],
  conversation: [],
  messageTotal: 0,
}

const TARGETS: Array<[Target, string, string]> = [
  ['claude', 'Claude Code', 'new terminal session'],
  ['clipboard', 'Clipboard only', 'paste anywhere'],
]

const button = 'inline-flex items-center h-8 px-3.5 rounded-[7px] border border-line-strong bg-control text-[12.5px] font-medium text-text-2 hover:text-text'
const primary = 'inline-flex items-center h-8 px-3.5 rounded-[7px] bg-accent text-on-accent text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed'

export function ContinueSheet({ record: r, details, onClose }: Props) {
  const [target, setTarget] = useState<Target>('claude')
  const [folder, setFolder] = useState<string | null>(r.projectExists ? r.projectPath : null)
  const [prompt, setPrompt] = useState(() => handoffPrompt(r, details ?? NO_DETAILS))
  const canLaunch = target === 'clipboard' || folder !== null

  async function pick() {
    const chosen = await window.sessionTray.pickFolder()
    if (chosen) setFolder(chosen)
  }

  function go() {
    window.sessionTray.continueIn(r.id, { folder: folder ?? '', prompt, target })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50" onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="continue-title"
        className="flex flex-col w-[760px] max-w-full max-h-full rounded-[14px] border border-line bg-raised shadow-2xl overflow-hidden"
      >
        <div className="flex flex-col gap-1 px-6 pt-5 pb-4 border-b border-line">
          <h2 id="continue-title" className="m-0 text-[17px] font-semibold">Continue in a new session</h2>
          <p className="m-0 text-[13px] text-muted">Starts fresh in the same folder with the handoff below as the first message. The old session stays as it is.</p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-[18px]">
          <div role="radiogroup" aria-label="Where to continue" className="grid grid-cols-2 gap-2.5">
            {TARGETS.map(([id, name, hint]) => (
              <button
                key={id}
                role="radio"
                aria-checked={target === id}
                onClick={() => setTarget(id)}
                className={`flex flex-col gap-1 px-3.5 py-3 rounded-[9px] border text-left ${target === id ? 'border-accent ring-1 ring-inset ring-accent bg-selected' : 'border-line bg-surface'}`}
              >
                <span className="text-[13px] font-medium text-text">{name}</span>
                <span className="font-mono text-[11px] text-muted">{hint}</span>
              </button>
            ))}
          </div>

          {target === 'claude' && (
            <div className="flex items-center gap-2.5">
              <span className="w-14 font-mono text-[10.5px] uppercase tracking-[.08em] text-muted">Folder</span>
              <span className={`flex-1 min-w-0 truncate font-mono text-xs px-2.5 py-[7px] rounded-[7px] border border-line bg-sunken ${folder ? 'text-text' : 'text-run'}`}>
                {folder ?? 'Project folder is gone. Pick a folder.'}
              </span>
              <button className={button} onClick={pick}>Change</button>
            </div>
          )}

          <div className="flex-1 min-h-[220px] flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <label htmlFor="continue-prompt" className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted">First message</label>
              <span className="ml-auto font-mono text-[11px] text-muted">~{Math.round(prompt.length / 4)} tokens</span>
            </div>
            <textarea
              id="continue-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="flex-1 min-h-[220px] resize-none px-3.5 py-3 rounded-[9px] border border-line bg-sunken font-mono text-xs leading-relaxed text-text-2 outline-none focus:border-line-strong"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-6 py-3.5 border-t border-line bg-surface">
          <code className="flex-1 min-w-0 truncate font-mono text-[11px] text-muted">
            {target === 'claude' && folder ? continuePreview(folder, prompt) : ''}
          </code>
          <button className={button} onClick={onClose}>Cancel</button>
          <button className={primary} disabled={!canLaunch} onClick={go}>
            {target === 'claude' ? 'Open in terminal' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
