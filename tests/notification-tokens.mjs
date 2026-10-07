import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The notification tokens (src/index.css): a dark floating surface whose
// text reads at WCAG AA (4.5:1) — on the surface and on its hover step —
// and whose accents and controls are visible on it.
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const token = (name) => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)
  assert.ok(match, `--${name} is a hex color`)
  return match[1]
}
const luminance = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const bg = token('notification-bg')
const hover = token('notification-bg-hover')
const report = []
// Text, and the accents (an icon's color, but held to the text bar too).
for (const name of ['text', 'text-secondary', 'text-meta', 'success', 'info', 'warning', 'error']) {
  for (const [surface, label] of [[bg, ''], [hover, '/hover']]) {
    const ratio = contrast(token(`notification-${name}`), surface)
    if (!label) report.push(`${name} ${ratio.toFixed(2)}`)
    assert.ok(ratio >= 4.5, `--notification-${name}${label} is ${ratio.toFixed(2)}:1 (needs 4.5)`)
  }
}
// The dismiss icon is a control, not text: 3:1.
assert.ok(contrast(token('notification-control'), bg) >= 3, 'the dismiss icon is visible on the surface')
// The filled action is the app's main CTA; its label reads on it.
const action = contrast(token('ds-review-action-fg'), token('ds-review-action-bg'))
report.push(`action ${action.toFixed(2)}`)
assert.ok(action >= 4.5)
assert.match(css, /--notification-action-bg:\s*var\(--ds-review-action-bg\)/)
// A dark surface, one step above the panels; the hover one step above that.
assert.ok(luminance(bg) > luminance(token('ds-surface-card')) && luminance(bg) < 0.05, 'a dark surface, lighter than a panel')
assert.ok(luminance(hover) > luminance(bg))

const section = css.slice(css.indexOf('/* ── Notifications'), css.indexOf('/* Inline decision reasons'))
const rules = section.slice(section.indexOf('.ds-notification {'))
// Nothing in the notification rules sets a color of its own…
assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'notification rules use the tokens, not their own colors')
// …the dismiss button sits inside the card (no negative offset), 28px to hit…
const close = /\.ds-notification-close \{([^}]*)\}/.exec(rules)[1]
assert.match(close, /top: 10px;[\s\S]*right: 10px;[\s\S]*width: 28px;[\s\S]*height: 28px;/)
assert.ok(!/:\s*-\d/.test(close), 'no negative offsets on the dismiss button')
// …the card doesn't clip its own contents, and there's no side line…
const surface = /\.ds-notification \{([^}]*)\}/.exec(rules)[1]
assert.ok(!/overflow:\s*hidden/.test(surface), 'the card doesn’t clip what’s in it')
assert.ok(!rules.includes('.ds-notification::before'), 'no left accent line')
// …and the toast overrides outrank Sonner's own stylesheet, pinning its close button inside the toast.
const toastClose = /\[data-sonner-toaster\] \[data-sonner-toast\]\.cn-toast \[data-close-button\] \{([^}]*)\}/.exec(rules)[1]
for (const pinned of ['top: 10px !important', 'right: 10px !important', 'left: auto !important', 'transform: none !important']) assert.ok(toastClose.includes(pinned), `toast close button: ${pinned}`)
assert.match(rules, /\[data-sonner-toaster\] \[data-sonner-toast\]\.cn-toast \[data-description\] \{[^}]*color: var\(--notification-text-secondary\) !important/)
console.log(`Passed: notification tokens meet AA on the dark surface (${report.join(' · ')}).`)
