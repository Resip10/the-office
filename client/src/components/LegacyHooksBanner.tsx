export function LegacyHooksBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface text-xs text-text-muted">
      <span className="flex-1">Old The Office hooks found in Claude settings. They're no longer needed.</span>
      <button
        className="px-2 py-0.5 rounded border border-border text-text-primary hover:border-text-muted"
        onClick={() => window.sessionTray.removeLegacyHooks()}
      >
        Remove
      </button>
    </div>
  )
}
