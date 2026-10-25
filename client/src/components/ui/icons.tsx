import type { ReactNode, SVGProps } from 'react'

function svg(path: ReactNode) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    )
  }
}

export const CopyIcon = svg(<><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" /></>)
export const CheckIcon = svg(<path d="M3 8.5l3.2 3.2L13 4.8" />)
export const FolderIcon = svg(<path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />)
export const BranchIcon = svg(<><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5.5" r="1.5" /><path d="M4.5 5v6M11.5 7c0 3-7 1.5-7 4" /></>)
export const MoreIcon = svg(<><circle cx="3.5" cy="8" r=".5" /><circle cx="8" cy="8" r=".5" /><circle cx="12.5" cy="8" r=".5" /></>)
export const ChevronDownIcon = svg(<path d="M4 6l4 4 4-4" />)
export const MinusIcon = svg(<path d="M3.5 8h9" />)
export const PlusIcon = svg(<path d="M8 3.5v9M3.5 8h9" />)
export const PencilIcon = svg(<path d="M10.5 3l2.5 2.5L5.5 13H3v-2.5z" />)
