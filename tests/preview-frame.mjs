// A picture's frame is sized by its cell and a fixed ratio — never by what's
// drawn in it: the drawing is out of the flow, centred, scaled down to fit.
// So a taller button, a bigger icon or a longer value moves nothing.
// (Measured in the browser: every card, frame and caption 0px apart across
// every way and the smallest / largest value of each kind.)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { PreviewFrame, SAMPLE_RATIO, SAMPLES } = await server.ssrLoadModule('/src/components/conflicts/ElementPreview.jsx')
  const html = renderToString(createElement(PreviewFrame, { ratio: 2 }, createElement('span', { style: { display: 'block', width: 999, height: 999 } }, 'x')))
  // The frame: its own size (width 100% × ratio), clipped, contained.
  assert.match(html, /data-preview-frame/)
  assert.match(html, /class="[^"]*\brelative\b[^"]*\bw-full\b[^"]*\boverflow-hidden\b/)
  assert.match(html, /aspect-ratio:2;contain:strict/)
  // The drawing: absolute, in the middle, scaled — not in the flow.
  assert.match(html, /data-preview-drawing[^>]*class="[^"]*\babsolute\b[^"]*\btop-1\/2\b[^"]*\bleft-1\/2\b/)
  assert.match(html, /transform:translate\(-50%, -50%\) scale\(1\)/)
  // Every sample has a ratio of its own.
  for (const sample of [...SAMPLES, 'preview']) assert.ok(SAMPLE_RATIO[sample] > 0, `no frame ratio for the ${sample} sample`)
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const preview = read('src/components/conflicts/ElementPreview.jsx')
const flow = read('src/components/conflicts/DesignDecisionFlow.jsx')
const panel = read('src/components/dockview/panels/ConflictReviewPanel.jsx')
// Every picture on a 해결 방법 card is in a frame — the element, a sample, a layout's screen, the other card's.
assert.ok(/export function ElementCrop[\s\S]*?<PreviewFrame ratio=\{region\.width \/ region\.height\}/.test(preview))
assert.ok(/export function SampleCrop[\s\S]*?<PreviewFrame ratio=\{SAMPLE_RATIO\[/.test(preview))
assert.ok(flow.includes('<PreviewFrame ratio={TABLET.width / PREVIEW_HEIGHT}>'))
assert.equal(panel.match(/<PreviewFrame ratio=\{2\}>/g).length, 2, 'the other card: before and after')
assert.ok(!/min-h-\[72px\]/.test(preview.slice(preview.indexOf('export function ElementCrop'), preview.indexOf('function Pane('))), 'no frame sized by a min-height')
// The two cards are the same height (stretched in one row), and a caption is two fixed lines on one line each.
assert.ok(flow.includes('data-before-after className="grid grid-cols-1 items-stretch') && panel.includes('data-before-after className="grid grid-cols-1 items-stretch'))
const caption = flow.slice(flow.indexOf('function PictureCaption('), flow.indexOf('// What the check looks at, in a word'))
assert.ok(/block h-5 truncate[^"]*tabular-nums/.test(caption) && /block h-4 truncate[^"]*tabular-nums/.test(caption) && caption.includes("sub || '\\u00a0'"), 'a caption keeps both its lines')
assert.equal(flow.match(/<PictureCaption\b/g).length, 2)
assert.ok(!/<figcaption className="mt-3 text-center">/.test(flow + panel), 'no caption of free height')
// A way's line is one line, whatever its value.
assert.equal(flow.match(/min-w-0 flex-1 truncate text-\[13px\] leading-5 tabular-nums/g).length, 2)
// The result's picture is not keyed by the way in either card.
assert.ok(!panel.includes("key={afterId ?? 'none'}"))
console.log('preview-frame: ok')
