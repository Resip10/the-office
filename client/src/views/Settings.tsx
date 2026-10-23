import { useState, type ReactNode } from 'react'
import { describeInvocation, resumeInvocation } from '../../../desktop/src/core/commands'
import { NOTIFY_AFTER_MIN, type NotifyAfterMin, type Settings as SettingsShape, type TerminalChoice } from '../../../desktop/src/core/types'
import { useAppState } from '../hooks/useAppState'
import { THEMES, type ThemeId } from '../lib/themes'

type Section = 'general' | 'appearance' | 'terminal' | 'cleanup'

const SECTIONS: Array<[Section, string, boolean]> = [
  ['general', 'General', true],
  ['appearance', 'Appearance', true],
  ['terminal', 'Terminal', true],
  ['cleanup', 'Cleanup', true],
]

const PICKABLE: ThemeId[] = ['carbon', 'graphite', 'midnight', 'ink', 'paper']

const SAMPLE_ID = '4f1c9a2e-7b31-4d0c-9e55-2a8f61c0d7b3'

const set = (patch: Partial<SettingsShape>) => window.sessionTray.setSettings(patch)

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex w-9 h-5 p-0.5 rounded-full shrink-0 ${checked ? 'bg-accent justify-end' : 'bg-line-strong justify-start'}`}
    >
      <span className={`w-4 h-4 rounded-full ${checked ? 'bg-on-accent' : 'bg-muted'}`} />
    </button>
  )
}

function ThresholdInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      min={1}
      aria-label={label}
      value={value ?? ''}
      placeholder="off"
      onChange={e => {
        const n = Number.parseInt(e.target.value, 10)
        onChange(Number.isInteger(n) && n > 0 ? n : null)
      }}
      className="w-20 h-[30px] px-2.5 rounded-[7px] border border-line-strong bg-control font-mono text-[12.5px] text-text text-right"
    />
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
  <span className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted">{children}</span>
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

export function Settings() {
  const { settings, hasWt } = useAppState()
  const [section, setSection] = useState<Section>('general')
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
                <select
                  aria-label="Notify after"
                  disabled={!settings.notify}
                  value={settings.notifyAfterMin}
                  onChange={e => set({ notifyAfterMin: Number(e.target.value) as NotifyAfterMin })}
                  className="h-[30px] px-2.5 rounded-[7px] border border-line-strong bg-control text-[12.5px] text-text disabled:opacity-40"
                >
                  {NOTIFY_AFTER_MIN.map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </Row>
            </Group>
          </>
        )}

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
                <select
                  aria-label="Open sessions in"
                  value={settings.terminal}
                  onChange={e => set({ terminal: e.target.value as TerminalChoice })}
                  className="h-[30px] px-2.5 rounded-[7px] border border-line-strong bg-control text-[12.5px] text-text"
                >
                  {terminals.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
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
                <ThresholdInput
                  label="Idle days"
                  value={settings.stale.idleDays}
                  onChange={v => set({ stale: { ...settings.stale, idleDays: v } })}
                />
              </Row>
              <Row title="Trivial sessions" hint="Fewer than this many messages and no file edits. Leave empty to turn off.">
                <ThresholdInput
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
