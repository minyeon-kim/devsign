// The kinds of change a 변경 확인 can be — and, for each, the only two things
// that differ on the shared 해결 방법 card (DesignDecisionFlow's
// ProposalSection): what's put into the picture, and how another value is
// entered. Everything else on the card is the same for every kind.
//
// A new kind is added here: to CHANGE_TYPES, to ADAPTERS and to typeOf. A
// kind with no adapter doesn't draw a card at all — adapterOf throws, and
// tests/change-adapters.mjs fails for it and for any seeded change whose
// kind isn't one of these.

/**
 * @typedef {'layout' | 'breakpoint' | 'spacing' | 'size' | 'color' | 'weight' | 'text'} ChangeType
 *
 * @typedef {object} ChangeAdapter
 * @property {'screen' | 'element'} picture   what's compared: whole screens (CON-002's way), or the element
 * @property {'layout' | 'px' | 'token' | 'weight' | 'text'} input   how 다른 값 is entered
 * @property {string} inputLabel
 * @property {(conflict: object) => string[]} options   values to pick from ([]: none)
 * @property {(conflict: object, text: string) => object | null} values   a typed value as what the picture is drawn with (null: can't be drawn)
 * @property {(text: string) => string | null} measure   the dimension a value stands for ("16px"), shown beside it
 * @property {(text: string) => string | null} swatch   the colour a value stands for, shown as a chip
 */

/** @type {ChangeType[]} */
export const CHANGE_TYPES = ['layout', 'breakpoint', 'spacing', 'size', 'color', 'weight', 'text']

const numberOf = (text) => { const found = /-?\d+(\.\d+)?/.exec(String(text ?? '')); return found ? Number(found[0]) : null }
const hexOf = (text) => /#[0-9a-fA-F]{3,8}\b/.exec(String(text ?? ''))?.[0] ?? null
const pxOf = (text) => { const value = numberOf(text); return value != null && value >= 0 ? `${value}px` : null }
const none = () => null
// The design's and the code's own values first, then what else the scale has — no value twice.
const withOwn = (conflict, scale) => {
  const own = [conflict?.designSpec, conflict?.builtSpec].filter(Boolean)
  const taken = new Set(own.map((value) => numberOf(value) ?? value))
  return [...own, ...scale.filter((value) => !taken.has(numberOf(value) ?? value))]
}

/** @type {Record<ChangeType, ChangeAdapter>} */
export const ADAPTERS = {
  // A structure: compared as whole screens; another way is laid out with the
  // layout controls (columns, card width) — not a value.
  layout: { picture: 'screen', input: 'layout', inputLabel: '레이아웃', options: () => [], values: none, measure: none, swatch: none },
  // Where a layout changes: compared as screens at a width between the two.
  breakpoint: {
    picture: 'screen', input: 'px', inputLabel: '기준 폭',
    options: (conflict) => withOwn(conflict, ['768px', '900px', '1024px']),
    values: (conflict, text) => { const at = numberOf(text); return at > 0 ? { ...conflict.preview?.after, collapseAt: at } : null },
    measure: pxOf, swatch: none,
  },
  spacing: {
    picture: 'element', input: 'px', inputLabel: '간격',
    options: (conflict) => withOwn(conflict, ['4px', '8px (space.2)', '12px (space.3)', '16px (space.4)', '20px (space.5)', '24px (space.6)']),
    values: (conflict, text) => { const size = numberOf(text); return size != null && size >= 0 ? { ...conflict.preview?.after, gap: `${size}px` } : null },
    measure: pxOf, swatch: none,
  },
  // A size: drawn in proportion to the design's (a sample is drawn smaller than the product).
  size: {
    picture: 'element', input: 'px', inputLabel: '크기',
    options: (conflict) => withOwn(conflict, []),
    values: (conflict, text) => {
      const size = numberOf(text)
      const after = conflict.preview?.after ?? {}
      const design = numberOf(conflict.designSpec) ?? after.px ?? after.size ?? after.height
      if (!(size > 0) || !(design > 0)) return null
      const scaled = (value) => (Number.isFinite(value) ? (value * size) / design : value)
      return { ...after, ...(after.size != null && { size: scaled(after.size) }), ...(after.height != null && after.size == null && { height: scaled(after.height) }), px: size }
    },
    measure: pxOf, swatch: none,
  },
  color: {
    picture: 'element', input: 'token', inputLabel: '색상',
    options: (conflict) => withOwn(conflict, conflict?.tokens ?? []),
    values: (conflict, text) => { const hex = hexOf(text); return hex ? { ...conflict.preview?.after, background: hex, color: hex } : null },
    measure: none, swatch: hexOf,
  },
  weight: {
    picture: 'element', input: 'weight', inputLabel: '폰트 굵기',
    options: () => ['400', '500', '600', '700', '800'],
    values: (conflict, text) => { const weight = Number.parseInt(text, 10); return weight >= 100 && weight <= 900 ? { ...conflict.preview?.after, fontWeight: weight } : null },
    measure: none, swatch: none,
  },
  // Any other value (a letter-spacing, a stroke, a rule): the design's or the code's, or typed — drawn when it reads as one.
  text: {
    picture: 'element', input: 'text', inputLabel: '값',
    options: (conflict) => withOwn(conflict, []),
    values: (conflict, text) => {
      const value = String(text ?? '').trim()
      const { before = {}, after = {} } = conflict.preview ?? {}
      if ('letterSpacing' in after || 'letterSpacing' in before) return /^(normal|-?\d*\.?\d+(em|px|rem))\b/.test(value) ? { ...after, letterSpacing: value.split(/\s/)[0] } : null
      if (after.stroke != null && before.stroke !== after.stroke) { const stroke = numberOf(value); return stroke > 0 ? { ...after, stroke } : null }
      return null
    },
    measure: none, swatch: none,
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
