import { readFile, rename, writeFile } from 'fs/promises'

export interface AppState {
  pins: string[]
}

export async function loadAppState(path: string): Promise<AppState> {
  try {
    const obj = JSON.parse(await readFile(path, 'utf8')) as { pins?: unknown }
    const pins = Array.isArray(obj?.pins) ? obj.pins.filter((p): p is string => typeof p === 'string') : []
    return { pins }
  } catch {
    return { pins: [] }
  }
}

export async function togglePin(path: string, id: string): Promise<AppState> {
  const { pins } = await loadAppState(path)
  const state: AppState = { pins: pins.includes(id) ? pins.filter(p => p !== id) : [...pins, id] }
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2))
  await rename(tmp, path)
  return state
}
