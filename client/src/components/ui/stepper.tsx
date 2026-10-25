import { MinusIcon, PlusIcon } from './icons'

interface Props {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
}

const inset = 'focus-visible:![outline-offset:-2px]'
const button = `focus-ring ${inset} inline-flex h-[30px] w-[26px] items-center justify-center text-muted hover:text-text`

export function Stepper({ label, value, onChange, min = 1 }: Props) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[7px] border border-line-strong bg-control">
      <button type="button" aria-label={`Decrease ${label}`} className={button} onClick={() => onChange(value === null || value <= min ? null : value - 1)}>
        <MinusIcon />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value ?? ''}
        placeholder="Off"
        onChange={e => {
          const t = e.target.value.trim()
          const n = /^\d+$/.test(t) ? Number.parseInt(t, 10) : NaN
          onChange(n >= min ? n : null)
        }}
        className={`focus-ring ${inset} h-[30px] w-12 bg-transparent px-1 text-center font-mono text-[12.5px] text-text placeholder:text-muted`}
      />
      <button type="button" aria-label={`Increase ${label}`} className={button} onClick={() => onChange(value === null ? min : value + 1)}>
        <PlusIcon />
      </button>
    </div>
  )
}
