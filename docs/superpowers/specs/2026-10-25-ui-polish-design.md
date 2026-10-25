# UI polish pass — design

Date: 2026-10-25. Status: approved by the owner 2026-10-25. Mockups: `.superpowers/brainstorm/522-1792920283/content/details-layout-v6.html` (final), v1–v5 for history.

## 1. Intent

Before v1.0.0 and the next plan, make what exists calm, consistent and ready for more data. The owner's worry: "now it looks good, but with more data it will grow into a mess", most of all in **session details**. A session with 20 PRs, 15 MCP servers and many agents must keep the same shape as a small one.

How the owner uses details, most common first:
1. Find the session.
2. Read its summary, to paste into a new session — or copy its id or resume command.
3. Occasionally, see the full picture (stats, messages, agents, PRs, plugged-in servers, file info) so they don't have to run `claude` commands and spend tokens to learn it.

## 2. Goals, non-goals, anti-goals

**Goals**
- Details: the three things above are at the top, visible without scrolling, one click to copy each.
- Everything else sits in tabs with counts; the page does not grow with data.
- No native browser controls anywhere: no number spinners, no native `<select>`, no native checkboxes.
- One way of saying things across the app: sentence-case labels, one copy control, one tooltip, consistent buttons.
- Quality floor: visible keyboard focus, keyboard-operable menus/tabs/selects, reduced motion respected, all five themes.

**Non-goals**
- New data or features. Every field shown today stays reachable; nothing is added to `core/`.
- Changing the palette, themes, state colors or fonts (Carbon + Graphite/Midnight/Ink/Paper, Geist Sans + Mono stay).
- Redesigning the popover/window list layout beyond the fixes in §5.

**Anti-goals** (would be a failure even if it works)
- Copy buttons everywhere. The owner rejected copy on messages, file paths in the summary and the branch: "annoying and useless".
- Controls the owner can't find: the "tools" toggle at the bottom of the messages card was missed; tab-specific controls go in the tab bar.
- Tooltips clipped by a container edge, or shown below the trigger.
- Generic generated-UI tells (from the `frontend-design` review): ALL-CAPS mono eyebrow labels on everything, every block in an identical rounded card, meta strings joined with " · ".

## 3. Constraints

- Electron + React 18 + Vite + Tailwind CSS v3; theme colors are CSS variables from `client/src/lib/themes.ts` (tokens in `tailwind.config.js`). New components use those tokens only.
- Renderer-only change. No IPC, `core/` or `SessionRecord` changes. (Exception: none expected; if one turns up, stop and ask.)
- Tests: `npm test -w client` (Vitest + Testing Library) must pass; existing tests are updated where labels or roles change, not deleted.
- Popover is a small window (~576 px wide); everything in §5 must fit it.

## 4. Session details (decided with the owner)

Final mockup: v6. Top to bottom:

### 4.1 Header
- **Title** (22px, semibold) + rename pencil (existing behaviour) + **state** as a colored dot and sentence-case word ("Idle", "Running", "Waiting · permission"), not a chip with pid. The pid and session name move to the Info tab.
- Right side: **Resume** (primary; still reads "Open another" while the session is running, as today), **Continue in…**, and a **⋯** menu (Radix DropdownMenu) with Pin/Unpin, Reveal file, Open transcript, Archive (disabled while live, same tooltip text as today).
- **Subline**: folder icon + project path (mono) + copy icon; branch icon + branch (mono, no copy); then "Started Oct 24, 21:13, last active 3 min ago". "(missing)" stays after a path whose folder is gone. When the session was continued elsewhere and that session is listed, the subline ends with a "Continued in" link (same target as today's button).

### 4.2 Id and command
Plain label/value lines, no card:
- `Session ID` — the id (mono) + copy icon.
- `Resume command` — the full `copyCommand` text (mono, truncated with full text in a tooltip) + copy icon.

### 4.3 Summary (the one boxed element)
- Card header: "Summary" + a quiet source note ("from Claude's recap" / "from the compaction summary" / "extracted from the conversation") + a labeled **Copy as prompt** button (same `handoffPrompt` as today).
- Body: summary text at 15px, line-height ~1.65, max width ~72ch. For extract-only handoffs: Goal / Last ask / Last answer as today, same type.
- Files: first 3 (mono), then "Show all N" which expands in place (and "Show less"). No copy on files.
- Branch line as today, no copy.
- While details load: a short skeleton in the card, not an empty gap. If details are unavailable: the card is omitted (today's behaviour).

### 4.4 Figures
Four bare figures (mono number, small muted caption), no card or dividers: messages; context `215k / 1M` with "context, 22%" (the progress bar goes); ≈ API cost (model in its tooltip); active duration. Same data as today's stat strip; the "N subagents" sub-line moves to the Agents tab.

### 4.5 Tabs (Radix Tabs)
Under the figures; sentence-case tab names with a muted count. A tab with nothing to show is not rendered. The selected tab is remembered per window (renderer state; default Messages). If the remembered tab is missing for a session, fall back to Messages.

- **Messages** (count = message total): today's peek. Tab bar right side, only while this tab is open: **Show tool calls** switch (same `peekTools` setting). Caption under the list: "Last 6 of 383". No copy on messages. "Open transcript" lives in the ⋯ menu.
- **Agents** (count = all agents of the session): today's Agents list (running first, finished within 10 min, "N done earlier"). When the session isn't live, show `subagentCount` as "N subagents ran in this session" instead of an empty tab; hide the tab when the count is 0.
- **Pull requests** (count): each PR as a row: the URL shortened to `owner/repo #N` when it parses, full URL in the tooltip; click opens it (existing `openUrl`); copy icon copies the full URL.
- **Plugged in** (count = servers + plugins): today's `PluggedInCard` content without its own heading; the "Not live…" note stays under the list.
- **Info**: a two-column key/value list: Surface, Claude Code version, File size, Title from, Session ID, pid and live name (when live), and the `>_` status line text, effort and thinking (when known; same marking as today).

Loading and missing tabs *(builder's call)*: the tab bar renders immediately. Messages always shows as a tab; while details load its panel shows a skeleton, and if details are unavailable or the peek is empty it says "No messages to show". Counts that aren't known yet (Plugged in) show no number until they arrive; the Plugged-in fetch moves up into `DetailPanel` so its count can sit on the tab. A tab arriving late never steals the selection. If the remembered tab doesn't exist for a session, select Messages.

Layout: the tab panel takes the remaining height of the details pane and scrolls inside itself (min height ~240px), so the page itself stays one screen at common window sizes.

### 4.6 Copy control
One component everywhere it appears: a 24×24 icon button (copy glyph), Radix Tooltip "Copy" on hover/focus, on click it copies, swaps to a check for ~1.5s and the tooltip reads "Copied". Tooltip side: top, rendered in a portal (never clipped). The "Copy as prompt" button uses the same feedback on its label ("Copied").

Copy appears only on: session id, resume command, summary (as prompt), project path, each PR link — and, outside details, the session row's action strip (§5).

Tooltip scope *(builder's call)*: Radix Tooltip for the copy control and for every control in the new details header and tabs (including the disabled Archive reason, via a focusable wrapper). Native `title=` elsewhere (rows, Cleanup, Settings, overview line) stays for now.

## 5. Rest of the app

- **Labels**: replace the uppercase tracked mono labels (`font-mono uppercase tracking-[.08em]`) with sentence-case sans labels in `text-muted` across details, popover/window section headers (Running / Pinned / Recent), Cleanup and Settings. Mono stays for machine text: ids, commands, paths, branches, numbers, times.
- **Project filter** (popover and window): Radix Select styled like the other controls; trigger shows the full selected name with truncation only past its max width; "All projects" fits.
- **Settings selects** (Notify after, terminal choice): Radix Select.
- **Threshold inputs** (stale idle days, trivial messages): a stepper — `−` / value / `+` buttons around a text input with `inputMode="numeric"`, no native spinners; empty = off (placeholder "Off"), same `null` semantics as today.
- **Checkboxes** (Cleanup rules and table rows): Radix Checkbox with theme tokens, including the header "select all" if present.
- **Session rows** (popover and window): the text "Copy" button in the action strip becomes the same copy control as §4.6 (icon, tooltip "Copy resume command", check + "Copied"); it still copies the resume command. Owner's call: consistent with details.
- **Untitled sessions**: rows and details show "Untitled session" in `text-muted` instead of "—".
- **Focus**: one `focus-visible` ring token for all buttons, tabs, menu items and inputs.
- **Motion**: only action feedback (copy check, menu/select open, tab underline move); none on load. `prefers-reduced-motion` disables the transitions.

## 6. How (owner's calls vs builder's)

**Owner decided:** tabs (not folding sections); the copy set in §4.6; the row's Copy button uses the same copy control; "Copied" tooltip above; Show tool calls in the tab bar, Messages only; summary as the hero; adopt shadcn/Radix components; keep palette, themes and fonts; v6 typography changes.

**Builder's call (my defaults, change if a better option appears):**
- Use shadcn's recipes as a starting point, copied into `client/src/components/ui/` (select, checkbox, tooltip, tabs, dropdown-menu), restyled with our tokens. Dependencies: the matching `@radix-ui/react-*` packages only; `clsx`/`tailwind-merge`/`class-variance-authority` only if a recipe genuinely needs them.
- Icons: inline SVGs as today (no icon library) unless the count grows past ~12.
- Component structure inside `DetailPanel` (split into `DetailHeader`, `SummaryCard`, `DetailTabs` etc. as it helps).
- Exact spacing values within the existing scale.

## 7. Done when

- Details matches v6 in all five themes; a session with ≥20 PRs, ≥15 servers and ≥10 agents keeps the header, summary and figures in place with only the tab panel scrolling.
- No native spinner, select arrow or checkbox remains (grep for `type="number"`, `<select`, `type="checkbox"` finds nothing in `client/src`).
- Keyboard: Tab reaches every control with a visible ring; tabs switch with arrow keys; ⋯ menu and selects open with Enter/Space and close with Esc.
- `npm test -w client` and `npm test -w desktop` pass.
