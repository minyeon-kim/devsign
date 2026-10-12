import { BREAKPOINT_TOKENS, COLOR_TOKENS, SIZE_TOKENS, SPACE_TOKENS, WEIGHT_TOKENS } from '@/lib/designTokens'

// The kinds of change a 변경 확인 can be — and, for each, the only two things
// that differ on the shared 해결 방법 card (DesignDecisionFlow's
// ProposalSection): what's put into the picture, and the scale another value
// is picked from. Everything else on the card is the same for every kind.
//
// A kind's adapter gives its scale as data — the steps, their unit, their
// token names — and the one scale component (conflicts/ValueScale) draws it.
// A structure has no scale: another way is laid out as a screen (columns,
// card width), as CON-002's is.
//
// A new kind is added here: to CHANGE_TYPES, to ADAPTERS and to typeOf. A
// kind with no adapter doesn't draw a card at all — adapterOf throws, and
// tests/change-adapters.mjs fails for it and for any seeded change whose
// kind isn't one of these.

/**
 * @typedef {'layout' | 'breakpoint' | 'spacing' | 'size' | 'color' | 'weight' | 'text'} ChangeType
 *
 * @typedef {object} ScaleStep
 * @property {string} key      what the value is, to compare by ("16", "#2563eb")
 * @property {string} value    the value as it's said and kept ("16px (space.4)")
 * @property {string} label    what the step shows ("16")
 * @property {string | null} token   its token's name ("space.4"), when it has one
 * @property {string | null} swatch  its colour, for a palette
 *
 * @typedef {object} ChangeAdapter
 * @property {'screen' | 'element'} picture   what's compared: whole screens (CON-002's way), or the element
 * @property {string} label    what the scale is of ("간격")
 * @property {string} unit     the steps' unit ("px", ""), said once
 * @property {'px' | 'hex' | 'text' | null} custom   how a value that isn't on the scale is typed (null: it can't be)
 * @property {(conflict: object) => { token: string | null, text: string }[] | null} tokens   the scale's own steps (null: no scale)
 * @property {(text: string) => string | null} key   a value as what it's compared by
 * @property {(conflict: object, text: string) => object | null} values   a value as what the picture is drawn with (null: can't be drawn)
 */

/** @type {ChangeType[]} */
export const CHANGE_TYPES = ['layout', 'breakpoint', 'spacing', 'size', 'color', 'weight', 'text']

const numberOf = (text) => { const found = /-?\d+(\.\d+)?/.exec(String(text ?? '')); return found ? Number(found[0]) : null }
const hexOf = (text) => /#[0-9a-fA-F]{3,8}\b/.exec(String(text ?? ''))?.[0] ?? null
const numberKey = (text) => { const value = numberOf(text); return value == null ? null : String(value) }
const pxSteps = (tokens) => tokens.map(({ token, px }) => ({ token, text: `${px}px (${token})` }))
const none = () => null

/** @type {Record<ChangeType, ChangeAdapter>} */
export const ADAPTERS = {
  // A structure: compared as whole screens; another way is laid out with the
  // layout controls (columns, card width) — not picked from a scale.
  layout: { picture: 'screen', label: '레이아웃', unit: '', custom: null, tokens: none, key: none, values: none },
  // Where a layout changes: compared as screens at a width between the two.
  breakpoint: {
    picture: 'screen', label: '기준 폭', unit: 'px', custom: 'px',
    tokens: () => pxSteps(BREAKPOINT_TOKENS),
    key: numberKey,
    values: (conflict, text) => { const at = numberOf(text); return at > 0 ? { ...conflict.preview?.after, collapseAt: at } : null },
  },
  spacing: {
    picture: 'element', label: '간격', unit: 'px', custom: 'px',
    tokens: () => pxSteps(SPACE_TOKENS),
    key: numberKey,
    values: (conflict, text) => { const size = numberOf(text); return size != null && size >= 0 ? { ...conflict.preview?.after, gap: `${size}px` } : null },
  },
  // A size: drawn in proportion to the design's (a sample is drawn smaller
  // than the product). Its scale is the size tokens around the two values.
  size: {
    picture: 'element', label: '크기', unit: 'px', custom: 'px',
    tokens: (conflict) => {
      const own = [numberOf(conflict?.designSpec), numberOf(conflict?.builtSpec)].filter((value) => value > 0)
      const [low, high] = own.length ? [Math.min(...own) / 2, Math.max(...own) * 1.5] : [0, Infinity]
      return pxSteps(SIZE_TOKENS.filter(({ px }) => px >= low && px <= high))
    },
    key: numberKey,
    values: (conflict, text) => {
      const size = numberOf(text)
      const after = conflict.preview?.after ?? {}
      const design = numberOf(conflict.designSpec) ?? after.px ?? after.size ?? after.height
      if (!(size > 0) || !(design > 0)) return null
      const scaled = (value) => (Number.isFinite(value) ? (value * size) / design : value)
      return { ...after, ...(after.size != null && { size: scaled(after.size) }), ...(after.height != null && after.size == null && { height: scaled(after.height) }), px: size }
    },
  },
  color: {
    picture: 'element', label: '색상', unit: '', custom: 'hex',
    tokens: (conflict) => [...COLOR_TOKENS.map(({ token, hex }) => ({ token, text: `${token} (${hex})` })), ...(conflict?.tokens ?? []).map((text) => ({ token: /^[\w.]+(?= \()/.exec(text)?.[0] ?? null, text }))],
    key: (text) => hexOf(text)?.toLowerCase() ?? null,
    values: (conflict, text) => { const hex = hexOf(text); return hex ? { ...conflict.preview?.after, background: hex, color: hex } : null },
  },
  weight: {
    picture: 'element', label: '폰트 굵기', unit: '', custom: null,
    tokens: () => WEIGHT_TOKENS.map(({ token, weight }) => ({ token, text: String(weight) })),
    key: (text) => { const weight = Number.parseInt(text, 10); return weight >= 100 && weight <= 900 ? String(weight) : null },
    values: (conflict, text) => { const weight = Number.parseInt(text, 10); return weight >= 100 && weight <= 900 ? { ...conflict.preview?.after, fontWeight: weight } : null },
  },
  // Any other value (a letter-spacing, a stroke, a rule): the design's or the
  // code's — or typed, and drawn when it reads as one.
  text: {
    picture: 'element', label: '값', unit: '', custom: 'text',
    tokens: () => [],
    key: (text) => String(text ?? '').trim().toLowerCase() || null,
    values: (conflict, text) => {
      const value = String(text ?? '').trim()
      const { before = {}, after = {} } = conflict.preview ?? {}
      if ('letterSpacing' in after || 'letterSpacing' in before) return /^(normal|-?\d*\.?\d+(em|px|rem))\b/.test(value) ? { ...after, letterSpacing: value.split(/\s/)[0] } : null
      if (after.stroke != null && before.stroke !== after.stroke) { const stroke = numberOf(value); return stroke > 0 ? { ...after, stroke } : null }
      return null
    },
  },
}

// What kind of change a conflict is: said by the seed (`changeType`), else
// read from what it compares.
/** @returns {ChangeType} */
export function typeOf(conflict) {
  if (conflict?.layouts) return 'layout'
  if (conflict?.changeType) return conflict.changeType
  const { kind, before = {}, after = {} } = conflict?.preview ?? {}
  const differs = (key) => before[key] !== after[key] && (before[key] != null || after[key] != null)
  if (differs('collapseAt')) return 'breakpoint'
  if (kind === 'spacing') return 'spacing'
  if (kind === 'text') return differs('fontWeight') ? 'weight' : 'text'
  if (kind === 'button') return differs('background') ? 'color' : differs('height') || differs('width') ? 'size' : 'text'
  if (kind === 'icon') return differs('size') ? 'size' : 'text'
  if (kind === 'divider' || kind === 'swatch') return 'color'
  return 'text'
}

/** @returns {ChangeAdapter} */
export function adapterOf(conflict) {
  const type = typeOf(conflict)
  const adapter = ADAPTERS[type]
  if (!adapter) throw new Error(`No change adapter for "${type}" (${conflict?.id ?? 'unknown change'}) — add one to lib/changeAdapters.js`)
  return adapter
}

// A conflict's scale, ready to draw: its kind's steps with the design's and
// the code's own values among them (put in where they belong when they're
// not on the scale), each said the same way. Null for a kind with no scale.
//   out: { label, unit, custom, steps: ScaleStep[], designKey, currentKey }
export function scaleOf(conflict) {
  const adapter = adapterOf(conflict)
  const tokens = adapter.tokens(conflict)
  if (!tokens) return null
  const designKey = adapter.key(conflict?.designSpec)
  const currentKey = adapter.key(conflict?.builtSpec)
  const step = ({ token, text }) => ({ key: adapter.key(text), value: text, label: adapter.unit ? String(numberOf(text)) : hexOf(text) ?? String(text).replace(/\s*\(.*\)\s*$/, ''), token: token ?? null, swatch: hexOf(text) })
  const steps = []
  for (const entry of tokens.map(step)) if (entry.key && !steps.some((taken) => taken.key === entry.key)) steps.push(entry)
  // (The design's and the code's own values are always there to pick.)
  for (const [key, text] of [[designKey, conflict?.designSpec], [currentKey, conflict?.builtSpec]]) {
    if (key && !steps.some((taken) => taken.key === key)) steps.push(step({ token: null, text: String(text) }))
  }
  const numeric = steps.every((entry) => Number.isFinite(Number(entry.key)))
  if (numeric) steps.sort((a, b) => Number(a.key) - Number(b.key))
  // (A palette starts with the two it's about.)
  else steps.sort((a, b) => [designKey, currentKey].includes(b.key) - [designKey, currentKey].includes(a.key))
  return { label: adapter.label, unit: adapter.unit, custom: adapter.custom, steps, designKey, currentKey }
}
// A typed value as the scale keeps it ("18" → "18px"), and whether it's one of the tokens.
export function customValueOf(conflict, text) {
  const adapter = adapterOf(conflict)
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const value = adapter.custom === 'px' ? (numberOf(raw) != null && numberOf(raw) >= 0 ? `${numberOf(raw)}px` : null) : adapter.custom === 'hex' ? hexOf(raw.startsWith('#') ? raw : `#${raw}`) : raw
  if (!value) return null
  const key = adapter.key(value)
  const onScale = (adapter.tokens(conflict) ?? []).some((entry) => entry.token && adapter.key(entry.text) === key)
  return { value, key, onScale }
}
// Which way forward a step of the scale is: the design's value is 원안대로
// 맞추기, the code's is 현재 값 유지 — any other is 다른 값's.
export const wayOfStep = (scale, step) => (step.key === scale.designKey ? 'original' : step.key === scale.currentKey ? 'current' : 'other')
