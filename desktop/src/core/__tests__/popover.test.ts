import { popoverPosition } from '../popover'

const SIZE = { width: 380, height: 560 }
const tray = (x: number, y: number) => ({ x, y, width: 24, height: 24 })

describe('popoverPosition', () => {
  it('taskbar bottom: above the tray, centred on it', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 }
    expect(popoverPosition(tray(1700, 1045), workArea, SIZE)).toEqual({ x: 1522, y: 480, width: 380, height: 560 })
  })

  it('taskbar top: below the tray', () => {
    const workArea = { x: 0, y: 40, width: 1920, height: 1040 }
    expect(popoverPosition(tray(1700, 8), workArea, SIZE)).toEqual({ x: 1522, y: 40, width: 380, height: 560 })
  })

  it('taskbar left: right of the tray, centred vertically', () => {
    const workArea = { x: 60, y: 0, width: 1860, height: 1080 }
    expect(popoverPosition(tray(18, 500), workArea, SIZE)).toEqual({ x: 60, y: 232, width: 380, height: 560 })
  })

  it('taskbar right: left of the tray', () => {
    const workArea = { x: 0, y: 0, width: 1860, height: 1080 }
    expect(popoverPosition(tray(1878, 500), workArea, SIZE)).toEqual({ x: 1480, y: 232, width: 380, height: 560 })
  })

  it('tray near screen edge → clamped inside work area', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 }
    expect(popoverPosition(tray(1900, 1045), workArea, SIZE)).toEqual({ x: 1540, y: 480, width: 380, height: 560 })
    const vertical = { x: 0, y: 0, width: 1860, height: 1080 }
    expect(popoverPosition(tray(1878, 1060), vertical, SIZE)).toEqual({ x: 1480, y: 520, width: 380, height: 560 })
  })

  it('work area shorter or narrower than the popover → popover shrinks to fit', () => {
    const workArea = { x: 0, y: 0, width: 1280, height: 432 } // 1280x720 at 150% minus taskbar
    expect(popoverPosition(tray(1200, 440), workArea, SIZE)).toEqual({ x: 900, y: 0, width: 380, height: 432 })
    const narrow = { x: 0, y: 0, width: 300, height: 1000 }
    expect(popoverPosition(tray(150, 1005), narrow, SIZE)).toEqual({ x: 0, y: 440, width: 300, height: 560 })
  })

  it('tray on a secondary display', () => {
    const workArea = { x: 1920, y: 0, width: 2560, height: 1400 }
    expect(popoverPosition(tray(4400, 1405), workArea, SIZE)).toEqual({ x: 4100, y: 840, width: 380, height: 560 })
  })

  it('tray bounds inside the work area (auto-hide taskbar) → bottom placement', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(popoverPosition(tray(1700, 1050), workArea, SIZE)).toEqual({ x: 1522, y: 520, width: 380, height: 560 })
  })
})
