import { canvasPages } from '@/data/mockData'
import { ASSEMBLY_FILLS, SHAPES } from '@/components/mergestudio/mergeEffects'
import { changedTokens } from '@/lib/lineDiff'

// What a conflict merges with: the picked side's own values with whatever
// was set by hand in Merge Studio laid over them. One object, built once —
// the review's value rows, its picture and its code are all read from it,
// so they can't disagree (each used to read the original on its own, and a
// hand-set value reached only the ones that knew that property).
//
//   rows    — the compared values: { label, base, to } (`to` when set by
//             hand to something other than the side's own value)
//   extras  — hand-set values the comparison doesn't list
//   preview — the side's `preview` spec with those values in it
//   lines   — the side's code with those values written in
//
// A hand-set value is compared with the side it lands on, not with the
// canvas layer: 40px set on a side that is already 40px is no change.

const layerOf = (item, id) => canvasPages.find((page) => page.id === item?.designPageId)?.frames[0]?.layers?.find((layer) => layer.id === id) ?? null
// The numbers a value is written with ("44px (button.height.lg)" → [44]).
const numbersIn = (text) => (String(text ?? '').split('(')[0].match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
const sizeText = (width, height) => `${width} × ${height}px`

// Which hand-set property a compared value is, from its label.
const PROPERTIES = [['size', /touch area|size/i], ['height', /height/i], ['width', /width/i], ['radius', /radius|corner/i], ['fill', /background|fill|colou?r/i]]
const propertyOf = (label) => PROPERTIES.find(([, pattern]) => pattern.test(label))?.[0] ?? null

// A fill set in Merge Studio is a named one (`fill: 'amber'`) — resolved
// here to its token, the color to draw and the class the code gets. (A
// literal color is used as written.)
const GRADIENT = 'linear-gradient(to right, #6366f1, #8b5cf6)'
function fillOf(assembly) {
  const literal = [assembly.fillColor, assembly.fill].find((value) => typeof value === 'string' && /^(#|rgb|hsl|oklch)/.test(value))
  if (literal) return { text: literal, css: literal, swatch: literal, className: `bg-[${literal}]` }
  const named = ASSEMBLY_FILLS.find((fill) => fill.id === assembly.fill)
  if (!named) return null
  return {
    text: named.token,
    css: named.id === 'gradient' ? GRADIENT : named.id === 'ghost' ? 'transparent' : named.hex,
    swatch: named.id === 'gradient' ? GRADIENT : named.hex,
    className: named.className,
  }
}

// One class on the element's line: in place of the one it has, else added.
const CLASS = {
  width: /(?<![\w-])w-(?:\[[^\]]+\]|[\d.]+|full)(?=[\s"'`])/,
  height: /(?<![\w-])h-(?:\[[^\]]+\]|[\d.]+)(?=[\s"'`])/,
  size: /(?<![\w-])size-(?:\[[^\]]+\]|[\d.]+)(?=[\s"'`])/,
  radius: /(?<![\w-])rounded(?:-(?:\[[^\]]+\]|none|sm|md|lg|xl|2xl|3xl|full))?(?=[\s"'`])/,
  fill: /(?<![\w-])bg-(?:\[[^\]]+\]|[a-z]+-\d{2,3}|primary|card|transparent)(?=[\s"'`])/,
}
// (`focus`: the classes the two sides differ by — on a line with several of
// a kind, `sm: 'h-7 …', md: 'h-9 …'`, that's the one to replace.)
function putClass(lines, pattern, className, focus = []) {
  const own = focus.find((token) => pattern.test(`${token} `) && lines.some((line) => line.includes(token)))
  if (own) {
    const at = lines.findIndex((line) => line.includes(own))
    return lines.map((line, index) => (index === at ? line.replace(own, className) : line))
  }
  const at = lines.findIndex((line) => pattern.test(line))
  if (at >= 0) return lines.map((line, index) => (index === at ? line.replace(pattern, className) : line))
  const host = lines.findIndex((line) => /className="[^"]*"/.test(line))
  if (host < 0) return lines
  return lines.map((line, index) => (index === host ? line.replace(/className="([^"]*)"/, (_, classes) => `className="${`${classes} ${className}`.trim()}"`) : line))
}

// The tokens a single compared height can be set to without leaving the
// review (the third card's dropdown): the button heights, for a conflict
// that is only about a button's height. Null: it's set in Merge Studio.
const BUTTON_HEIGHTS = [
  { token: '--button-height-sm', px: 32 },
  { token: '--button-height-md', px: 40 },
  { token: '--button-height-lg', px: 44 },
]
export function heightTokensFor(conflict) {
  const fields = conflict?.comparisonFields ?? []
  if (!conflict?.layerId || fields.length !== 1 || propertyOf(fields[0].label) !== 'height') return null
  return /button/i.test(`${fields[0].label} ${conflict.token ?? ''}`) ? BUTTON_HEIGHTS : null
}

// What two versions of the code differ by, as the values themselves
// ("h-9" → "h-10") — a card's one-line code result.
export function codeChangeOf(before = [], after = []) {
  const [left, right] = changedTokens(before.join('\n'), after.join('\n'))
  const text = (runs) => runs.filter((run) => run.changed).map((run) => run.text.trim()).filter(Boolean).join(' ')
  return { from: text(left), to: text(right) }
}

// `side`: the side that merges ('A' the design reference, 'B' the current
// implementation). `assembly`: what was set by hand on the conflict's own
// element. `adjustments`: everything set by hand on the item (lib/
// sizeAdjustment's studioAdjustmentsOf), for the values this can't place.
export function mergeResultOf(conflict, item, side, { assembly = null, adjustments = [] } = {}) {
  if (!conflict) return null
  const which = side === 'A' ? 'after' : 'before'
  const layer = layerOf(item, conflict.layerId)
  const set = layer && assembly ? assembly : {}
  const fields = conflict.comparisonFields ?? []
  const fill = fillOf(set)
  const radius = set.radius ?? SHAPES.find((shape) => shape.id === set.shape)?.radius ?? null
  const width = set.width ?? null
  const height = set.height ?? null
  // A compared size is this element's only when one of its sides is the
  // element's own size (an icon's 20px isn't its 280px tab bar's).
  const isLayers = (field, ...dims) => [field.current, field.expected].some((value) => dims.every((dim) => numbersIn(value).includes(layer[dim])))

  const placed = new Set()
  const changed = {}
  const rows = fields.map((field) => {
    const base = side === 'A' ? field.expected : field.current
    const property = propertyOf(field.label)
    const numbers = numbersIn(base)
    let to = null
    if (property === 'height' && height != null && (set.heightToken || isLayers(field, 'height'))) {
      placed.add('height')
      // (Set to a token: the value, then the token it comes from.)
      if (set.heightToken ? !String(base).includes(set.heightToken) : numbers[0] !== height) to = set.heightToken ? `${height}px (${set.heightToken})` : `${height}px`
    } else if (property === 'width' && width != null && isLayers(field, 'width')) {
      placed.add('width')
      if (numbers[0] !== width) to = `${width}px`
    } else if (property === 'size' && (width != null || height != null) && isLayers(field, 'width')) {
      placed.add('width').add('height')
      const w = width ?? layer.width
      const h = height ?? layer.height
      // Written the way the value is: "24px" for a square, else "24 × 28px".
      const same = numbers.length >= 2 ? numbers[0] === w && numbers[1] === h : numbers[0] === w && w === h
      if (!same) to = numbers.length < 2 && w === h ? `${w}px` : sizeText(w, h)
      if (!same) changed.width = changed.height = true
    } else if (property === 'radius' && radius != null) {
      placed.add('radius')
      if (numbers[0] !== radius) to = `${radius}px`
    } else if (property === 'fill' && fill) {
      placed.add('fill')
      if (!String(base).toLowerCase().includes(fill.text.toLowerCase())) to = fill.text
    }
    if (to && property !== 'size') changed[property] = true
    return { label: field.label, base, to, swatch: to && property === 'fill' ? fill.swatch : null, same: field.current === field.expected }
  })

  // Set by hand, but not one of the compared values: a row of its own.
  const extras = []
  const widthSet = width != null && !placed.has('width') && width !== layer.width
  const heightSet = height != null && !placed.has('height') && height !== layer.height
  if (widthSet && heightSet) extras.push({ label: 'Size', from: sizeText(layer.width, layer.height), to: sizeText(width, height) })
  else if (widthSet) extras.push({ label: 'Width', from: `${layer.width}px`, to: `${width}px` })
  else if (heightSet) extras.push({ label: 'Height', from: `${layer.height}px`, to: `${height}px` })
  if (widthSet) changed.width = true
  if (heightSet) changed.height = true
  if (radius != null && !placed.has('radius')) { extras.push({ label: 'Corner radius', from: null, to: `${radius}px` }); changed.radius = true }
  if (fill && !placed.has('fill')) { extras.push({ label: 'Fill', from: null, to: fill.text, swatch: fill.swatch }); changed.fill = true }
  // Everything else (position, opacity, another element…), as it's listed.
  const RESOLVED = ['Size', 'Corner radius', 'Fill', 'Shape']
  for (const entry of adjustments) {
    const own = entry.layerId === conflict.layerId && Boolean(layer && assembly)
    for (const change of entry.changes) {
      if (own && RESOLVED.includes(change.label)) continue
      extras.push({ ...change, layerName: own ? null : entry.layerName })
    }
  }

  // The picture: the side's spec with the hand-set values. A size is taken
  // as set when the spec is the element's own size, in proportion otherwise.
  const spec = conflict.preview?.[which] ?? null
  const sized = (key, dim) => {
    if (set[dim] == null || !layer[dim]) return spec[key]
    const own = [conflict.preview.before?.[key], conflict.preview.after?.[key]].includes(layer[dim])
    return own ? set[dim] : Math.round((spec[key] * set[dim] / layer[dim]) * 10) / 10
  }
  const preview = spec && layer ? {
    ...spec,
    ...('height' in spec ? { height: sized('height', 'height') } : {}),
    ...('size' in spec ? { size: width != null ? sized('size', 'width') : sized('size', 'height') } : {}),
    ...(radius != null && ['button', 'card'].includes(conflict.preview.kind) ? { radius } : {}),
    ...(fill && 'background' in spec ? { background: fill.css } : {}),
    ...(fill && 'color' in spec ? { color: fill.css } : {}),
  } : spec

  // The code: the side's lines with each changed value's class.
  let lines = [...((side === 'A' ? conflict.diff?.after : conflict.diff?.before) ?? [])]
  const differ = changedTokens((conflict.diff?.before ?? []).join('\n'), (conflict.diff?.after ?? []).join('\n'))[side === 'A' ? 1 : 0]
  const focus = differ.filter((run) => run.changed).flatMap((run) => run.text.split(/[\s"'`]+/)).filter(Boolean)
  const w = width ?? layer?.width
  const h = height ?? layer?.height
  if ((changed.width || changed.height) && w === h && lines.some((line) => CLASS.size.test(line))) {
    lines = putClass(lines, CLASS.size, w % 4 === 0 ? `size-${w / 4}` : `size-[${w}px]`)
  } else {
    if (changed.width) lines = putClass(lines, CLASS.width, `w-[${w}px]`, focus)
    if (changed.height) lines = putClass(lines, CLASS.height, set.heightToken ? `h-[var(${set.heightToken})]` : `h-[${h}px]`, focus)
  }
  if (changed.radius) lines = putClass(lines, CLASS.radius, `rounded-[${radius}px]`, focus)
  if (changed.fill) lines = putClass(lines, CLASS.fill, fill.className, focus)

  return { side, rows, extras, preview, lines, adjusted: rows.some((row) => row.to) || extras.length > 0 }
}
