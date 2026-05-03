export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-7':              200_000,
  'claude-sonnet-4-6':            200_000,
  'claude-haiku-4-5':             200_000,
  'claude-haiku-4-5-20251001':    200_000,
  'claude-3-5-sonnet-20241022':   200_000,
  'claude-3-5-haiku-20241022':    200_000,
  'claude-3-opus-20240229':       200_000,
}

export function getContextWindow(model: string): number | null {
  return MODEL_CONTEXT_WINDOWS[model] ?? null
}
