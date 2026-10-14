import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Merge Studio is the fourth view of the main window: a "병합" tab (with the open changes beside it) after
// Preview · Screens · Code, in the same shell — the app header and the rail stay, the studio has no header of
// its own — at `?view=merge&item=<mergeItemId>`.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { MERGE_VIEW, readMergeParams, readViewParams, withMerge, withView } = await server.ssrLoadModule('/src/lib/viewLink.js')
  assert.equal(MERGE_VIEW, 'merge')
  assert.deepEqual(readMergeParams('?view=merge&item=x&screen=a'), { open: true, item: 'x' })
  assert.deepEqual(readMergeParams('?view=screens'), { open: false, item: null })
  assert.equal(withMerge('?screen=a', 'x'), '?screen=a&view=merge&item=x')
  assert.equal(withMerge('?view=merge&item=x&screen=a', null), '?screen=a', 'put away: the rest of the address stays')
  assert.equal(withMerge('?view=screens', 'x'), '?view=merge&item=x')
  assert.equal(readViewParams('?view=merge').view, null, 'not one of the three views: the last one stays underneath')
  assert.equal(withView('?view=merge&item=x', { view: 'code' }), '?view=code&item=x', 'picking another tab replaces it')

  const tabs = read('components/workspace/WorkspaceViewTabs.jsx')
  const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
  const page = read('pages/WorkspacePage.jsx')
  const topBar = read('components/layout/TopBar.jsx')
  const view = read('components/mergestudio/MergeStudioView.jsx')
  const work = read('components/mergestudio/MergeStudioWorkspace.jsx')
  const provider = read('state/WorkspaceProvider.jsx')
  // The tab: after Code, text only, the open count beside it (none at 0), the same segment as the others.
  assert.ok(tabs.includes("const TABS = [...VIEWS, 'merge']") && tabs.includes('data-merge-count') && tabs.includes('unresolved > 0') && !/lucide/.test(tabs), 'four tabs, a count, no icon')
  // One shell: no button in the header, no exit, no second header.
  assert.ok(!topBar.includes('MergeStudioMenu') && !topBar.includes("activeView === 'mergeStudio') return null"), 'the header stays, without its Merge Studio button')
  assert.ok(!view.includes('StudioExit') && !work.includes('data-studio-header-slot'), 'no header of its own')
  assert.ok(page.includes('<WorkspaceSplitLayout studio=') && layout.includes('data-merge-view') && layout.includes('viewCovered='), 'the studio fills the main window; what is under it stays mounted')
  assert.ok(layout.includes('/^Digit[1-4]$/') && layout.includes("at === 3"), '⌘1–4')
  // The address, both ways; the three ways in.
  assert.ok(provider.includes('readMergeParams(location.search)') && provider.includes('withMerge(at.search, id)') && provider.includes("setActiveView('mergeStudio')"))
  assert.ok(read('components/screens/ScreensBoard.jsx').includes('setSelectedMergeItemId(item.id); openMergeStudio()'), 'a change in the list opens its merge item')
  assert.ok(read('components/workspace/WorkspaceDesignCompare.jsx').includes('openMergeStudio()'), '조합하기 opens it')
  // The studio's row: the item switcher, the tools; empty / loading / read-only.
  assert.ok(work.includes('data-merge-switcher') && work.includes('data-merge-skeleton') && work.includes('병합할 변경점이 없어요') && work.includes('data-merge-empty-back') && work.includes('data-merge-readonly'))
  assert.ok(read('components/mergestudio/MergeInfiniteCanvas.jsx').includes('data-merge-tools') && read('components/mergestudio/MergeInfiniteCanvas.jsx').includes('useContext(WindowHeaderSlotContext)'))
  console.log('Passed: Merge is the fourth view tab of the main window — one shell, one address, three ways in.')
} finally { await server.close() }
