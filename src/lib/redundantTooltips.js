import { translateText } from '@/i18n/translate'
import { getLanguage } from '@/i18n/language'

// A tooltip that says only what the control already says on itself is noise: hovering "공유" shouldn't pop up
// "공유". Two kinds are checked, each when it would show:
//   · a `title` — on hover, taken off the element when it's the element's own visible text;
//   · a Tooltip popup (ui/tooltip) — not shown when it's its trigger's own visible text.
// Text cut short on screen ("…") keeps its tooltip: there the tooltip is the rest of it.

const norm = (text) => (text ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()

// Whether `element` (or something in it) is cut short — its text wider than its box.
function clipped(element) {
  for (const node of [element, ...element.querySelectorAll('*')]) {
    if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflow !== 'visible') return true
  }
  return false
}

// Whether `hint` says nothing more than `element` shows.
export function saysTheSame(element, hint) {
  const text = norm(element?.innerText ?? element?.textContent)
  if (!text) return false
  const said = norm(hint)
  const translated = norm(translateText(hint ?? '', getLanguage()))
  return (said === text || translated === text) && !clipped(element)
}

let installed = false
export function installRedundantTitleGuard(root = document) {
  if (installed || typeof document === 'undefined') return
  installed = true
  root.addEventListener('pointerover', (event) => {
    const element = event.target instanceof Element ? event.target.closest('[title]') : null
    if (element && saysTheSame(element, element.getAttribute('title'))) element.removeAttribute('title')
  }, true)
}
