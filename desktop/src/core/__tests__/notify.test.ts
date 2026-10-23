import { notificationText, trackWaiting, type Stretch } from '../notify'

const MIN = 60_000
const T = 5 * MIN

describe('trackWaiting', () => {
  it('a session waiting longer than the threshold is due once', () => {
    const first = trackWaiting(new Map(), [{ id: 'a', since: 0 }], 10 * MIN, T)
    expect(first.due).toEqual(['a'])
    expect(trackWaiting(first.next, [{ id: 'a', since: 0 }], 11 * MIN, T).due).toEqual([])
  })

  it('becomes due when the threshold passes', () => {
    const early = trackWaiting(new Map(), [{ id: 'a', since: 0 }], 1 * MIN, T)
    expect(early.due).toEqual([])
    expect(trackWaiting(early.next, [{ id: 'a', since: 0 }], 5 * MIN, T).due).toEqual(['a'])
  })

  it('leaving waiting starts a new stretch', () => {
    let s = trackWaiting(new Map(), [{ id: 'a', since: 0 }], 10 * MIN, T).next
    s = trackWaiting(s, [], 11 * MIN, T).next
    expect(s.size).toBe(0)
    const back = trackWaiting(s, [{ id: 'a', since: 12 * MIN }], 13 * MIN, T)
    expect(back.due).toEqual([])
    expect(trackWaiting(back.next, [{ id: 'a', since: 12 * MIN }], 17 * MIN, T).due).toEqual(['a'])
  })

  it('a rewritten status time does not restart a stretch that is still going', () => {
    const s = trackWaiting(new Map(), [{ id: 'a', since: 0 }], 1 * MIN, T).next
    const later = trackWaiting(s, [{ id: 'a', since: 4 * MIN }], 5 * MIN, T)
    expect(later.due).toEqual(['a'])
    expect((later.next.get('a') as Stretch).start).toBe(0)
  })

  it('several sessions can be due at once', () => {
    const r = trackWaiting(new Map(), [{ id: 'a', since: 0 }, { id: 'b', since: 0 }, { id: 'c', since: 9 * MIN }], 10 * MIN, T)
    expect(r.due).toEqual(['a', 'b'])
  })
})

describe('notificationText', () => {
  it('one session: its title and the reason', () => {
    expect(notificationText([{ title: 'Fix login', waitingFor: 'input needed' }]))
      .toEqual({ title: 'Fix login needs input', body: 'Waiting: input needed' })
    expect(notificationText([{ title: 'Fix login', waitingFor: null }]))
      .toEqual({ title: 'Fix login needs input', body: 'Waiting for you in Claude Code' })
  })

  it('several sessions are grouped', () => {
    expect(notificationText([{ title: 'A', waitingFor: null }, { title: 'B', waitingFor: 'dialog open' }]))
      .toEqual({ title: '2 sessions need input', body: 'A · B' })
  })
})
