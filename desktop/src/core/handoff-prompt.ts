import type { SessionDetails } from './types'

const PROMPT_FILES = 20

// Plain-text brief used for Continue in… and Copy as prompt (spec §4.1).
export function handoffPrompt(session: { title: string; id: string }, d: SessionDetails): string {
  const h = d.handoff
  const hasSummary = h.source !== 'extract' && h.summary !== null
  const lines: string[] = [`Continuing from session "${session.title}" (${session.id.slice(0, 8)}).`, '']
  if (hasSummary) lines.push(h.summary as string, '')
  if (!hasSummary && h.goal) lines.push(`Goal: ${h.goal}`)
  if (h.branch) lines.push(`Branch: ${h.branch}`)
  if (h.files.length > 0) lines.push('Files touched:', ...h.files.slice(0, PROMPT_FILES).map(f => `- ${f}`))
  if (h.lastAsk) lines.push(`Last request: "${h.lastAsk}"`)
  if (!hasSummary && h.lastAnswer) lines.push(`Where it stopped: ${h.lastAnswer}`)
  lines.push('', 'Pick up from there.')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}
