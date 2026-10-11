import { useReducer } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'

// Progressive disclosure: a section that folds. Its open/closed state is
// kept for the session (per scope + key), so coming back to a change finds
// it as it was left; until a person toggles one, it follows its default
// (the step that's current is open, finished ones are folded).
const memory = new Map()

export function useFoldState(scope) {
  const [, rerender] = useReducer((count) => count + 1, 0)
  const id = (key) => `${scope}:${key}`
  return {
    get: (key, fallback) => (memory.has(id(key)) ? memory.get(id(key)) : fallback),
    set: (key, value) => { memory.set(id(key), value); rerender() },
    setMany: (keys, value) => { keys.forEach((key) => memory.set(id(key), value)); rerender() },
  }
}

// The height eases in 180ms; a folded body can't be tabbed into (`inert`).
export function FoldBody({ open, children, className }) {
  return (
    <div className={cn('grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div inert={!open} aria-hidden={!open} className={cn('min-h-0 overflow-hidden', className)}>{children}</div>
    </div>
  )
}

export function Chevron({ open, className }) {
  return <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-slate-400 transition-transform duration-[180ms] motion-reduce:transition-none', open && 'rotate-180', className)} />
}

// A small fold inside a card: `header` is always shown, the chevron at its end.
export function Fold({ open, onToggle, header, children, className, ...rest }) {
  return (
    <div className={className} {...rest}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="ds-intrinsic flex w-full min-w-0 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-emerald-300">
        <span className="flex min-w-0 flex-1 items-center gap-2">{header}</span>
        <Chevron open={open} />
      </button>
      <FoldBody open={open}>{children}</FoldBody>
    </div>
  )
}
