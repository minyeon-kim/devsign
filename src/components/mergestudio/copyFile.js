import { LAYER_MOCKUP } from '@/components/mergestudio/mockupContent'

// Merge Studio's own `copy.json`: every piece of text on the comparison
// artboards (headings, body copy, button labels, placeholders, card titles)
// as one string per line. It's the code-side home for design text, so a
// text edit made on the canvas or in the Block Deck is written here as a
// hand-edited line, and editing a line here re-renders the canvas — the
// same manual-code state that drives the rest of code <-> canvas sync.
// Generated from the frame, never stored in the shared file data.
export const COPY_FILE_ID = 'merge-studio-copy'

const LABEL_TYPES = new Set(['button', 'chip', 'input'])

// Every editable text slot on the frame, in layer order:
// { key, layerId, slot: 'text' | 'label' | 'title' | 'body', value, name }.
export function copyEntries(frame) {
  const entries = []
  for (const layer of frame?.layers ?? []) {
    const mock = LAYER_MOCKUP[layer.id] ?? {}
    if (layer.type === 'text') {
      entries.push({ key: layer.id, layerId: layer.id, slot: 'text', value: mock.text ?? layer.name, name: layer.name })
    } else if (LABEL_TYPES.has(layer.type)) {
      const value = layer.type === 'input' ? (mock.placeholder ?? layer.label) : layer.label
      if (value) entries.push({ key: layer.id, layerId: layer.id, slot: 'label', value, name: layer.name })
    } else if (layer.type === 'card' && mock.title) {
      entries.push({ key: `${layer.id}.title`, layerId: layer.id, slot: 'title', value: mock.title, name: `${layer.name} title` })
      entries.push({ key: `${layer.id}.body`, layerId: layer.id, slot: 'body', value: mock.body ?? '', name: `${layer.name} body` })
    }
  }
  return entries
}

export function formatCopyLine(key, value, last) {
  return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}${last ? '' : ','}`
}

// `"key": "value",` -> { key, value }; null for anything else (braces, or a
// line mid-edit that isn't valid yet).
export function parseCopyLine(text) {
  const m = text.match(/^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/)
  if (!m) return null
  try {
    return { key: JSON.parse(m[1]), value: JSON.parse(m[2]) }
  } catch {
    return null
  }
}

// The virtual file, shaped like an `openFiles` entry.
export function copyFile(frame) {
  const entries = copyEntries(frame)
  if (!entries.length) return null
  return {
    id: COPY_FILE_ID,
    name: 'copy.json',
    path: 'src/content/copy.json',
    language: 'json',
    lines: ['{', ...entries.map((e, i) => formatCopyLine(e.key, e.value, i === entries.length - 1)), '}'],
  }
}

// Where a layer's text slot lives in copy.json: its 1-indexed line and the
// entry (default value) it came from.
export function copyLineFor(frame, layerId, slot) {
  const entries = copyEntries(frame)
  const i = entries.findIndex((e) => e.layerId === layerId && e.slot === slot)
  if (i < 0) return null
  return { line: i + 2, entry: entries[i], last: i === entries.length - 1 }
}

// Current text for every slot, with hand edits (`code`, keyed `fileId:line`)
// applied: { [layerId]: { [slot]: value } } for slots that differ.
export function copyEdits(frame, code) {
  const entries = copyEntries(frame)
  const out = {}
  entries.forEach((e, i) => {
    const text = code?.[`${COPY_FILE_ID}:${i + 2}`]
    const parsed = text != null ? parseCopyLine(text) : null
    if (parsed && parsed.key === e.key && parsed.value !== e.value) {
      out[e.layerId] = { ...out[e.layerId], [e.slot]: parsed.value }
    }
  })
  return out
}
