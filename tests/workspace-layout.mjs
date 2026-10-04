import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { buildFileTree } from '../src/lib/fileTree.js'
import { moveTab, orderedTabs } from '../src/lib/tabOrder.js'

const tree = buildFileTree([
  { id: 'a', name: 'Button.jsx', path: 'src/components/Button.jsx' },
  { id: 'b', name: 'package.json', path: 'package.json' },
  { id: 'c', name: 'theme.css', path: 'styles/theme.css' },
  { id: 'd', name: 'README.md', path: 'README.md' },
  { id: 'e', name: 'Button.jsx', path: 'lib/Button.jsx' },
], (file) => file.id === 'a' ? 'Renamed.jsx' : file.name)
assert.deepEqual(tree.map((n) => n.name), ['lib', 'src', 'styles', 'package.json', 'README.md'])
assert.equal(tree[1].children[0].children[0].path, 'src/components/Renamed.jsx')
assert.equal(tree[0].children[0].file.id, 'e')
assert.deepEqual(buildFileTree([{ id: 'x', name: 'main.ts', path: 'main.ts' }]).map((n) => n.name), ['main.ts'])
const ids = ['files', 'layers', 'assets']
assert.deepEqual(moveTab(ids, 'assets', 'files'), ['assets', 'files', 'layers'])
assert.deepEqual(moveTab(ids, 'files', 'assets', true), ['layers', 'assets', 'files'])
assert.equal(moveTab(ids, 'missing', 'files'), ids)
assert.equal(moveTab(ids, 'files', 'layers'), ids)
assert.deepEqual(orderedTabs([{ key: 'files' }, { key: 'layers' }, { key: 'assets' }], ['gone', 'assets']).map((i) => i.key), ['assets', 'files', 'layers'])

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { createElement } = await import('react')
  const { MemoryRouter } = await import('react-router-dom')
  const { renderToString } = await import('react-dom/server')
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Explorer } = await server.ssrLoadModule('/src/components/dockview/panels/ExplorerPanel.jsx')
  const { default: BottomPanel } = await server.ssrLoadModule('/src/components/workspace/WorkspaceBottomPanel.jsx')
  const render = (Component) => renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null,
    createElement(WorkspaceProvider, { projectId: 'checkout-redesign' }, createElement(Component)))))
  const { allConflictRecords, isQueuedConflict, conflictCounts, gitFlowOf } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const draft = allConflictRecords().find(c => c.id === 'cc-13')
  assert.equal(isQueuedConflict(draft), false, 'unsubmitted design drafts stay out of the conflict queue')
  const submitted = { ...draft, submittedForMergeAt: 1 }
  assert.equal(isQueuedConflict(submitted), true)
  assert.equal(conflictCounts([draft]).total, 0)
  assert.equal(conflictCounts([submitted]).notRequested, 1)
  assert.equal(gitFlowOf({ id: 'cc-4' }).source, 'hotfix/mobile-nav-icon', 'existing saved records also get seeded branch metadata')
  const explorer = render(Explorer)
  assert.ok(explorer.includes('role="tree"'))
  assert.ok(explorer.includes('aria-label="components"'))
  assert.ok(explorer.includes('aria-label="checkout"'))
  assert.ok(explorer.includes('PlaceOrderButton.jsx'))
  const bottom = render(BottomPanel)
  assert.equal((bottom.match(/aria-label="Bottom panel"/g) ?? []).length, 1)
  assert.equal((bottom.match(/aria-label="Resize bottom panel"/g) ?? []).length, 1)
  assert.ok(bottom.includes('role="tablist"'))
  assert.ok(bottom.includes('role="tabpanel"'))
  assert.ok(!bottom.includes('Maximize panel'))
  console.log('Passed: path-based file tree, rename/root handling, tab reordering and panel render checks.')
} finally {
  await server.close()
}
