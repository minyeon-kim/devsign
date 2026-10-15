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
  assert.ok(tabs.includes('const TABS = VIEWS') && !tabs.includes('data-merge-count'), 'the left view tabs only contain Preview, Screens and Code')
  assert.ok(layout.includes('data-workspace-view-tab="merge"') && layout.indexOf('data-workspace-view-tab="merge"') > layout.indexOf('data-conflict-toggle'), 'Merge sits beside Change Review')
  // One shell: no button in the header, no exit, no second header.
  assert.ok(!topBar.includes('MergeStudioMenu') && !topBar.includes("activeView === 'mergeStudio') return null"), 'the header stays, without its Merge Studio button')
  assert.ok(!view.includes('StudioExit') && !work.includes('data-studio-header-slot'), 'no header of its own')
  assert.ok(page.includes('<WorkspaceSplitLayout studio=') && layout.includes('data-merge-view') && layout.includes('viewCovered='), 'the studio fills the main window; what is under it stays mounted')
  assert.ok(layout.includes('/^Digit[1-4]$/') && layout.includes("at === 3"), '⌘1–4')
  // The address, both ways; the three ways in.
  assert.ok(provider.includes('readMergeParams(location.search)') && provider.includes('withMerge(nowSearch, id)') && provider.includes("setActiveView('mergeStudio')"))
  assert.ok(!read('components/screens/ScreensBoard.jsx').includes('openMergeStudio()'), 'a change picked in the board’s list shows its detail in the panel — the Screens view stays')
  assert.ok(read('components/workspace/WorkspaceDesignCompare.jsx').includes('openMergeStudio(candidate.id)'), '조합하기 starts the selected task explicitly')
  assert.ok(view.includes('data-merge-empty-canvas') && view.includes('startedMergeItemId === selected.id'), 'an unstarted or stale selection draws only an empty grid')
  assert.ok(layout.includes('onClick={openMergeTab}') && provider.includes('setCompositionEditing(false)') && provider.includes('setSelectedMergeItemId(null)'), 'Merge starts at the draft list; composing is an explicit step')
  // The studio's row: the item switcher, the tools; empty / loading / read-only.
  assert.ok(read('components/workspace/MergeContextTitle.jsx').includes('data-merge-switcher') && work.includes('data-merge-skeleton') && work.includes('병합할 변경점이 없어요') && work.includes('data-merge-empty-back') && read('components/workspace/MergeContextTitle.jsx').includes('data-merge-readonly'))
  assert.ok(read('components/mergestudio/MergeInfiniteCanvas.jsx').includes('data-merge-tools') && read('components/mergestudio/MergeInfiniteCanvas.jsx').includes('useContext(WindowHeaderSlotContext)'))
  // The canvas is the Screens canvas's — the ground is #1C1C1C, flush with the tab row: no frame, no gap — and no pill says "n/m 선택" or "결정 n/m" beside what the parts bar says.
  assert.ok(work.includes('data-studio-stage') && work.includes('className="relative flex min-h-0 flex-1 overflow-hidden bg-[#1C1C1C]"') && !/mt-12|rounded-\[20px\]/.test(work.slice(work.indexOf('data-studio-stage'), work.indexOf('data-studio-stage') + 260)), 'flush, on the canvas ground')
  assert.ok(!read('components/mergestudio/MergeInfiniteCanvas.jsx').includes('Decided ${decidedCount}'), 'no decided pill')
  // (The right panel's place: the board's list, not while Merge is up — else Merge's own panel, at the same width.)
  const side = read('components/workspace/CanvasSideViews.jsx')
  assert.ok(side.includes("(activeView !== 'mergeStudio' && boardShown) || (designComparePanelOpen ? 'merge' : false)") && side.split('dockShownOf({ boardShown, activeView, designComparePanelOpen })').length === 2 && side.split('const boardDockShown = useDockShown()').length === 3, 'the board’s list is out of the row while Merge is up')
  // No bottom panel: Design Compare is the left menu (drafts ticked there), the studio fills to the window's foot.
  assert.ok(!work.includes('WorkspaceBottomPanel') && !work.includes('bottomPanelTabs'), 'no bottom panel in the studio')
  assert.ok(read('components/mergestudio/DesignDetail.jsx').includes('data-detail-selection') && read('components/mergestudio/DesignDetail.jsx').includes('data-detail-pick'), 'the drafts are ticked in the sidebar')
  // The drafts are compared once — in the Design Compare sidebar's detail (live, with the picking), not also in a column of the studio.
  assert.ok(!work.includes('DraftCompareBoard') && !work.includes('data-compare-divider') && !work.includes('title="Back to drafts"'), 'no drafts column in the studio')
  assert.ok(work.includes('setMixBridge({') && read('components/mergestudio/DesignDetail.jsx').includes('<DraftCompareBoard embedded') && read('components/mergestudio/DraftCompareBoard.jsx').includes('embedded'), 'the studio publishes the drafts; the sidebar draws and picks from them')
  assert.ok(!read('components/workspace/WorkspaceDesignCompare.jsx').includes('setCompareItemId(null)\n          setSelectedMergeItemId'), 'the detail stays open after 조합하기')
  console.log('Passed: Merge is the fourth view tab of the main window — one shell, one address, two ways in.')
} finally { await server.close() }

{
  const work = read('components/mergestudio/MergeStudioWorkspace.jsx')
  // The change is picked in the Design Compare sidebar, not by a dropdown in the tab row; the skeleton is the canvas's own ground.
  assert.ok(!work.includes('data-merge-item-option') && !work.includes('aria-label="병합 항목 바꾸기"'))
  assert.ok(work.includes('data-merge-skeleton aria-busy="true" aria-label="불러오는 중" className="absolute inset-0 z-50 bg-[#1C1C1C]"'))
  assert.ok(read('components/dashboard/CompareDrawer.jsx').includes("if (activeView === 'mergeStudio') setSelectedMergeItemId(item.id)"))
}
