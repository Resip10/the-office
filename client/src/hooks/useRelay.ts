import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../types'

const WS_URL = 'ws://localhost:7777/ws'
const RECONNECT_DELAY = 3000

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

    // Live WebSocket mode
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      ws = new WebSocket(WS_URL)

      ws.onopen = () => dispatch({ type: 'CONNECTED', connected: true })

      ws.onclose = () => {
        dispatch({ type: 'CONNECTED', connected: false })
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
        }
      }

      ws.onerror = () => ws?.close()

      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data as string) as { type: string; agents?: unknown; recentEvents?: unknown; event?: unknown }
          if (payload.type === 'init') {
            dispatch({ type: 'INIT', agents: payload.agents as never, recentEvents: payload.recentEvents as never })
          } else if (payload.type === 'event') {
            dispatch({ type: 'EVENT', event: payload.event as never })
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
      ws?.close()
    }
  }, [dispatch, reconnectKey])
}
