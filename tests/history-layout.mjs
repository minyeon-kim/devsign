import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// The History layer's body, as a product screen: one header, a Screen | Code
// tab, a one-line toolbar of at most seven controls, one canvas, a thin
// playback bar — and each fact said once.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const h = await server.ssrLoadModule('/src/lib/historyLink.js')
  const c = await server.ssrLoadModule('/src/lib/changeLink.js')
  const d = await server.ssrLoadModule('/src/lib/docLink.js')

  // The tab is in the address: `&view=code`; the Screen tab, the default, says nothing.
  assert.equal(h.withHistoryView('?history=h-2', 'code'), '?history=h-2&view=code')
  assert.equal(h.withHistoryView('?history=h-2&view=code', 'screen'), '?history=h-2', 'the default is left out')
  assert.equal(h.withHistoryView('?changes=mine&history=h-2', 'code'), '?changes=mine&history=h-2&view=code')
  assert.equal(h.withHistoryView('?history', 'code'), '?history&view=code', 'History on its default checkpoint')
  assert.equal(h.withHistoryView('?tab=x', 'code'), '?tab=x', 'no History in the address: nothing to put a tab on')
  assert.equal(h.readHistoryView('?history=h-2&view=code'), 'code')
  assert.equal(h.readHistoryView('?history=h-2'), null)
  assert.equal(h.readHistoryView('?history=h-2&view=nonsense'), null)
  for (const view of ['code', 'split', 'screen']) {
    const address = h.withHistoryView('?history=h-2', view)
    assert.equal(h.readHistoryView(address) ?? 'screen', view, `${view}: address → tab`)
    assert.deepEqual(h.readHistoryParams(address), { open: true, checkpoint: 'h-2' }, `${view}: the checkpoint is still read`)
  }
  // The tab stays while checkpoints change, and goes with the layer.
  assert.equal(h.withHistory('?history=h-2&view=code', 'h-3'), '?history=h-3&view=code', 'stepping keeps the tab')
  assert.equal(h.withHistory('?history=h-2&view=code', null), '', 'closing takes it off')
  assert.equal(h.withoutHistory('?history=h-2&view=code&tab=x'), '?tab=x')
  assert.equal(c.withChange('?history=h-2&view=code', 'CON-2'), '?change=CON-2', 'a change closes History and its tab')
  assert.equal(d.withDoc('?history=h-2&view=code', { doc: 'api' }), '?doc=api', 'a document too')

  // The viewer, rendered: the page's header, tabs and toolbar.
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: HistoryCompare } = await server.ssrLoadModule('/src/components/history/HistoryCompare.jsx')
  const render = (props, search = '?history=history-db-2') => renderToString(createElement(MemoryRouter, { initialEntries: [`/projects/dashboard-redesign/workspace${search}`] }, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: 'dashboard-redesign' }, createElement(HistoryCompare, { entryId: 'history-db-2', baseEntryId: 'history-db-1', position: { index: 1, total: 3 }, baseline: 'previous', onRollback() {}, onArchive() {}, ...props })))))
  const page = render({})

  // One header: no yellow band, no summary strip, no card around it all.
  assert.match(page, /data-checkpoint-header/)
  assert.match(page, /<h2[^>]*data-checkpoint-title/, 'the title, one line')
  for (const gone of ['data-checkpoint-conflict', 'data-change-summary', 'data-problem-line', 'data-summary-code', 'data-preview-changed-names']) assert.doesNotMatch(page, new RegExp(gone), `${gone} is no longer rendered`)
  // Why: folded under "자세히" at the meta line's end — the header is two lines.
  assert.match(page, /data-checkpoint-reason-toggle/, 'why, on asking')
  assert.doesNotMatch(page, /data-checkpoint-why/, 'folded to start')
  assert.doesNotMatch(page, /Preview props|미리보기 속성/, 'no props list under the screen')
  assert.match(page, /data-history-controls-row/, 'one row of controls: the views, the comparison, the preview\'s own')
  assert.doesNotMatch(page, /data-checkpoint-header[^>]*class="[^"]*(bg-|border|ring-)/, 'the header has no box')
  const root = page.match(/<div data-history-compare="page" class="([^"]*)"/)?.[1] ?? ''
  assert.ok(root && !/\b(bg-|border|ring-|shadow|rounded)/.test(root), `the page's viewer has no card: ${root}`)

  // Screen | Code, as tabs; the screen one when the screen changed.
  const tabs = [...page.matchAll(/<button[^>]*data-history-tab="(\w+)"[^>]*>/g)].map(([tag, id]) => ({ id, selected: /aria-selected="true"/.test(tag) }))
  assert.deepEqual(tabs, [{ id: 'screen', selected: true }, { id: 'code', selected: false }, { id: 'split', selected: false }])
  assert.match(page, /data-compare-render/, 'the screen tab shows the canvas')
  assert.doesNotMatch(page, /data-compare-code/, '…and not the code')
  const code = render({}, '?history=history-db-2&view=code')
  assert.deepEqual([...code.matchAll(/<button[^>]*data-history-tab="(\w+)"[^>]*>/g)].map(([tag, id]) => ({ id, selected: /aria-selected="true"/.test(tag) })), [{ id: 'screen', selected: false }, { id: 'code', selected: true }, { id: 'split', selected: false }], 'view=code opens on the code tab')
  assert.match(code, /data-compare-code="open"/)
  assert.doesNotMatch(code, /data-compare-render/, 'the code tab has the height to itself')
  // Screen and code together: both in one body, side by side.
  assert.equal(h.withHistoryView('?history=h-2', 'split'), '?history=h-2&view=split')
  assert.equal(h.readHistoryView('?history=h-2&view=split'), 'split')
  assert.equal(h.withHistory('?history=h-2&view=split', 'h-3'), '?history=h-3&view=split', 'stepping keeps it')
  const both = render({}, '?history=history-db-2&view=split')
  assert.match(both, /data-history-tab="split"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-history-tab="split"/)
  assert.match(both, /data-compare-body="split"[^>]*flex-row/)
  assert.match(both, /data-compare-render/, 'the screen…')
  assert.match(both, /data-compare-code="open"/, '…and the code')
  assert.match(code, /data-code-whole-file/, 'file · N lines · whole file · layout')
  // Playing on the Screen tab: the typing goes on, unseen.
  assert.match(render({ playing: true }), /hidden=""[^>]*>[\s\S]*data-playback-code|hidden=""/, 'playback goes on behind the screen tab')

  // The toolbar: one line, at most seven controls.
  const bar = page.match(/<div data-preview-controls[^>]*>([\s\S]*?)<\/div><\/div><div class="group\/canvas/)?.[0] ?? ''
  assert.ok(bar, 'the toolbar is rendered')
  const controls = (bar.match(/data-toolbar-control/g) ?? []).length
  assert.ok(controls >= 4 && controls <= 7, `${controls} controls in the toolbar`)
  assert.match(bar, /flex-nowrap/, 'one line')
  assert.doesNotMatch(bar, /flex-wrap/)
  assert.doesNotMatch(bar, /data-preview-zoom/, 'the zoom is not in it')
  assert.match(page, /group\/canvas[\s\S]*data-preview-zoom/, 'the zoom floats on the canvas')
  assert.doesNotMatch(bar, /data-preview-(design|overview|inspect|changed)\b/, 'those are ⋯’s switches now')
  // (What it's compared with: a dropdown in the page's own row, beside the view tabs — not the preview's.)
  assert.match(page.slice(page.indexOf('data-history-controls-row')), /^[^]*?data-baseline="previous"[^]*?data-history-preview-controls/, 'what it is compared with: a dropdown')
  assert.match(bar, /data-preview-more/)
  assert.doesNotMatch(bar, /data-device-orientation/, 'the rotation is inside the device menu')

  // ⋯: four switches.
  const preview = read('src/components/dockview/panels/PreviewPanelContent.jsx')
  const optionsAt = preview.indexOf('const options = [')
  const options = preview.slice(optionsAt, preview.indexOf('].filter(Boolean)', optionsAt))
  assert.deepEqual([...options.matchAll(/id: '(\w+)'/g)].map((m) => m[1]), ['design', 'overview', 'inspect', 'rings'], 'the ⋯ menu: design original, all devices, inspection, rings')
  assert.ok(preview.includes('data-preview-more-dot'), 'a dot on ⋯ when one is on')
  assert.ok(read('src/components/history/DevicePicker.jsx').includes('data-device-orientation={screen.orientation} onClick'), 'rotation is a menu item')

  // The names over the renders: one rule.
  assert.match(page, /이전 · #1/)
  assert.match(page, /이 버전 · #2/)
  assert.doesNotMatch(page, /체크포인트 #1|Checkpoint #1/, 'one way to say it')
  assert.match(page, /<figcaption[^>]*text-white[^>]*>이 버전 · #2/, 'this version’s name is white')
  assert.match(page, /<figcaption[^>]*text-slate-400[^>]*>이전 · #1/, '…the other side’s is slate')

  // A change's replay (embedded) keeps its own layout: its header, the change line, the code under the renders.
  const replay = render({ embedded: true, header: createElement('div', { 'data-replay-head': true }), codeOpenByDefault: true })
  assert.match(replay, /data-history-compare="embedded"/)
  assert.match(replay, /data-replay-head/)
  assert.match(replay, /data-change-summary/, 'the replay keeps its change line')
  assert.match(replay, /data-compare-code="open"/, 'and its code under the renders')
  assert.doesNotMatch(replay, /data-history-tabs|data-checkpoint-header/, 'no page tabs, no page header in a replay')
  assert.doesNotMatch(replay, /data-checkpoint-conflict|data-preview-changed-names/)

  // Nothing of the old layout is left on the page.
  const compare = read('src/components/history/HistoryCompare.jsx')
  assert.ok(!compare.includes('data-checkpoint-conflict') && !preview.includes('data-checkpoint-conflict'))
  assert.ok(!compare.includes('FLOATING_PANEL'))

  // The path says nothing after it; the drawer says the count and the filter.
  const overlay = read('src/components/history/HistoryOverlay.jsx')
  assert.ok(!overlay.includes('meta={') && !overlay.includes('data-history-info'))
  assert.ok(read('src/components/dashboard/HistoryDrawer.jsx').includes('<LocalizedText text="All files" />'))
  assert.match(read('src/i18n/ko.js'), /All files\|모든 파일/)

  // The bar: one 48px line, a hairline above, no fill.
  const timeline = read('src/components/history/HistoryTimeline.jsx')
  assert.ok(timeline.includes("'h-12 gap-3 border-t border-white/[0.08]'"))
  assert.ok(timeline.includes('data-timeline-tooltip') && timeline.includes('data-timeline-problem'))

  console.log('Passed: History layer layout — one header, Screen | Code tabs in the address, a one-line toolbar (≤ 7 controls, ⋯ with four), one canvas, one bar.')
} finally { delete globalThis.localStorage; await server.close() }
