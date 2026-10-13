// History has an address the way a change's detail and Docs do
// (lib/historyLink): a layer over the Workspace at ?history / ?history=<id>.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const h = await server.ssrLoadModule('/src/lib/historyLink.js')
  const c = await server.ssrLoadModule('/src/lib/changeLink.js')
  const d = await server.ssrLoadModule('/src/lib/docLink.js')
  // The addresses.
  assert.equal(h.historyHref('dashboard-redesign'), '/projects/dashboard-redesign/workspace?history')
  assert.equal(h.historyHref('p', 'h-3'), '/projects/p/workspace?history=h-3')
  // Reading one.
  assert.deepEqual(h.readHistoryParams('?history'), { open: true, checkpoint: null })
  assert.deepEqual(h.readHistoryParams('?history=h-3'), { open: true, checkpoint: 'h-3' })
  assert.deepEqual(h.readHistoryParams('?history='), { open: true, checkpoint: null })
  assert.deepEqual(h.readHistoryParams('?change=CON-1'), { open: false, checkpoint: null })
  // Opening, moving and closing keep whatever else the address says…
  assert.equal(h.withHistory('', true), '?history')
  assert.equal(h.withHistory('?changes=mine', 'h-3'), '?changes=mine&history=h-3')
  assert.equal(h.withHistory('?history=h-1', 'h-2'), '?history=h-2', 'another checkpoint: the same layer')
  assert.equal(h.withHistory('?history=h-1&tab=x', null), '?tab=x')
  assert.equal(h.withoutHistory('?history'), '')
  // …except the other layers: one at a time, whichever way.
  assert.equal(h.withHistory('?change=CON-2&evidence=h-1&source=a%3Ab', 'h-3'), '?history=h-3', 'History closes a change')
  assert.equal(h.withHistory('?doc=api-spec', true), '?history', 'History closes a document')
  assert.equal(h.withHistory('?docs=updates', 'h-3'), '?history=h-3')
  assert.equal(c.withChange('?history=h-3', 'CON-2'), '?change=CON-2', 'a change closes History')
  assert.equal(d.withDoc('?history=h-3', { doc: 'api-spec' }), '?doc=api-spec', 'a document closes History')
  assert.equal(d.withDoc('?history', { docs: 'index' }), '?docs=index')
  assert.equal(c.withChange('?history=h-3', null), '?history=h-3', 'closing a change that isn\'t there leaves History alone')
  // Closing: the other layers' rule, the same mark.
  assert.equal(h.closeHowOf, c.closeHowOf)
  // Old /history links land on the address that means the same.
  assert.equal(h.legacyHistoryHref('p', '?v=h-7', null), '/projects/p/workspace?history=h-7')
  assert.equal(h.legacyHistoryHref('p', '', { highlightId: 'h-2' }), '/projects/p/workspace?history=h-2')
  assert.equal(h.legacyHistoryHref('p', '?v=h-7', { highlightId: 'h-2' }), '/projects/p/workspace?history=h-7', 'the address wins over router state')
  assert.equal(h.legacyHistoryHref('p', '', null), '/projects/p/workspace?history')
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// The old route is a redirect; the page is gone; nothing goes to /history or passes a checkpoint in router state.
const app = read('src/App.jsx')
assert.ok(app.includes('<Route path="history" element={<HistoryRedirect />} />') && app.includes('legacyHistoryHref(projectId, search, state)') && app.includes('state?.flashCheckpoint ? { flashCheckpoint: state.flashCheckpoint } : null'))
assert.ok(!existsSync(new URL('../src/pages/HistoryPage.jsx', import.meta.url)), 'HistoryPage is a layer now')
const ENTRIES = ['src/components/dashboard/HistoryDrawer.jsx', 'src/components/conflicts/DesignDecisionFlow.jsx', 'src/components/dockview/panels/ConflictReviewPanel.jsx', 'src/components/mergestudio/MergeStudioWorkspace.jsx', 'src/components/dockview/panels/ChatPanel.jsx', 'src/components/docs/DocsOverlay.jsx', 'src/pages/ProjectOverviewPage.jsx']
for (const file of ENTRIES) {
  const text = read(file)
  assert.ok(!/\/history[`'"?]|highlightId|\?v=\$/.test(text), `${file} still goes to the old History route`)
  assert.ok(/openHistory\w*\(|historyHref\(/.test(text), `${file} opens the History layer`)
}
// The selection is the address's `history`; moving it replaces.
const hook = read('src/components/history/useSelectedCheckpoint.js')
assert.ok(hook.includes('const requestedId = historyParam ?? defaultId') && !hook.includes("params.get('v')") && !hook.includes('highlightId'))
assert.ok(hook.includes('search: withHistory(location.search, id) }, { replace: true, state: location.state }'), 'picking a checkpoint replaces — one step back still closes')
// The provider: History yields to a change or a document named with it; opening rules.
const provider = read('src/state/WorkspaceProvider.jsx')
assert.ok(provider.includes('const historyLayer = onWorkspace && !layerShown ? readHistoryParams(location.search) : { open: false, checkpoint: null }'))
assert.ok(provider.includes('const pushState = (fromOtherLayer) => (fromOtherLayer ? null : { changePushed: true })'), 'between layers: pushed, unmarked — Back returns, Close lands on the Workspace')
const open = provider.slice(provider.indexOf('const openHistory = useCallback('), provider.indexOf('const closeHistory = useCallback('))
assert.ok(open.includes("if (shown) { navigate({ pathname: at.pathname, search }, { replace: true, state: { ...at.state, ...lit } }); return }") && open.includes('const mark = pushState(anyLayer)'))
assert.ok(provider.includes('{ state: pushState(fromHistory) }'), 'a change or a document opened from History is a step of its own')
assert.ok(provider.includes("else navigate({ pathname: at.pathname, search: withHistory(at.search, null) }, { replace: true, state: null })"))
assert.ok(read('src/pages/WorkspacePage.jsx').includes('<HistoryOverlay />'))
console.log('history-link: ok')
