import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The notification tokens (src/index.css): every text and accent color has
// to read on the notification's own light surface — WCAG AA, 4.5:1 — and on
// its hover step where text sits on it.
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const token = (name) => {
  const match = new RegExp(`--notification-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)
  assert.ok(match, `--notification-${name} is a hex color`)
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

const bg = token('bg')
const hover = token('bg-hover')
const report = []
for (const name of ['text', 'text-secondary', 'success', 'warning', 'error', 'info']) {
  const ratio = contrast(token(name), bg)
  report.push(`${name} ${ratio.toFixed(2)}`)
  assert.ok(ratio >= 4.5, `--notification-${name} on the surface is ${ratio.toFixed(2)}:1 (needs 4.5)`)
}
// Text sits on the hover step too (a row under the pointer).
for (const name of ['text', 'text-secondary']) {
  const ratio = contrast(token(name), hover)
  report.push(`${name}/hover ${ratio.toFixed(2)}`)
  assert.ok(ratio >= 4.5, `--notification-${name} on the hover surface is ${ratio.toFixed(2)}:1 (needs 4.5)`)
}
const action = contrast(token('action-text'), token('action-bg'))
report.push(`action ${action.toFixed(2)}`)
assert.ok(action >= 4.5, 'the filled action’s label reads on its fill')
// The hover step is darker than the surface, and the surface is still a light box on the dark app.
assert.ok(luminance(hover) < luminance(bg))
assert.ok(contrast(bg, '#111111') >= 7, 'still reads as a light box on the app background')
// …but not a near-white one: clearly greyer than an off-white.
assert.ok(luminance(bg) < 0.6, 'the surface is a grey, not a near-white')
// The dismiss button is a 32px target inside the card.
assert.match(css, /\.ds-notification-close \{[^}]*top: 8px;[^}]*right: 8px;[^}]*width: 32px;[^}]*height: 32px;/s)
// Nothing in the notification styles sets a color of its own.
const section = css.slice(css.indexOf('/* ── Notifications'), css.indexOf('/* Inline decision reasons'))
const rules = section.slice(section.indexOf('.ds-notification {'))
const stray = rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
assert.deepEqual(stray.filter((hex) => hex !== '#000'), [], 'notification rules use the tokens, not their own colors')
console.log(`Passed: notification tokens meet AA on their surface (${report.join(' · ')}).`)
