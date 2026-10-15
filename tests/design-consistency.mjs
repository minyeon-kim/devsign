import assert from 'node:assert/strict'
import { createServer } from 'vite'

// The conflicts are about the design: what each says the design wants (`expected`) is what the canvas draws, the screen it
// names is the frame it sits on, and one layer isn't asked about twice for the same thing. The canvas (`canvasPages`) is
// the design's truth; `current` is what the code has.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { canvasPages, findCanvasTarget } = await server.ssrLoadModule('/src/data/mockData.js')
  const records = allConflictRecords()
  const number = (text) => Number.parseFloat(String(text ?? '').replace(/[^\d.]+/, ''))
  // A frame is named "Checkout - Payment step" and said "Checkout · Payment step".
  const said = (name) => String(name).replace(/ · /g, ' - ')

  // Components drawn on their own (ElementPreview's samples) — their screens aren't frames of the canvas, and nothing is
  // pinned for them: a legend, a sidebar and an empty state the Dashboard design doesn't have (yet). They are the only ones.
  const STANDALONE = ['CON-002', 'CON-008', 'CON-009', 'CON-011']
  const pinned = records.filter((record) => record.layerId)
  for (const record of records.filter((entry) => !entry.layerId && entry.kind !== 'code-conflict')) {
    assert.ok(STANDALONE.includes(record.id), `${record.id}: names no layer — only the standalone samples may (${STANDALONE.join(', ')})`)
  }

  for (const record of pinned) {
    // 1 · The layer is on the canvas.
    const target = findCanvasTarget(record.layerId)
    assert.ok(target?.layer, `${record.id}: layer "${record.layerId}" is on the canvas`)
    const { frame, layer } = target
    // 2 · The screen it says is the frame it's on.
    const screens = [...(record.impact?.screens ?? []), ...(record.screens ?? [])].map(said)
    assert.ok(screens.includes(frame.name), `${record.id}: says ${JSON.stringify(screens)}, but "${layer.id}" is on "${frame.name}"`)
    // 3 · What the design wants is what the canvas draws.
    for (const field of record.comparisonFields ?? []) {
      const want = number(field.expected)
      const drawn = {
        Height: layer.height,
        Width: layer.width,
        'Icon size': layer.width,
        Stroke: layer.mock?.stroke,
        'Font weight': layer.mock?.weight,
      }[field.label]
      if (drawn != null) assert.equal(drawn, want, `${record.id} · ${field.label}: the design says ${field.expected}, the canvas draws ${drawn}`)
      if (field.label === 'Touch area') {
        const [w, h] = String(field.expected).match(/[\d.]+/g).map(Number)
        assert.deepEqual([layer.width, layer.height], [w, h], `${record.id} · Touch area: the design says ${field.expected}`)
      }
    }
  }

  // The checkout field gap: the label sits 8px above the field it labels.
  const frame = canvasPages.find((page) => page.id === 'page-checkout').frames[0]
  const label = frame.layers.find((layer) => layer.id === 'payment-label')
  const field = frame.layers.find((layer) => layer.id === 'card-input')
  assert.equal(field.y - (label.y + label.height), number(records.find((record) => record.id === 'CON-012').comparisonFields[0].expected), 'CON-012: the design’s field gap is on the canvas')

  // 4 · One layer isn't asked about twice for one thing. (CON-017 shows the standard missed on both sides; CON-019 is the
  // hand adjustment of the same button — two ways of looking at one layer, kept apart on purpose.)
  const SAME_ON_PURPOSE = [['CON-017', 'CON-019']]
  const seen = new Map()
  for (const record of pinned) {
    for (const field of record.comparisonFields ?? []) {
      const key = `${record.layerId}|${field.label}`
      const other = seen.get(key)
      if (other) assert.ok(SAME_ON_PURPOSE.some((pair) => pair.includes(other) && pair.includes(record.id)), `${other} and ${record.id} both ask about ${field.label} of ${record.layerId}`)
      seen.set(key, record.id)
    }
  }

  // The primary colour is one value: the token file, the Inspector and the conflict that names it.
  const { inspectorSpecsByType } = await server.ssrLoadModule('/src/data/mockData.js')
  const button = records.find((record) => record.id === 'CON-014')
  assert.equal(inspectorSpecsByType.button.fill.color.toLowerCase(), button.preview.after.background.toLowerCase(), 'color.primary is one colour')
  console.log('Passed: the conflicts say what the canvas draws — layers, screens, values, the field gap, the primary colour.')
} finally { await server.close() }
