import { useReducer, useState } from 'react'
import { dashboardReducer, initialState } from './reducer'
import { useRelay } from './hooks/useRelay'
import { AgentTree } from './components/AgentTree'
import { AgentDetail } from './components/AgentDetail'
import { EventStream } from './components/EventStream'
import { ConnectionBadge } from './components/ConnectionBadge'

export default function App() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  // Incrementing reconnectKey forces useRelay to close and reopen the WebSocket,
  // triggering a fresh bootstrap from the server (used by the Refresh button).
  const [reconnectKey, setReconnectKey] = useState(0)
  useRelay(dispatch, reconnectKey)

  function handleRefresh() {
    dispatch({ type: 'CLEAR' })
    setReconnectKey(k => k + 1)
  }

  return (
    <div className="flex flex-col h-full bg-canvas text-text-primary font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="font-semibold tracking-wide">the-office</span>
        <div className="flex items-center gap-3">
          <ConnectionBadge connected={state.connected} />
          <button
            onClick={handleRefresh}
            className="text-xs text-text-muted hover:text-text-primary border border-border px-2 py-0.5 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 overflow-y-auto">
          <AgentTree
            agents={state.agents}
            selectedId={state.selectedAgentId}
            onSelect={(id) => dispatch({ type: 'SELECT_AGENT', sessionId: id })}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AgentDetail agent={state.selectedAgentId ? (state.agents.get(state.selectedAgentId) ?? null) : null} />
        </div>
      </div>

      {/* Event stream */}
      <EventStream events={state.events} />
    </div>
  )
}
