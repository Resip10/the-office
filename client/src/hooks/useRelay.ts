import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { Action, EnrichmentData, AgentSnapshot } from '../types'

const WS_URL = 'ws://localhost:7777/ws'
const RECONNECT_DELAY = 3000
const POST_TOOL_DEBOUNCE_MS = 300

export function useRelay(dispatch: Dispatch<Action>, reconnectKey = 0): void {
  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock')

    if (isMock) {
      let cleanup: (() => void) | undefined
      import('../mock/generator').then(({ startMockGenerator }) => {
        cleanup = startMockGenerator(dispatch)
      })
      return () => cleanup?.()
    }

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

    function connect() {
      if (destroyed) return
      ws = new WebSocket(WS_URL)

      ws.onopen = () => dispatch({ type: 'CONNECTED', connected: true })

      ws.onclose = () => {
        dispatch({ type: 'CONNECTED', connected: false })
        if (!destroyed) reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => ws?.close()

      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data as string) as {
            type: string
            agents?: AgentSnapshot[]
            recentEvents?: unknown[]
            hooksInstalled?: boolean
            event?: { hook_event_name: string; session_id: string; agent_id?: string }
            payload?: AgentSnapshot
            sessionId?: string
            data?: EnrichmentData
          }

          if (payload.type === 'init') {
            dispatch({
              type: 'INIT',
              agents: payload.agents as never,
              recentEvents: payload.recentEvents as never,
              hooksInstalled: payload.hooksInstalled ?? false,
            })

          } else if (payload.type === 'event' && payload.event) {
            const event = payload.event
            const agentId = event.agent_id ?? event.session_id

            if (event.hook_event_name === 'PostToolUse' || event.hook_event_name === 'PostToolUseFailure') {
              if (debounceTimers.has(agentId)) clearTimeout(debounceTimers.get(agentId))
              const timer = setTimeout(() => {
                dispatch({ type: 'EVENT', event: payload.event as never })
                debounceTimers.delete(agentId)
              }, POST_TOOL_DEBOUNCE_MS)
              debounceTimers.set(agentId, timer)

            } else {
              if (event.hook_event_name === 'PreToolUse') {
                const pending = debounceTimers.get(agentId)
                if (pending) { clearTimeout(pending); debounceTimers.delete(agentId) }
              }
              dispatch({ type: 'EVENT', event: payload.event as never })
            }

          } else if (payload.type === 'session_discovered' && payload.payload) {
            dispatch({ type: 'SESSION_DISCOVERED', agent: payload.payload })

          } else if (payload.type === 'enrich' && payload.sessionId && payload.data) {
            dispatch({ type: 'ENRICH', sessionId: payload.sessionId, data: payload.data })
          }
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      debounceTimers.forEach(t => clearTimeout(t))
      ws?.close()
    }
  }, [dispatch, reconnectKey])
}
