export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// Place the popover against the taskbar edge the tray sits on, centred on the tray icon,
// and always fully inside the display's work area (shrinking it on displays smaller than the popover).
export function popoverPosition(tray: Rect, workArea: Rect, wanted: { width: number; height: number }): Rect {
  const size = { width: Math.min(wanted.width, workArea.width), height: Math.min(wanted.height, workArea.height) }
  const right = workArea.x + workArea.width
  const bottom = workArea.y + workArea.height
  const centreX = tray.x + tray.width / 2 - size.width / 2
  const centreY = tray.y + tray.height / 2 - size.height / 2

  let x: number
  let y: number
  if (tray.y + tray.height <= workArea.y) { x = centreX; y = workArea.y }                       // top
  else if (tray.x + tray.width <= workArea.x) { x = workArea.x; y = centreY }                   // left
  else if (tray.x >= right) { x = right - size.width; y = centreY }                             // right
  else { x = centreX; y = bottom - size.height }                                                // bottom / unknown

  return {
    x: Math.round(clamp(x, workArea.x, right - size.width)),
    y: Math.round(clamp(y, workArea.y, bottom - size.height)),
    width: size.width,
    height: size.height,
  }
}
