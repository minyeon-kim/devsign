import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// The third card renders an editor for every compared value once it's
// chosen, with the way into Merge Studio; Merge Studio's Inspect panel
// offers the selection's code beside its properties.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Panel } = await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  const { default: BlockDeckPanel } = await server.ssrLoadModule('/src/components/mergestudio/BlockDeckPanel.jsx')
  const { conflictChecklist, mergeListItems } = await server.ssrLoadModule('/src/data/mockData.js')
  const wrap = (projectId, child) => createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId }, child)))
  for (const id of ['cc-4', 'cc-7', 'cc-8', 'cc-9', 'cc-10', 'cc-11']) {
    const conflict = { ...conflictChecklist.find((c) => c.id === id), reviewStage: 'detected', customChosen: true }
    const html = renderToStaticMarkup(wrap(conflict.projectId, createElement(Panel, { conflict, onOpenChange() {}, onUpdate() {}, onOpenMergeStudio() {} })))
    const editors = html.match(/data-value-editor="/g)?.length ?? 0
    assert.equal(editors, conflict.comparisonFields.length, `${id}: an editor for each of ${conflict.comparisonFields.length} values (got ${editors})`)
    assert.ok(html.includes('data-adjust-more'), `${id}: the way into Merge Studio`)
  }
  const item = mergeListItems.find((entry) => entry.id === 'merge-checkout-shipping-icon')
  const layerCode = { fileId: 'shipping', fileName: 'Shipping.jsx', lines: [{ line: 4, original: '<Truck />', text: '<Truck strokeWidth={3} />', edited: true, incoming: '<Truck />', inBlock: true }] }
  const deck = renderToStaticMarkup(wrap(item.projectId, createElement(BlockDeckPanel, { open: true, embedded: true, item, layerCode, onEditCode() {}, onLiveEditCode() {} })))
  assert.ok(deck.includes('data-inspect-view="properties"') && deck.includes('data-inspect-view="code"'), 'Properties and Code views')
  console.log('Passed: every compared value has an editor on the direct adjustment card, with Merge Studio’s button; the Inspect panel offers Properties and Code.')
} finally { await server.close() }
