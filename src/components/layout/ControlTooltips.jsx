import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

// Supply a hover hint for compact actions that do not already own a
// tooltip. Event delegation preserves tab dragging, popover triggers and
// button geometry instead of adding wrappers around every control.
const CONTROLS = 'button, a[href], [role="tab"]'
const OWN_TOOLTIP = '[data-slot="tooltip-trigger"], .group\\/action-tooltip, .group\\/project'

function hintFor(control) {
  if (control.closest('[data-control-tooltip="off"]')) return null
  if (control.closest(OWN_TOOLTIP) || control.title || control.getAttribute('aria-describedby')) return null
  if (control.matches('[role="treeitem"], [role="menuitem"], [role="checkbox"], [role="switch"]')) return null
  const hint = control.getAttribute('aria-description') || control.getAttribute('aria-label') || control.innerText || control.textContent
  const text = hint?.replace(/\s+/g, ' ').trim()
  return text && text.length <= 100 ? text : null
}

function ControlTooltips() {
  const [tip, setTip] = useState(null)
  const location = useLocation()

  useEffect(() => {
    let timer
    let target
    const hide = () => {
      clearTimeout(timer)
      target = null
      setTip(null)
    }
    const show = (event) => {
      if (event.type === 'pointerover' && event.pointerType === 'touch') return
      const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null
      if (!control || !hintFor(control)) { hide(); return }
      if (target === control) return
      hide()
      target = control
      timer = setTimeout(() => {
        if (!control.isConnected || target !== control) return
        const text = hintFor(control)
        if (!text) return
        const rect = control.getBoundingClientRect()
        const above = rect.bottom + 64 > window.innerHeight
        setTip({ routeKey: location.key, text, left: Math.max(8, Math.min(rect.left + rect.width / 2 - 130, window.innerWidth - 268)), top: above ? rect.top - 8 : rect.bottom + 8, above })
      }, 350)
    }
    const leave = (event) => {
      if (!target?.contains(event.relatedTarget instanceof Node ? event.relatedTarget : null)) hide()
    }
    const key = (event) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', show)
    document.addEventListener('focusin', show)
    document.addEventListener('pointerout', leave)
    document.addEventListener('focusout', leave)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', show)
      document.removeEventListener('focusin', show)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('focusout', leave)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [location.key])

  if (!tip || tip.routeKey !== location.key) return null
  return createPortal(
    <div className="pointer-events-none fixed z-[200] flex w-[260px] justify-center" style={{ left: tip.left, top: tip.top, transform: tip.above ? 'translateY(-100%)' : undefined }}>
      <div role="tooltip" className="w-fit max-w-full rounded-md border border-white/[0.08] bg-popover px-3 py-1.5 text-xs leading-4 text-[#FAFAFA] shadow-lg">{tip.text}</div>
    </div>, document.body
  )
}

export default ControlTooltips
