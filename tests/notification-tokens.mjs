import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The notification tokens (src/index.css): a dark frosted card (#2B2B2B,
// as the system's own notifications) floating over the app whose text reads at
// WCAG AA (4.5:1) — on the surface and on its hover step — and whose
// accents and controls are visible on it.
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
// The tokens point at the project's own (the surfaces, the foreground, the
// neutral grey scale, the mint, Tailwind's amber and red), so a value is
// followed through var() to a color, in the dark theme the app runs in.
const tailwind = readFileSync(new URL('../node_modules/tailwindcss/theme.css', import.meta.url), 'utf8')
const declared = (source) => [...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
// (Later declarations win: index.css over Tailwind, `.dark` over `:root`.)
const values = new Map([...declared(tailwind), ...declared(css)])
const resolve = (value, depth = 0) => {
  const ref = /^var\((--[\w-]+)\)$/.exec(value)
  if (!ref) return value
  assert.ok(depth < 8 && values.has(ref[1]), `${ref[1]} is defined`)
  return resolve(values.get(ref[1]), depth + 1)
}
// sRGB channels (0–1, gamma-encoded) from a hex or an oklch() color.
const channels = (color) => {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255)
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(color)
  assert.ok(match, `"${color}" is a hex or oklch color`)
  const L = Number(match[1]) / (match[2] ? 100 : 1), C = Number(match[3]), h = (Number(match[4]) * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return linear.map((v) => Math.min(1, Math.max(0, v))).map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
}
const token = (name) => {
  assert.ok(values.has(`--${name}`), `--${name} is defined`)
  return resolve(values.get(`--${name}`))
}
const luminance = (color) => {
  const [r, g, b] = channels(color).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// A grey with no tint: its three channels are (all but) equal.
const neutral = (color) => { const [r, g, b] = channels(color); return Math.max(r, g, b) - Math.min(r, g, b) < 0.01 }

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
// The action is a grey pill a step above the card; its label reads on it, and on its hover.
const action = contrast(token('notification-action-text'), token('notification-action-bg'))
report.push(`action ${action.toFixed(2)}`)
assert.ok(action >= 4.5, `the action label is ${action.toFixed(2)}:1 (needs 4.5)`)
assert.ok(contrast(token('notification-action-text'), token('notification-action-bg-hover')) >= 4.5, 'the label reads on the hover too')
assert.match(css, /--notification-action-bg:\s*var\(--color-slate-\d+\)/)
// Greys are neutral — no blue cast — for the surface, its hover, the text and the dismiss icon.
for (const name of ['notification-bg', 'notification-bg-hover', 'notification-text', 'notification-text-secondary', 'notification-text-meta', 'notification-control']) {
  assert.ok(neutral(token(name)), `--${name} (${token(name)}) is a neutral grey`)
}
// Every color is one of the project's: the token block declares none of its own.
const block = css.slice(css.indexOf('--notification-bg:'), css.indexOf('--notification-radius:'))
assert.deepEqual(block.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'notification color tokens reuse project tokens, not new hex values')
assert.ok(!/indigo|blue|violet|purple|sky/.test(block), 'no blue, indigo or violet in notifications')
// Success and info are the mint's family, a shade deep enough for the grey.
assert.match(css, /--notification-success:\s*var\(--color-emerald-\d+\)/)
assert.equal(token('notification-info'), token('notification-success'))
// A dark grey surface (#2B2B2B, the project's --ds-notice-surface), laid
// over the app as frosted glass, and the hover a step lighter.
assert.match(css, /--notification-bg:\s*var\(--ds-notice-surface\)/)
assert.equal(bg.toUpperCase(), '#2B2B2B', 'the surface is #2B2B2B')
assert.ok(luminance(bg) < 0.05, 'a dark surface')
assert.ok(luminance(hover) > luminance(bg), 'the hover is a step lighter')

const section = css.slice(css.indexOf('/* ── Notifications'), css.indexOf('/* Inline decision reasons'))
const rules = section.slice(section.indexOf('.ds-notification {'))
// Nothing in the notification rules sets a color of its own…
assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'notification rules use the tokens, not their own colors')
// …the dismiss button is a round × on the top-left corner, half over its edge, shown on hover or focus…
const close = /\.ds-notification-close \{([^}]*)\}/.exec(rules)[1]
assert.match(close, /top: -7px;[\s\S]*left: -7px;[\s\S]*width: 22px;[\s\S]*height: 22px;[\s\S]*border-radius: 9999px;[\s\S]*opacity: 0;/)
assert.ok(rules.includes('.ds-notification:is(:hover, :focus-within) > .ds-notification-close { opacity: 1; }'))
// …the card doesn't clip its own contents, and there's no side line…
const surface = /\.ds-notification \{([^}]*)\}/.exec(rules)[1]
assert.ok(!/overflow:\s*hidden/.test(surface), 'the card doesn’t clip what’s in it')
assert.ok(!rules.includes('.ds-notification::before'), 'no left accent line')
// …and the toast overrides outrank Sonner's own stylesheet, pinning its close button inside the toast.
const toastClose = /\[data-sonner-toaster\] \[data-sonner-toast\]\.cn-toast \[data-close-button\] \{([^}]*)\}/.exec(rules)[1]
for (const pinned of ['top: -7px !important', 'left: -7px !important', 'right: auto !important', 'transform: none !important']) assert.ok(toastClose.includes(pinned), `toast close button: ${pinned}`)
assert.match(rules, /\[data-sonner-toaster\] \[data-sonner-toast\]\.cn-toast \[data-description\] \{[^}]*color: var\(--notification-text-secondary\) !important/)
console.log(`Passed: notification tokens meet AA on the dark surface (${report.join(' · ')}).`)
