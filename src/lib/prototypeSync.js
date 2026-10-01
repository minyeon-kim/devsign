import { canvasPages } from '@/data/mockData'
import { LAYER_MOCKUP } from '@/components/mergestudio/mockupContent'

// Design ↔ code sync for the Workspace canvas.
//
// Each canvas page has a code file (src/prototype/<Page>.jsx) and both are
// views of one model — the page's layers plus `edits`, a map of
// { [layerId]: { copy: { [slot]: text }, fill, radius } }:
//   · canvas → code: editing on the canvas changes `edits`, and the file is
//     regenerated from them (prototypeLines);
//   · code → canvas: editing the file is parsed back into `edits`
//     (parsePrototype), and the canvas re-renders from them.
// Every syncable layer is one line of JSX keyed by its layer id, so a
// change on either side lands on exactly one line of the other.

const TAGS = { text: 'Text', button: 'Button', chip: 'Chip', input: 'Input', card: 'Card' }
// Which layer types take a fill / radius from the file.
const FILL_TYPES = new Set(['button', 'chip'])
const RADIUS_TYPES = new Set(['button', 'chip', 'input', 'card'])

function componentName(pageName) {
  return pageName.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase())
}

export const PROTOTYPE_FILES = canvasPages.map((page) => {
  const name = componentName(page.name)
  return {
    id: `proto-${page.id}`,
    pageId: page.id,
    component: name,
    name: `${name}.jsx`,
    path: `src/prototype/${name}.jsx`,
    language: 'jsx',
    iconName: 'FileCode',
    prototype: true,
    lines: [],
  }
})

export function prototypeFileForPage(pageId) {
  return PROTOTYPE_FILES.find((f) => f.pageId === pageId)
}

export function prototypeFile(fileId) {
  return PROTOTYPE_FILES.find((f) => f.id === fileId)
}

function pageOf(file) {
  return canvasPages.find((p) => p.id === file.pageId)
}

// A layer takes part in the sync when it has text of its own (the same
// slots Merge Studio's StaticLayer lets you edit in place).
function isSynced(layer) {
  if (!TAGS[layer.type]) return false
  if (layer.type === 'card') return Boolean(LAYER_MOCKUP[layer.id]?.title)
  return true
}

// The text a layer shows before anyone edits it — the same fallbacks
// StaticLayer uses, so the generated file and the canvas always agree.
export function defaultCopy(layer) {
  const mock = LAYER_MOCKUP[layer.id] ?? {}
  switch (layer.type) {
    case 'text':
      return { text: mock.text ?? layer.name }
    case 'input':
      return { label: mock.placeholder ?? layer.label ?? 'Input' }
    case 'card':
      return { title: mock.title ?? layer.name, body: mock.body ?? '' }
    default:
      return { label: layer.label ?? (layer.type === 'button' ? 'Button' : 'Chip') }
  }
}

const attr = (value) => String(value).replace(/"/g, "'")

function layerLine(layer, edit = {}) {
  const tag = TAGS[layer.type]
  const copy = defaultCopy(layer)
  for (const [slot, value] of Object.entries(edit.copy ?? {})) if (value !== undefined) copy[slot] = value
  const style = [
    FILL_TYPES.has(layer.type) && edit.fill && ` fill="${attr(edit.fill)}"`,
    RADIUS_TYPES.has(layer.type) && edit.radius !== undefined && ` radius={${edit.radius}}`,
  ]
    .filter(Boolean)
    .join('')
  const pad = '      '
  if (layer.type === 'input') return `${pad}<${tag} id="${layer.id}" placeholder="${attr(copy.label)}"${style} />`
  if (layer.type === 'card') return `${pad}<${tag} id="${layer.id}" title="${attr(copy.title)}" body="${attr(copy.body)}"${style} />`
  const text = layer.type === 'text' ? copy.text : copy.label
  return `${pad}<${tag} id="${layer.id}"${style}>${text}</${tag}>`
}

// The file's content, generated from the page and its edits.
export function prototypeLines(fileId, edits) {
  const file = prototypeFile(fileId)
  const page = file && pageOf(file)
  if (!page) return []
  const lines = [
    `// Generated from the "${page.name}" canvas page and kept in sync with it:`,
    '// edit text, fill or radius here and the canvas updates — edit the canvas',
    '// and this file updates.',
    `export function ${file.component}() {`,
    '  return (',
    '    <>',
  ]
  for (const frame of page.frames) {
    lines.push(`    <Frame name="${attr(frame.name)}">`)
    for (const layer of frame.layers) {
      if (isSynced(layer)) lines.push(layerLine(layer, edits[layer.id]))
    }
    lines.push('    </Frame>')
  }
  lines.push('    </>', '  )', '}')
  return lines
}

// 1-based line of a layer in its page's file, or null.
export function lineForLayer(fileId, layerId, edits) {
  const index = prototypeLines(fileId, edits).findIndex((l) => l.includes(` id="${layerId}"`))
  return index === -1 ? null : index + 1
}

// Reads a (possibly hand-edited) file back into edits. Lines it can't
// read, or that name no layer, are skipped rather than failing the sync.
export const SYNC_FILL_TYPES = FILL_TYPES
export const SYNC_RADIUS_TYPES = RADIUS_TYPES

export function parsePrototype(fileId, lines) {
  const file = prototypeFile(fileId)
  const page = file && pageOf(file)
  if (!page) return {}
  const layers = new Map(page.frames.flatMap((f) => f.layers).map((l) => [l.id, l]))
  const edits = {}
  for (const line of lines) {
    const id = line.match(/\bid="([^"]+)"/)?.[1]
    const layer = id && layers.get(id)
    if (!layer || !isSynced(layer)) continue
    const edit = { copy: {} }
    if (layer.type === 'input') {
      const placeholder = line.match(/\bplaceholder="([^"]*)"/)
      if (placeholder) edit.copy.label = placeholder[1]
    } else if (layer.type === 'card') {
      const title = line.match(/\btitle="([^"]*)"/)
      const body = line.match(/\bbody="([^"]*)"/)
      if (title) edit.copy.title = title[1]
      if (body) edit.copy.body = body[1]
    } else {
      const children = line.match(/>([^<]*)<\//)
      if (children) edit.copy[layer.type === 'text' ? 'text' : 'label'] = children[1]
    }
    const fill = line.match(/\bfill="([^"]+)"/)
    const radius = line.match(/\bradius=\{\s*(\d+(?:\.\d+)?)\s*\}/)
    if (fill) edit.fill = fill[1]
    if (radius) edit.radius = Number(radius[1])
    edits[id] = edit
  }
  return edits
}

// A layer's edits as a StaticLayer override (text copy, fill, radius,
// position/size deltas). `dx`/`dy`/`dw`/`dh` pass straight through — an AI
// edit that changes a component's size (e.g. a button's height variant)
// needs to move the layer on canvas the same way a manual resize drag
// does, and StaticLayer already reads these directly off the override.
export function overrideFromEdit(edit) {
  if (!edit) return undefined
  const override = { ...edit.merged }
  const copy = Object.fromEntries(Object.entries(edit.copy ?? {}).filter(([, v]) => v !== undefined))
  if (Object.keys(copy).length) override.copy = copy
  if (edit.fill) override.fillStyle = { background: edit.fill, color: '#fff' }
  if (edit.radius !== undefined) override.radius = edit.radius
  for (const key of ['dx', 'dy', 'dw', 'dh']) {
    if (edit[key] !== undefined) override[key] = edit[key]
  }
  return Object.keys(override).length ? override : undefined
}

// A couple of the UT script's own *real* component files — not the
// generated src/prototype/*.jsx ones parsePrototype handles — are also
// wired to a canvas layer, by a handful of known text patterns rather
// than a general JSX parser: PlaceOrderButton.jsx's `size="lg"` / hard-
// coded violet (cc-11), Button.jsx's `--button-height-md` vs `h-9` (cc-1).
// Both layers' own canvas defaults already sit at one of the two real
// values (place-order's at the fixed 44px, button-md's at the buggy
// 36px/h-9) — `dh` is the delta from there, not an absolute height.
// Without this, editing or AI-fixing either file changes the code pane
// and nothing else: "code changed, preview didn't".
const COMPONENT_SYNC = {
  'checkout-redesign:app': {
    layerId: 'place-order',
    derive: (text) => ({
      dh: /size="lg"/.test(text) ? 0 : -4,
      fill: /bg-\[(#[0-9a-f]{6})\]/i.exec(text)?.[1],
    }),
  },
  'design-system-v2:app': {
    layerId: 'button-md',
    derive: (text) => ({ dh: /--button-height-md/.test(text) ? 4 : 0 }),
  },
}

// `{ [layerId]: patch }`, ready to merge into `prototypeEdits` — or null
// if this project/file isn't one of the two wired above.
export function deriveComponentOverride(projectId, fileId, lines) {
  const sync = COMPONENT_SYNC[`${projectId}:${fileId}`]
  if (!sync || !Array.isArray(lines)) return null
  return { [sync.layerId]: sync.derive(lines.join('\n')) }
}
