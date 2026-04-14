import { Relay } from '../relay'
import type { HookEvent } from '../types'

function makeEvent(id: string): HookEvent {
  return {
    session_id: 'test-session',
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    _timestamp: Date.now(),
    _id: id,
  }
}

describe('Relay', () => {
  it('stores pushed events and returns them via getRecent', () => {
    const relay = new Relay()
    relay.push(makeEvent('1'))
    relay.push(makeEvent('2'))
    expect(relay.getRecent()).toHaveLength(2)
    expect(relay.getRecent()[0]._id).toBe('1')
  })

  it('caps the buffer at 500 events, dropping the oldest', () => {
    const relay = new Relay()
    for (let i = 0; i < 501; i++) relay.push(makeEvent(String(i)))
    expect(relay.getRecent()).toHaveLength(500)
    expect(relay.getRecent()[0]._id).toBe('1') // '0' was dropped
  })

  it('broadcasts pushed event to connected clients', () => {
    const relay = new Relay()
    const received: string[] = []
    const fakeWs = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => received.push(data),
      on: (_evt: string, _cb: () => void) => {},
    } as never
    relay.addClient(fakeWs)
    relay.push(makeEvent('abc'))
    expect(received).toHaveLength(1)
    const msg = JSON.parse(received[0])
    expect(msg.type).toBe('event')
    expect(msg.event._id).toBe('abc')
  })

  it('does not broadcast to closed clients', () => {
    const relay = new Relay()
    const received: string[] = []
    const closedWs = {
      readyState: 3, // WebSocket.CLOSED
      send: (data: string) => received.push(data),
      on: (_evt: string, _cb: () => void) => {},
    } as never
    relay.addClient(closedWs)
    relay.push(makeEvent('xyz'))
    expect(received).toHaveLength(0)
  })
})
