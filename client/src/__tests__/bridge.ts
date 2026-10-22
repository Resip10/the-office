import { vi } from 'vitest'
import { DEFAULT_SETTINGS, type SessionsPayload } from '../../../desktop/src/core/types'

export function makePayload(over: Partial<SessionsPayload> = {}): SessionsPayload {
  return { records: [], pins: [], legacyHooks: false, names: {}, archived: [], keptAt: {}, settings: DEFAULT_SETTINGS, ...over }
}

// A full window.sessionTray mock; onUpdate delivers `payload` immediately when given.
export function mockApi(payload?: SessionsPayload): Window['sessionTray'] {
  return {
    platform: 'win32',
    onUpdate: vi.fn(cb => { if (payload) cb(payload); return () => {} }),
    onOpen: vi.fn(() => () => {}),
    resume: vi.fn(), copy: vi.fn(), togglePin: vi.fn(), reveal: vi.fn(), openUrl: vi.fn(), openWindow: vi.fn(),
    removeLegacyHooks: vi.fn(), setSettings: vi.fn(), openSettings: vi.fn(),
    details: vi.fn(async () => null), copyText: vi.fn(), rename: vi.fn(),
    continueIn: vi.fn(), pickFolder: vi.fn(async () => null),
  }
}
