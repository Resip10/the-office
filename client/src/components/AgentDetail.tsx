import type { AgentState } from '../types'
import { ToolHistory } from './ToolHistory'
import { useTranscriptSnapshot } from '../hooks/useTranscriptSnapshot'

function formatDuration(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}

interface Props {
  agent: AgentState | null
}

export function AgentDetail({ agent }: Props) {
  const isActive = !!agent && agent.status !== 'done'
  const snapshot = useTranscriptSnapshot(agent?.transcriptPath, isActive)

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Select an agent to see details
      </div>
    )
  }

  return (
    <div className="p-4 text-xs space-y-4">
      {/* Header */}
      <div>
        <div className="text-text-primary text-sm font-semibold">{agent.agentName}</div>
        <div className="text-text-muted mt-0.5">{agent.projectPath || '—'}</div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Status</div>
          <div className="text-text-primary">{agent.status}</div>
        </div>
        {agent.currentTool && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Tool</div>
            <div className="text-status-working">{agent.currentTool}</div>
          </div>
        )}
        {agent.agentType && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Type</div>
            <div className="text-text-primary">{agent.agentType}</div>
          </div>
        )}
        {agent.parentSessionId && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Parent</div>
            <div className="text-text-primary font-mono">{agent.parentSessionId.slice(0, 12)}</div>
          </div>
        )}
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Duration</div>
          <div className="text-text-primary">{formatDuration(agent.startedAt)}</div>
        </div>
      </div>

      {/* Conversation snapshot */}
      {snapshot && (snapshot.firstPrompt || snapshot.latestAssistant) && (
        <div className="space-y-2">
          <div className="text-text-muted uppercase tracking-wider text-[10px]">
            Conversation
            {snapshot.messageCount > 0 && (
              <span className="ml-2 normal-case">{snapshot.messageCount} messages</span>
            )}
          </div>
          {snapshot.firstPrompt && (
            <div className="bg-surface rounded p-2 border border-border">
              <div className="text-[10px] text-text-muted mb-0.5">Task</div>
              <div className="text-text-primary leading-relaxed">
                {truncate(snapshot.firstPrompt, 160)}
              </div>
            </div>
          )}
          {snapshot.latestUser && snapshot.latestUser !== snapshot.firstPrompt && (
            <div className="bg-surface rounded p-2 border border-border">
              <div className="text-[10px] text-text-muted mb-0.5">Latest ask</div>
              <div className="text-text-primary leading-relaxed">
                {truncate(snapshot.latestUser, 160)}
              </div>
            </div>
          )}
          {snapshot.latestAssistant && (
            <div className="bg-canvas rounded p-2 border border-border/40">
              <div className="text-[10px] text-text-muted mb-0.5">Latest response</div>
              <div className="text-text-primary leading-relaxed">
                {truncate(snapshot.latestAssistant, 220)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current tool input */}
      {typeof agent.currentToolInput === 'object' && agent.currentToolInput !== null ? (
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Tool Input</div>
          <pre className="text-text-muted bg-surface rounded p-2 overflow-x-auto text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(agent.currentToolInput, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Tool history */}
      <div>
        <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">
          Tool History ({agent.toolHistory.length})
        </div>
        <ToolHistory toolHistory={agent.toolHistory} />
      </div>
    </div>
  )
}
