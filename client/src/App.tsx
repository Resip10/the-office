import { useReducer } from 'react'
import { dashboardReducer, initialState } from './reducer'
import { useRelay } from './hooks/useRelay'
import type { DashboardState } from './types'

// Placeholder panels — replaced in later tasks
function AgentTreePanel({ state }: { state: DashboardState }) {
  const count = state.agents.size
  return (
    <div className="flex flex-col h-full border-r border-border p-3 overflow-y-auto">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Agents ({count})</div>
      {count === 0 ? (
        <div className="text-text-muted text-xs mt-4">No agents yet. Start a Claude Code session or use ?mock=true</div>
      ) : (
        Array.from(state.agents.values()).map(a => (
          <div key={a.sessionId} className="text-xs py-1 text-text-primary">
            {a.agentName} — {a.status}
          </div>
        ))
      )}
    </div>
  )
}

function DetailPanel({ state }: { state: DashboardState }) {
  const agent = state.selectedAgentId ? state.agents.get(state.selectedAgentId) : null
  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto">
      {agent ? (
        <div className="text-xs text-text-primary">{agent.agentName} — {agent.status}</div>
      ) : (
        <div className="text-text-muted text-xs mt-4">Select an agent</div>
      )}
    </div>
  )
}

function EventStreamPanel({ state }: { state: DashboardState }) {
  return (
    <div className="h-32 border-t border-border p-2 overflow-y-auto">
      {state.events.slice(-20).reverse().map(ev => (
        <div key={ev._id} className="text-xs text-text-muted font-mono py-0.5">
          {new Date(ev._timestamp).toLocaleTimeString()} {ev.session_id.slice(0, 8)} {ev.hook_event_name} {ev.tool_name ?? ''}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  useRelay(dispatch)

  return (
    <div className="flex flex-col h-full bg-canvas text-text-primary font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="font-semibold tracking-wide">the-office</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {state.connected ? (
              <span className="text-status-idle">● connected</span>
            ) : (
              <span className="text-status-error">● disconnected</span>
            )}
          </span>
          <button
            onClick={() => dispatch({ type: 'CLEAR' })}
            className="text-xs text-text-muted hover:text-text-primary border border-border px-2 py-0.5 rounded"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 overflow-y-auto">
          <AgentTreePanel state={state} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <DetailPanel state={state} />
        </div>
      </div>

      {/* Event stream */}
      <EventStreamPanel state={state} />
    </div>
  )
}
