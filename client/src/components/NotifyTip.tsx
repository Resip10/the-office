// Offered once a session is waiting for input; closing it or turning notifications on retires it for good.
export function NotifyTip() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-surface text-xs text-muted">
      <span className="inline-block w-[7px] h-[7px] rounded-full shrink-0 bg-wait" aria-hidden="true" />
      <span className="flex-1">A session is waiting for input. Get a notification next time?</span>
      <button
        className="h-6 px-2 rounded-md border border-line-strong bg-control text-text hover:border-muted"
        onClick={() => window.sessionTray.setSettings({ notify: true })}
      >
        Turn on
      </button>
      <button
        aria-label="Dismiss tip"
        title="Don't show again"
        className="flex items-center justify-center w-6 h-6 rounded-md text-muted hover:text-text hover:bg-hover"
        onClick={() => window.sessionTray.dismissNotifyTip()}
      >
        ×
      </button>
    </div>
  )
}
