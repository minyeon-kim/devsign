import { useLayoutEffect, useRef } from 'react'
import { cn } from 'cn'

// A box whose height eases when what's in it changes with `trigger` (a card
// going from "picking" to "waiting": rows leave, the card shortens) — so the
// page under it slides instead of jumping. Its height is its content's own
// the rest of the time: only a change of `trigger` is eased, over
// --duration-base. Nothing eases under reduced motion.
export function SmoothHeight({ trigger, children, className, ...rest }) {
  const box = useRef(null)
  const last = useRef({ trigger, height: null })
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return undefined
    const height = node.offsetHeight
    const before = last.current
    last.current = { trigger, height }
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (before.trigger === trigger || before.height == null || before.height === height || still) return undefined
    // From where it was to where it is, then back to its own height.
    node.style.height = `${before.height}px`
    node.style.overflow = 'hidden'
    node.getBoundingClientRect()
    node.style.transition = 'height var(--duration-base) var(--ease-out)'
    node.style.height = `${height}px`
    const settle = () => { node.style.height = ''; node.style.overflow = ''; node.style.transition = '' }
    const timer = window.setTimeout(settle, 260)
    return () => { window.clearTimeout(timer); settle() }
  })
  // (flow-root: its children's margins are its own, eased or not — so the height measured is the height it settles at.)
  return <div ref={box} data-smooth-height className={cn('flow-root', className)} {...rest}>{children}</div>
}
