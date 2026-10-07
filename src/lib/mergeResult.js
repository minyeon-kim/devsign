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

// The numbers of a conflict that can be set without leaving the review (the
// third card's steppers): each compared height, width, size (touch area) or
// corner radius of the conflict's own element, one control a value. A value
// a number can't say (a color, a shadow, a gradient) has none — that, and
// anything beyond the compared values, is set in Merge Studio.
//   { index, property, label, current, standard, tokens: [{ name, px }],
//     min, max, assemblyFor(px), valueOf(assembly) }
const BUTTON_HEIGHTS = [
  { name: '--button-height-sm', px: 32 },
  { name: '--button-height-md', px: 40 },
  { name: '--button-height-lg', px: 44 },
]
const RADII = [{ name: 'rounded-md', px: 6 }, { name: 'rounded-lg', px: 8 }, { name: 'rounded-xl', px: 12 }, { name: 'rounded-2xl', px: 16 }]
const SIZES = [{ name: 'size-4', px: 16 }, { name: 'size-5', px: 20 }, { name: 'size-6', px: 24 }]
const RANGES = { radius: [0, 64], height: [16, 96], width: [16, 640], size: [8, 96] }
function controlFor(conflict, layer, field) {
  const property = propertyOf(field.label)
  if (!RANGES[property]) return null
  const current = numbersIn(field.current)
  const standard = numbersIn(field.expected)
  if (!current.length || !standard.length || !/px/.test(`${field.current}${field.expected}`)) return null
  // A size is one number here only when it's a square on both sides.
  if (property === 'size' && [current, standard].some((numbers) => numbers.length > 1 && numbers[0] !== numbers[1])) return null
  // …and a dimension only when it's this element's own.
  const own = (dim) => [current[0], standard[0]].includes(layer[dim])
  if ((property === 'height' && !own('height')) || ((property === 'width' || property === 'size') && !own('width'))) return null
  const buttonHeight = property === 'height' && /button/i.test(`${field.label} ${conflict.token ?? ''}`)
  const [min, max] = RANGES[property]
  return {
    property, label: field.label, current: current[0], standard: standard[0], min, max,
    tokens: property === 'radius' ? RADII : buttonHeight ? BUTTON_HEIGHTS : property === 'size' ? SIZES : [],
    // What setting it to `px` puts on the element (as Merge Studio would).
    assemblyFor: (px) => (property === 'radius' ? { radius: px }
      : property === 'size' ? { width: px, height: px }
        : property === 'width' ? { width: px }
          : { height: px, heightToken: buttonHeight ? BUTTON_HEIGHTS.find((token) => token.px === px)?.name : undefined }),
    valueOf: (assembly) => (!assembly ? null : property === 'radius' ? assembly.radius ?? null : property === 'height' ? assembly.height ?? null : assembly.width ?? null),
  }
}

// One entry a compared value (null where it has no control).
export function valueControlsFor(conflict, item) {
  const layer = layerOf(item, conflict?.layerId)
  if (!layer) return []
  return (conflict?.comparisonFields ?? []).map((field, index) => {
    const control = controlFor(conflict, layer, field)
    return control ? { ...control, index } : null
  })
}

// ─── Every other compared value, set in the code ───────────────────────
// A value that isn't one of the element's own numbers (an icon's size in a
// tab bar, a gap, a stroke, letter spacing, a color) is set by writing it
// into the conflict's code lines — the code is what merges, and Merge
// Studio's code view edits the same lines (its `manualCode`). Each kind
// knows the one token in the line that says it: how to write a value as
// that token and how to read the token back. A value that is exactly one
// side's is written the way that side writes it (its token, or none).
const scaleToken = (prefix) => (value) => {
  const px = numbersIn(value)[0]
  if (px == null) return null
  return px % 2 === 0 ? `${prefix}-${px / 4}` : `${prefix}-[${px}px]`
}
const scaleValue = (prefix) => (token) => {
  const match = new RegExp(`^${prefix}-(?:\\[([\\d.]+)px\\]|([\\d.]+))$`).exec(token)
  return match ? `${match[1] ?? Number(match[2]) * 4}px` : null
}
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i
const TRACKING = [['tighter', '-0.05em'], ['tight', '-0.025em'], ['normal', '0em'], ['wide', '0.025em'], ['wider', '0.05em'], ['widest', '0.1em']]
const em = (value) => /(-?[\d.]+)em/.exec(String(value))?.[1]
export const FIELD_KINDS = [
  { id: 'radius', test: /radius|corner/i, type: 'number', unit: 'px', min: 0, max: 64, step: 1, preview: 'radius', pattern: CLASS.radius,
    toCode: (value) => { const px = numbersIn(value)[0]; return px == null ? null : RADII.find((token) => token.px === px)?.name ?? `rounded-[${px}px]` },
    fromCode: (token) => (/\[([\d.]+)px\]/.exec(token)?.[1] ?? RADII.find((entry) => entry.name === token)?.px) != null ? `${/\[([\d.]+)px\]/.exec(token)?.[1] ?? RADII.find((entry) => entry.name === token)?.px}px` : null },
  { id: 'iconSize', test: /icon size|^size$/i, type: 'number', unit: 'px', min: 8, max: 96, step: 1, preview: 'size', pattern: CLASS.size, toCode: scaleToken('size'), fromCode: scaleValue('size') },
  { id: 'gap', test: /gap|spacing/i, type: 'number', unit: 'px', min: 0, max: 64, step: 1, preview: 'gap', pattern: /(?<![\w-])gap-(?:\[[^\]]+\]|[\d.]+)(?=[\s"'`])/, toCode: scaleToken('gap'), fromCode: scaleValue('gap') },
  { id: 'height', test: /height/i, type: 'number', unit: 'px', min: 16, max: 96, step: 1, preview: 'height', pattern: CLASS.height, toCode: (value) => (numbersIn(value)[0] == null ? null : `h-[${numbersIn(value)[0]}px]`), fromCode: scaleValue('h') },
  { id: 'width', test: /width/i, type: 'number', unit: 'px', min: 16, max: 640, step: 1, preview: 'width', pattern: CLASS.width, toCode: (value) => (numbersIn(value)[0] == null ? null : `w-[${numbersIn(value)[0]}px]`), fromCode: scaleValue('w') },
  // (An attribute, not a class: written before the tag's end. Lucide's
  // default is 2 — no attribute reads as that.)
  { id: 'stroke', test: /stroke/i, type: 'number', unit: '', min: 0.5, max: 4, step: 0.25, preview: 'stroke', attribute: true, empty: '2', pattern: /\s+strokeWidth=\{[\d.]+\}/,
    toCode: (value) => { const n = numbersIn(value)[0]; return n == null ? null : n === 2 ? '' : `strokeWidth={${n}}` },
    fromCode: (token) => /\{([\d.]+)\}/.exec(token)?.[1] ?? null },
  { id: 'tracking', test: /tracking|letter/i, type: 'choice', preview: 'letterSpacing', empty: 'normal', pattern: /(?<![\w-])tracking-(?:\[[^\]]+\]|tighter|tight|normal|wide|wider|widest)(?=[\s"'`])/,
    options: TRACKING.map(([name, value]) => (name === 'normal' ? 'normal' : `${value} (tracking-${name})`)),
    toCode: (value) => {
      if (/^normal$/i.test(String(value).trim())) return ''
      const named = /tracking-(\w+)/.exec(value)?.[1] ?? TRACKING.find(([, amount]) => amount === `${em(value)}em`)?.[0]
      return named ? (named === 'normal' ? '' : `tracking-${named}`) : em(value) != null ? `tracking-[${em(value)}em]` : null
    },
    fromCode: (token) => { const name = token.slice('tracking-'.length); const amount = TRACKING.find(([n]) => n === name)?.[1] ?? /\[([^\]]+)\]/.exec(token)?.[1]; return name === 'normal' ? 'normal' : amount ? `${amount} (${token})` : null },
    previewValue: (value) => (/^normal$/i.test(String(value).trim()) ? 'normal' : `${em(value) ?? 0}em`) },
  { id: 'border', test: /divider|border/i, type: 'color', preview: 'divider', pattern: /(?<![\w-])border-(?:\[#[^\]]+\]|[a-z]+-\d{2,3}|border)(?=[\s"'`])/,
    toCode: (value) => (HEX.exec(value) ? `border-[${HEX.exec(value)[0]}]` : /^[a-z]+-\d{2,3}$/.test(String(value).trim()) ? `border-${String(value).trim()}` : null),
    fromCode: (token) => /\[(#[^\]]+)\]/.exec(token)?.[1] ?? (token === 'border-border' ? 'border (token)' : token.slice('border-'.length)) },
  { id: 'fill', test: /background|fill|colou?r/i, type: 'color', preview: 'background', pattern: CLASS.fill,
    toCode: (value) => (HEX.exec(value) ? `bg-[${HEX.exec(value)[0]}]` : null),
    fromCode: (token) => /\[(#[^\]]+)\]/.exec(token)?.[1] ?? token.slice('bg-'.length) },
]
// Anything else (a hit area the line doesn't spell, a prop's wording) is
// still set — as text, kept on the conflict — but has no token to write.
const TEXT_KIND = { id: 'text', type: 'text' }
export const fieldKindOf = (field) => FIELD_KINDS.find((kind) => kind.test.test(field?.label ?? '')) ?? TEXT_KIND

const tokenIn = (lines, kind) => ((lines ?? []).join('\n').match(kind.pattern)?.[0] ?? '').trim()

// What a compared value reads as in `lines` (the side's own wording when
// the token is that side's), or null when the kind can't tell.
export function readFieldValue(conflict, lines, field) {
  const kind = fieldKindOf(field)
  if (!kind.pattern || !lines) return null
  const token = tokenIn(lines, kind)
  if (token === tokenIn(conflict.diff?.before, kind)) return field.current
  if (token === tokenIn(conflict.diff?.after, kind)) return field.expected
  return token ? kind.fromCode(token) ?? token : kind.empty ?? null
}

// `lines` with a compared value written in (unchanged when the kind can't
// write it).
export function writeFieldValue(conflict, lines, field, value) {
  const kind = fieldKindOf(field)
  if (!kind.pattern) return lines
  const sideLines = value === field.expected ? conflict.diff?.after : value === field.current ? conflict.diff?.before : null
  const token = sideLines ? tokenIn(sideLines, kind) : kind.toCode(value)
  if (token == null) return lines
  const tidy = (line) => line.replace(/className="([^"]*)"/, (_, classes) => `className="${classes.replace(/\s+/g, ' ').trim()}"`)
  const at = lines.findIndex((line) => kind.pattern.test(line))
  if (at >= 0) return lines.map((line, index) => (index === at ? tidy(line.replace(kind.pattern, kind.attribute ? (token ? ` ${token}` : '') : token)) : line))
  if (!token) return lines
  if (kind.attribute) {
    const host = lines.findIndex((line) => /\s*\/?>\s*$/.test(line))
    return host < 0 ? lines : lines.map((line, index) => (index === host ? line.replace(/\s*(\/?>)\s*$/, ` ${token} $1`) : line))
  }
  return putClass(lines, kind.pattern, token)
}

// The written-in value as the preview draws it (null: leave the side's).
function previewValueOf(conflict, field, value) {
  const kind = fieldKindOf(field)
  if (!kind.preview || value == null) return null
  if (kind.preview === 'divider') return value === field.expected ? { themeSide: 'after' } : HEX.exec(value) ? { color: HEX.exec(value)[0] } : null
  const side = value === field.expected ? conflict.preview?.after : value === field.current ? conflict.preview?.before : null
  if (side && kind.preview in side) return side[kind.preview]
  if (kind.previewValue) return kind.previewValue(value)
  if (kind.type === 'color') return HEX.exec(value)?.[0] ?? null
  return numbersIn(value)[0] ?? null
}

// Every compared value's editor on the third card: the element's own
// numbers as before (`valueControlsFor`, set on the element), and every
// other value by its kind (set in the code).
//   { index, mode: 'layer' | 'code' | 'text', type, unit, min, max, step,
//     options, label, current, standard }
export function fieldControlsFor(conflict, item) {
  const own = item ? valueControlsFor(conflict, item) : []
  return (conflict?.comparisonFields ?? []).map((field, index) => {
    if (own[index]) return { ...own[index], mode: 'layer', type: 'number', unit: 'px', step: 1 }
    const kind = fieldKindOf(field)
    const writable = Boolean(kind.pattern && conflict.diff)
    return {
      index,
      mode: writable ? 'code' : 'text',
      kind: kind.id,
      type: writable ? kind.type : 'text',
      unit: kind.unit ?? '',
      min: kind.min ?? 0,
      max: kind.max ?? 9999,
      step: kind.step ?? 1,
      label: field.label,
      current: field.current,
      standard: field.expected,
      options: [...new Set([field.current, field.expected, ...(kind.options ?? [])])],
    }
  })
}

// The conflict's lines as written by hand (Merge Studio's code view, or the
// third card writing a value), keyed `fileId:line` — null when none is.
// Indented as the conflict's own lines are, so only what was changed differs.
export function handLinesOf(conflict, manualCode) {
  const before = conflict?.diff?.before
  if (!before?.length || !conflict.fileId || !manualCode) return null
  const keys = before.map((_, index) => `${conflict.fileId}:${(conflict.line ?? 1) + index}`)
  if (!keys.some((key) => manualCode[key] != null)) return null
  return before.map((line, index) => {
    const text = manualCode[keys[index]]
    return text == null ? line : `${/^\s*/.exec(line)[0]}${text.trimStart()}`
  })
}

// `manualCode` with the conflict's lines set to `lines` (a line that's back
// to the conflict's own is dropped). `fileLines`: the file, for its indent.
export function withHandLines(conflict, manualCode = {}, lines, fileLines = []) {
  const before = conflict.diff?.before ?? []
  const next = { ...manualCode }
  before.forEach((line, index) => {
    const number = (conflict.line ?? 1) + index
    const key = `${conflict.fileId}:${number}`
    const text = lines?.[index]
    if (text == null || text.trim() === line.trim()) delete next[key]
    else next[key] = `${/^\s*/.exec(fileLines[number - 1] ?? line)[0]}${text.trimStart()}`
  })
  return next
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
// `handLines`: the conflict's lines as written by hand (see handLinesOf) —
// they stand in for the side's. `handValues`: values set as text for what
// the code doesn't spell ({ [label]: text }).
export function mergeResultOf(conflict, item, side, { assembly = null, adjustments = [], handLines = null, handValues = null } = {}) {
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
    let written = false
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
    } else {
      // Not set on the element: what the hand-written code says, else the
      // text it was set to.
      const hand = handLines && fieldKindOf(field).pattern ? readFieldValue(conflict, handLines, field) : handValues?.[field.label] ?? null
      if (hand != null && hand !== base) { to = hand; written = true }
    }
    if (to && property !== 'size' && !written) changed[property] = true
    const swatch = !to ? null : property === 'fill' && !written ? fill.swatch : HEX.exec(to)?.[0] ?? null
    return { label: field.label, base, to, swatch, written, same: field.current === field.expected }
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
    ...('width' in spec ? { width: sized('width', 'width') } : {}),
    ...('height' in spec ? { height: sized('height', 'height') } : {}),
    ...('size' in spec ? { size: width != null ? sized('size', 'width') : sized('size', 'height') } : {}),
    ...(radius != null && ['button', 'card'].includes(conflict.preview.kind) ? { radius } : {}),
    ...(fill && 'background' in spec ? { background: fill.css } : {}),
    ...(fill && 'color' in spec ? { color: fill.css } : {}),
  } : spec
  // …and the values written in the code (or set as text) drawn too.
  let drawn = preview
  rows.forEach((row, index) => {
    if (!row.written) return
    const value = previewValueOf(conflict, fields[index], row.to)
    const key = fieldKindOf(fields[index]).preview
    if (value == null) return
    if (key === 'divider') drawn = { ...drawn, ...value }
    else if (drawn && key in drawn) drawn = { ...drawn, [key]: value }
  })

  // The code: the side's lines (or the ones written by hand) with each
  // changed value's class.
  let lines = [...(handLines ?? (side === 'A' ? conflict.diff?.after : conflict.diff?.before) ?? [])]
  const differ = changedTokens((conflict.diff?.before ?? []).join('\n'), (conflict.diff?.after ?? []).join('\n'))[side === 'A' ? 1 : 0]
  const focus = differ.filter((run) => run.changed).flatMap((run) => run.text.split(/[\s"'`]+/)).filter(Boolean)
  const w = width ?? layer?.width
  const h = height ?? layer?.height
  const sizeClass = w % 4 === 0 ? `size-${w / 4}` : `size-[${w}px]`
  const squared = lines.findIndex((line) => CLASS.width.test(line) && CLASS.height.test(line))
  if ((changed.width || changed.height) && w === h && lines.some((line) => CLASS.size.test(line))) {
    lines = putClass(lines, CLASS.size, sizeClass)
  } else if (changed.width && changed.height && w === h && squared >= 0) {
    // A square written as w-[…] h-[…]: one size class says both.
    lines = lines.map((line, index) => (index === squared ? line.replace(CLASS.width, sizeClass).replace(new RegExp(`\\s*${CLASS.height.source}`), '') : line))
  } else {
    if (changed.width) lines = putClass(lines, CLASS.width, `w-[${w}px]`, focus)
    if (changed.height) lines = putClass(lines, CLASS.height, set.heightToken ? `h-[var(${set.heightToken})]` : `h-[${h}px]`, focus)
  }
  // (A token's class when the value is a token's, spelled out otherwise.)
  if (changed.radius) lines = putClass(lines, CLASS.radius, RADII.find((token) => token.px === radius)?.name ?? `rounded-[${radius}px]`, focus)
  if (changed.fill) lines = putClass(lines, CLASS.fill, fill.className, focus)

  // Set to exactly what the standard says, and nothing else: it's the
  // design reference's code, written the way the reference writes it.
  const isReference = side !== 'A' && !handLines && extras.length === 0 && rows.some((row) => row.to) && Boolean(conflict.diff?.after)
    // (A value left as it is doesn't count against it; one set by hand has
    // to be the standard's — also where both sides share a value, which
    // setting it differently is exactly what changes.)
    && rows.every((row, index) => !row.to || (numbersIn(row.to).join() === numbersIn(fields[index].expected).join() && numbersIn(row.to).length > 0))
  if (isReference) lines = [...conflict.diff.after]

  // (Code written by hand that changes nothing the comparison lists is
  // still a change: it's what merges.)
  const handWritten = Boolean(handLines) && handLines.join('\n') !== (conflict.diff?.before ?? []).join('\n')
  // (Written by hand beyond what the compared values read: the code it
  // changed, as a row of its own.)
  if (handWritten && !rows.some((row) => row.written)) {
    const change = codeChangeOf(conflict.diff?.before ?? [], handLines)
    if (change.from || change.to) extras.push({ label: 'Code', from: change.from || null, to: change.to || '—' })
  }
  return { side, rows, extras, preview: drawn, lines, isReference, handWritten, adjusted: rows.some((row) => row.to) || extras.length > 0 || handWritten }
}
