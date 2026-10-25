import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'
import { Tooltip } from './tooltip'

export function CopyButton({ label = 'Copy', onCopy, className = '' }: { label?: string; onCopy: () => void; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const click = () => {
    onCopy()
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip content={copied ? 'Copied' : label} open={copied ? true : undefined}>
      <button
        type="button"
        aria-label={label}
        onClick={click}
        className={`focus-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text ${className}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </Tooltip>
  )
}
