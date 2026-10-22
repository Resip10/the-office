export function LegacyHooksBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-surface text-xs text-muted">
      <span className="flex-1">Old The Office hooks found in Claude settings. They're no longer needed.</span>
      <button
        className="h-6 px-2 rounded-md border border-line-strong bg-control text-text hover:border-muted"
        onClick={() => window.sessionTray.removeLegacyHooks()}
      >
        Remove
      </button>
    </div>
  )
}
