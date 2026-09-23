import { codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { ASSEMBLY_FILLS, mergeOverride } from '@/components/mergestudio/mergeEffects'

// Code -> canvas live sync. Hand-edited code lines (keyed `fileId:line`) are
// read for the handful of properties a design layer can show — fill color,
// corner radius, padding, width/height and text label — and turned into
// overrides for the Current Implementation artboard. Each edited line is
// compared against its original text and only properties that actually
// changed are applied, so values the design already reflects never leak in.

const RADIUS_CLASSES = { none: 0, sm: 2, '': 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 999 }
const COLOR_WORDS = [
  [/\b(violet|purple)\b/, 'violet'],
  [/\bindigo\b/, 'indigo'],
  [/\b(emerald|green)\b/, 'emerald'],
  [/\b(rose|red)\b/, 'rose'],
  [/\b(amber|yellow|orange)\b/, 'amber'],
]

// A color as an override: a known fill class when one matches (Tailwind only
// ships classes present in source), otherwise an inline background.
function parseColor(text) {
  const literal = text.match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|(?:oklch|rgba?|hsla?)\([^)]*\)/i)
  if (literal) return { fillStyle: { background: literal[0] } }
  const t = text.toLowerCase()
  const word = COLOR_WORDS.find(([re]) => re.test(t))
  if (word) return { className: ASSEMBLY_FILLS.find((f) => f.id === word[1]).className }
  if (/\bgradient\b/.test(t)) return { className: ASSEMBLY_FILLS.find((f) => f.id === 'gradient').className }
  return null
}

function parseLine(text) {
  const out = {}
  const color = /(?:background|--primary|"primary"|\bfill\b|\bcolor\b|className|\bbg-|accent-)/i.test(text) ? parseColor(text) : null
  if (color) out.color = color

  const rounded = text.match(/\brounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?\b/)
  const radiusPx = text.match(/(?:border-radius|--radius|radius|"(?:sm|md|lg)")"?\s*:\s*([\d.]+)\s*(rem|px)?/i)
  if (rounded) out.radius = RADIUS_CLASSES[rounded[1] ?? '']
  else if (radiusPx) out.radius = parseFloat(radiusPx[1]) * (radiusPx[2] === 'rem' ? 16 : 1)

  const padding = text.match(/padding\s*:\s*([\d.]+)px(?:\s+([\d.]+)px)?/i)
  if (padding) {
    out.padY = parseFloat(padding[1])
    out.padX = parseFloat(padding[2] ?? padding[1])
  }
  const width = text.match(/\bwidth\s*[:=]\s*\{?\s*([\d.]+)/i)
  const height = text.match(/\bheight\s*[:=]\s*\{?\s*([\d.]+)/i)
  if (width) out.width = parseFloat(width[1])
  if (height) out.height = parseFloat(height[1])

  // JSX children text right before a closing tag (attributes can hold `=>`,
  // so anchor on the closing tag rather than the opening one).
  const label = text.match(/>([^<>{}]+)<\/[A-Za-z][\w.]*>/)
  if (label?.[1].trim()) out.label = label[1].trim()
  return out
}

// The part of an edit that differs from the original line, as an override.
function lineOverride(original, edited) {
  const a = parseLine(original)
  const b = parseLine(edited)
  const o = {}
  if (b.color && JSON.stringify(b.color) !== JSON.stringify(a.color)) Object.assign(o, b.color)
  if (b.radius !== undefined && b.radius !== a.radius) o.radius = b.radius
  if (b.padX !== undefined && a.padX !== undefined) {
    const dw = (b.padX - a.padX) * 2
    const dh = (b.padY - a.padY) * 2
    if (dw) o.dw = dw
    if (dh) o.dh = dh
  }
  if (b.width !== undefined && b.width !== a.width) o.width = b.width
  if (b.height !== undefined && b.height !== a.height) o.height = b.height
  if (b.label && b.label !== a.label) o.asLabel = b.label
  return Object.keys(o).length ? o : null
}

// Color tokens that restyle every primary-accented element, not just the
// layer whose code span they sit in.
const PRIMARY_TOKEN = /(--primary|"primary")\s*:/
const PRIMARY_TYPES = new Set(['button', 'chip', 'toggle'])

// Builds per-layer overrides from the edited code. `code` maps `fileId:line`
// to edited text; each edit is compared with what the Current Implementation
// already reflects for that line (its incoming text, else the file's own).
export function codeOverrides(itemId, frame, code, getFileLines) {
  const result = {}
  if (!frame || !code) return result
  const spans = designMergeVariants[itemId]?.layerCodeMap ?? {}
  const entries = Object.entries(code)
    .map(([key, text]) => {
      const split = key.lastIndexOf(':')
      return { fileId: key.slice(0, split), line: Number(key.slice(split + 1)), text }
    })
    .sort((x, y) => x.line - y.line)

  for (const { fileId, line, text } of entries) {
    const base =
      codeMergeVariants[itemId]?.[fileId]?.find((d) => d.line === line)?.incoming ?? getFileLines(fileId)[line - 1] ?? ''
    const o = lineOverride(base, text)
    if (!o) continue
    const targets = PRIMARY_TOKEN.test(text)
      ? frame.layers.filter((l) => PRIMARY_TYPES.has(l.type)).map((l) => l.id)
      : Object.keys(spans).filter((id) => {
          const s = spans[id]
          return s.fileId === fileId && line >= s.line && line <= s.line + (s.span ?? 1) - 1
        })
    for (const id of targets) {
      const layer = frame.layers.find((l) => l.id === id)
      if (!layer) continue
      const { width, height, ...rest } = o
      const sized = {
        ...rest,
        dw: (rest.dw ?? 0) + (width !== undefined ? width - layer.width : 0),
        dh: (rest.dh ?? 0) + (height !== undefined ? height - layer.height : 0),
      }
      result[id] = mergeOverride(result[id], sized)
    }
  }
  return result
}
