import { useEffect, useState, type ReactNode } from 'react'
import { describeInvocation, resumeInvocation } from '../../../desktop/src/core/commands'
import { OVERVIEW_APP_ITEMS, NOTIFY_AFTER_MIN, OVERVIEW_STATUSLINE_ITEMS, type NotifyAfterMin, type Settings as SettingsShape, type OverviewItem, type TerminalChoice } from '../../../desktop/src/core/types'
import { useAppState } from '../hooks/useAppState'
import { useNow } from '../hooks/useSessions'
import { relativeTime } from '../lib/list'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Stepper } from '../components/ui/stepper'
import { THEMES, type ThemeId } from '../lib/themes'

type Section = 'general' | 'appearance' | 'overview' | 'terminal' | 'cleanup'

const SECTIONS: Array<[Section, string, boolean]> = [
  ['general', 'General', true],
  ['appearance', 'Appearance', true],
  ['overview', 'Overview', true],
  ['terminal', 'Terminal', true],
  ['cleanup', 'Cleanup', true],
]

const STATUSLINE_GUIDE = 'https://code.claude.com/docs/en/statusline'

const OVERVIEW_LABELS: Record<OverviewItem, [string, string?]> = {
  running: ['Running and waiting', 'How many sessions are working or waiting for you.'],
  costToday: ['≈ Cost today', 'API-price estimate of sessions active today.'],
  costWeek: ['≈ Cost this week', 'API-price estimate of sessions active in the last 7 days.'],
  sessionsToday: ['Sessions today'],
  limits: ['Plan limits', '5-hour and weekly use, with reset times.'],
}

const PICKABLE: ThemeId[] = ['carbon', 'graphite', 'midnight', 'ink', 'paper']

const SAMPLE_ID = '4f1c9a2e-7b31-4d0c-9e55-2a8f61c0d7b3'

const set = (patch: Partial<SettingsShape>) => window.sessionTray.setSettings(patch)

function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-9 h-5 p-0.5 rounded-full shrink-0 disabled:opacity-40 ${checked ? 'bg-accent justify-end' : 'bg-line-strong justify-start'}`}
    >
      <span className={`w-4 h-4 rounded-full ${checked ? 'bg-on-accent' : 'bg-muted'}`} />
    </button>
  )
}

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-t border-line first:border-t-0">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[13.5px] text-text">{title}</span>
        {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const Group = ({ children }: { children: ReactNode }) => (
  <section className="rounded-[10px] border border-line bg-surface">{children}</section>
)

const Label = ({ children }: { children: ReactNode }) => (
  <span className="text-[12px] text-muted">{children}</span>
)

function ThemeCard({ id, selected }: { id: ThemeId; selected: boolean }) {
  const { name, tag, tokens: t } = THEMES[id]
  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-label={name}
      onClick={() => set({ theme: id })}
      className={`flex flex-col gap-2.5 p-2.5 rounded-xl border bg-surface text-left ${selected ? 'border-accent ring-1 ring-inset ring-accent' : 'border-line'}`}
    >
      <div className="h-[84px] rounded-lg p-2.5 flex flex-col gap-[7px]" style={{ background: t.raised, border: `1px solid ${t.line}` }}>
        <div className="h-[9px] rounded-[3px]" style={{ background: t.canvas, border: `1px solid ${t.line}` }} />
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.run }} /><span className="h-[5px] w-[70%] rounded-[3px]" style={{ background: t.text }} /></div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.idle }} /><span className="h-[5px] w-[52%] rounded-[3px] opacity-55" style={{ background: t.text }} /></div>
        <span className="mt-auto h-[9px] w-[38px] rounded-[3px]" style={{ background: t.accent }} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-medium text-text">{name}</span>
        <span className="ml-auto font-mono text-[10.5px] text-muted">{tag}</span>
      </div>
    </button>
  )
}

const Badge = () => (
  <span aria-hidden="true" className="px-1 rounded border border-line-strong font-mono text-[10px] text-faint">&gt;_</span>
)

const button = 'h-[30px] px-3 rounded-[7px] border border-line-strong bg-control text-[12.5px] text-text hover:border-muted disabled:opacity-40 disabled:hover:border-line-strong'

function OverviewSection() {
  const { settings, statusline, statuslineLinked, canLinkStatusline } = useAppState()
  const now = useNow()
  const [message, setMessage] = useState<string | null>(null)
  const isWindows = window.sessionTray.platform === 'win32'
  const toggle = (id: OverviewItem) => set({ overview: settings.overview.includes(id) ? settings.overview.filter(x => x !== id) : [...settings.overview, id] })

  const row = (id: OverviewItem, disabled = false) => {
    const [title, hint] = OVERVIEW_LABELS[id]
    return (
      <Row key={id} title={title} hint={hint}>
        <Switch label={title} checked={settings.overview.includes(id)} disabled={disabled} onChange={() => toggle(id)} />
      </Row>
    )
  }

  async function connect() {
    setMessage(null)
    const r = await window.sessionTray.connectStatusLine()
    if (!r.ok) {
      setMessage(r.reason === 'unsupported'
        ? "Your status line isn't a command, so it was left alone."
        : "Couldn't read Claude Code's settings file, so nothing was changed.")
    }
  }

  async function disconnect() {
    setMessage(null)
    const r = await window.sessionTray.disconnectStatusLine()
    if (r === 'changed') setMessage('Your status line was changed after connecting, so it was left as it is.')
    if (r === 'unreadable') setMessage("Couldn't read Claude Code's settings file, so nothing was changed.")
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-[13px] text-muted">Choose what the overview line shows in the popover and the window.</p>
      </div>

      <section className="flex flex-col gap-3">
        <Label>From Session Tray</Label>
        <Group>{OVERVIEW_APP_ITEMS.map(id => row(id))}</Group>
      </section>

      <section className="flex flex-col gap-3">
        <span className="flex items-center gap-2"><Badge /><Label>From your Claude Code status line</Label></span>
        <Group>{OVERVIEW_STATUSLINE_ITEMS.map(id => row(id, !statuslineLinked))}</Group>
        <p className="m-0 text-[12.5px] text-muted">While connected, each session's details also show its own status line text, effort level and whether thinking is on.</p>
      </section>

      <Group>
        <Row
          title="Claude Code status line"
          hint={statuslineLinked
            ? (statusline ? `Connected · updated ${relativeTime(statusline.capturedAt, now)}` : 'Connected · waiting for the first update from Claude Code')
            : 'Not connected'}
        >
          {statuslineLinked
            ? <button className={button} onClick={() => void disconnect()}>Disconnect</button>
            : <button className={button} disabled={!canLinkStatusline} onClick={() => void connect()}>Connect status line</button>}
        </Row>
        {!statuslineLinked && (
          <div className="flex flex-col gap-2 px-4 pb-4 text-[12.5px] text-muted">
            <span className="text-text-2 font-medium">What Connect does</span>
            <ul className="m-0 pl-4 flex flex-col gap-1 list-disc">
              <li>Session Tray changes one setting in Claude Code: the status line command in <code className="font-mono">~/.claude/settings.json</code>.</li>
              <li>Your status line keeps working and looks the same. It just also saves a copy of its data for Session Tray.</li>
              <li>If you have no status line yet, Session Tray adds one that shows nothing. Claude Code then hides some keyboard hints at the bottom, such as “esc to interrupt”.</li>
              <li>Nothing is sent anywhere. The copy stays on this computer, in Session Tray's own folder.</li>
              <li>Disconnect puts your original setting back exactly as it was. If you uninstall Session Tray, disconnect first.</li>
            </ul>
            {!canLinkStatusline && isWindows && (
              <span className="text-run">On Windows this needs Git Bash, which Claude Code uses to run status lines. Install Git for Windows, then reopen Settings.</span>
            )}
          </div>
        )}
        {message && <p className="m-0 px-4 pb-4 text-[12.5px] text-run">{message}</p>}
      </Group>

      <p className="m-0 text-[12.5px] text-muted">
        Tip: a status line can show anything, like git status, a clock or the weather. Once connected, its text can show here too.{' '}
        <button className="text-accent-text hover:underline" onClick={() => window.sessionTray.openUrl(STATUSLINE_GUIDE)}>Status line guide</button>
      </p>
    </>
  )
}

export function Settings() {
  const { settings, hasWt } = useAppState()
  const [section, setSection] = useState<Section>('general')
  useEffect(() => window.sessionTray.onSettingsSection?.(s => setSection(s)), [])
  const platform = window.sessionTray.platform
  const sample = { id: SAMPLE_ID, projectPath: platform === 'win32' ? 'C:\\projects\\app' : '/Users/me/app' }
  const preview = resumeInvocation(sample, platform, settings.terminal, hasWt)
  const terminals: Array<[TerminalChoice, string]> = platform === 'win32'
    ? [['auto', 'Windows Terminal if installed'], ['wt', hasWt ? 'Windows Terminal' : 'Windows Terminal (not installed)'], ['powershell', 'PowerShell window']]
    : [['auto', 'Terminal']]

  return (
    <div className="flex flex-wrap h-full min-h-0 bg-canvas text-text font-sans">
      <nav aria-label="Settings sections" className="flex flex-col gap-0.5 w-[220px] shrink-0 px-2.5 py-5 border-r border-line bg-sunken">
        <span className="px-2.5 pb-2.5"><Label>Settings</Label></span>
        {SECTIONS.map(([id, label, enabled]) => (
          <button
            key={id}
            disabled={!enabled}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => setSection(id)}
            className={`flex items-center h-8 px-2.5 rounded-[7px] text-[13px] text-left disabled:opacity-40 ${section === id ? 'bg-selected text-text ring-1 ring-inset ring-line-strong' : 'text-text-2 hover:bg-hover'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-w-0 max-w-[880px] overflow-y-auto px-9 py-7 flex flex-col gap-7">
        {section === 'general' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">General</h1>
            <Group>
              <Row title="Launch at login" hint="Start Session Tray when you sign in.">
                <Switch label="Launch at login" checked={settings.launchAtLogin} onChange={v => set({ launchAtLogin: v })} />
              </Row>
            </Group>
            <Group>
              <Row title="Notify when a session needs input" hint="A silent notification once a session has been waiting this long.">
                <Switch label="Notify when a session needs input" checked={settings.notify} onChange={v => set({ notify: v })} />
              </Row>
              <Row title="Notify after" hint="How long a session waits before you're notified.">
                <Select disabled={!settings.notify} value={String(settings.notifyAfterMin)} onValueChange={v => set({ notifyAfterMin: Number(v) as NotifyAfterMin })}>
                  <SelectTrigger aria-label="Notify after" className="h-[30px] rounded-[7px] border-line-strong text-text disabled:opacity-40"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" collisionPadding={8} className="max-h-[min(320px,var(--radix-select-content-available-height))]">
                    {NOTIFY_AFTER_MIN.map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </Group>
          </>
        )}

        {section === 'overview' && <OverviewSection />}

        {section === 'appearance' && (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
              <p className="text-[13px] text-muted">Applies to the tray popover and the window.</p>
            </div>
            <section className="flex flex-col gap-3">
              <Label>Theme</Label>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {PICKABLE.map(id => <ThemeCard key={id} id={id} selected={settings.theme === id} />)}
              </div>
            </section>
            <Group>
              <Row title="Follow system appearance" hint="Use Paper when the system is in light mode, your theme above when dark.">
                <Switch label="Follow system appearance" checked={settings.followSystem} onChange={v => set({ followSystem: v })} />
              </Row>
              <Row title="Row density" hint="Compact fits more sessions in the popover.">
                <div role="group" aria-label="Row density" className="flex gap-0.5 p-0.5 rounded-[7px] bg-sunken border border-line">
                  {(['comfortable', 'compact'] as const).map(d => (
                    <button
                      key={d}
                      aria-pressed={settings.density === d}
                      onClick={() => set({ density: d })}
                      className={`px-2.5 py-1 rounded-[5px] text-xs font-medium capitalize ${settings.density === d ? 'bg-line-strong text-text' : 'text-muted'}`}
                    >
                      {d === 'comfortable' ? 'Comfortable' : 'Compact'}
                    </button>
                  ))}
                </div>
              </Row>
              <Row title="Pulse running sessions" hint="Animated dot for busy sessions. Off when the system asks for reduced motion.">
                <Switch label="Pulse running sessions" checked={settings.pulse} onChange={v => set({ pulse: v })} />
              </Row>
            </Group>
          </>
        )}

        {section === 'terminal' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Terminal</h1>
            <Group>
              <Row
                title="Open sessions in"
                hint={preview && <span className="font-mono text-[11.5px] break-all">{describeInvocation(preview)}</span>}
              >
                <Select value={settings.terminal} onValueChange={v => set({ terminal: v as TerminalChoice })}>
                  <SelectTrigger aria-label="Open sessions in" className="h-[30px] rounded-[7px] border-line-strong text-text"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" collisionPadding={8} className="max-h-[min(320px,var(--radix-select-content-available-height))]">
                    {terminals.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </Group>
          </>
        )}
        {section === 'cleanup' && (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Cleanup</h1>
              <p className="text-[13px] text-muted">Rules for flagging stale sessions. Pinned and running sessions are never flagged. Archive only hides sessions; files are never moved or deleted.</p>
            </div>
            <Group>
              <Row title="No activity for" hint="Days without activity. Leave empty to turn the rule off.">
                <Stepper
                  label="Idle days"
                  value={settings.stale.idleDays}
                  onChange={v => set({ stale: { ...settings.stale, idleDays: v } })}
                />
              </Row>
              <Row title="Trivial sessions" hint="Fewer than this many messages and no file edits. Leave empty to turn off.">
                <Stepper
                  label="Trivial messages"
                  value={settings.stale.trivialMessages}
                  onChange={v => set({ stale: { ...settings.stale, trivialMessages: v } })}
                />
              </Row>
              <Row title="Project folder is gone">
                <Switch
                  label="Project folder is gone"
                  checked={settings.stale.missingFolder}
                  onChange={v => set({ stale: { ...settings.stale, missingFolder: v } })}
                />
              </Row>
            </Group>
          </>
        )}
      </main>
    </div>
  )
}
