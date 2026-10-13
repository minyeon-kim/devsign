// A change's detail has an address (lib/changeLink): everything that opens one
// goes to /projects/:id/workspace?change=<id>, so it survives a reload, can be
// shared, and Back closes it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const l = await server.ssrLoadModule('/src/lib/changeLink.js')
  assert.equal(l.changeHref('dashboard-redesign', 'CON-002'), '/projects/dashboard-redesign/workspace?change=CON-002')
  assert.equal(l.changeHref('p', 'CON-1', { evidence: 'h-9', source: 'token:color.primary' }), '/projects/p/workspace?change=CON-1&evidence=h-9&source=token%3Acolor.primary')
  assert.equal(l.changeHref('p', 'CON-1', { source: 'x' }), '/projects/p/workspace?change=CON-1', 'a source only goes with its checkpoint')
  assert.equal(l.changesHref('p', 'mine'), '/projects/p/workspace?changes=mine')
  assert.deepEqual(l.readChangeParams('?change=CON-2&evidence=h-1&source=comment%3Ac-3'), { change: 'CON-2', evidence: 'h-1', source: 'comment:c-3', changes: null })
  assert.deepEqual(l.readChangeParams(''), { change: null, evidence: null, source: null, changes: null })
  // Opening and closing keep whatever else the address says.
  assert.equal(l.withChange('?changes=mine', 'CON-2'), '?changes=mine&change=CON-2')
  assert.equal(l.withChange('?change=CON-1&evidence=h-1&source=a%3Ab&tab=x', 'CON-2'), '?tab=x&change=CON-2', 'another change: the last one\'s source goes with it')
  assert.equal(l.withChange('?change=CON-1&evidence=h-1', null), '')
  assert.equal(l.withChange('?tab=x&change=CON-1', null), '?tab=x')
  // Closing: back when it was pushed here, else the parameter is taken off in place.
  assert.deepEqual([l.closeHowOf({ changePushed: true }), l.closeHowOf(null), l.closeHowOf({})], ['back', 'replace', 'replace'])
  assert.deepEqual([l.sourceKeyOf({ kind: 'comment', id: 'c-1' }), l.sourceKeyOf({ kind: 'figma', label: 'Frame' }), l.sourceKeyOf(null)], ['comment:c-1', 'figma:Frame', null])
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// No way in passes the intent through router state any more.
const sources = ['src/pages/WorkspacePage.jsx', 'src/pages/ProjectOverviewPage.jsx', 'src/components/layout/NotificationsMenu.jsx', 'src/components/dashboard/ConflictsDrawer.jsx', 'src/components/history/HistoryCompare.jsx', 'src/components/history/RollbackCheckpointModal.jsx', 'src/components/projects/ProjectCard.jsx']
for (const file of sources) assert.ok(!/openConflictId|state: \{ conflictFilter|fromNotification/.test(read(file)), `${file} still passes the change through router state`)
for (const file of sources.slice(1)) assert.ok(/changeHref\(|changesHref\(/.test(read(file)), `${file} links to the change's address`)
// The provider: the address is what's shown; pushed here, replaced when switching, back or replace to close.
const provider = read('src/state/WorkspaceProvider.jsx')
assert.ok(provider.includes("if (changeParam) { setReviewConflictId(changeParam); setReviewView('overlay') }"))
// (Replaced over any layer that's already open — another change, or a document: tests/doc-link.mjs.)
assert.ok(provider.includes("search: withChange(withoutDoc(at.search), id, { evidence, source }) }, anyLayer ? { replace: true, state: at.state } : { state: { changePushed: true } }"))
assert.ok(provider.includes("if (closeHowOf(at.state) === 'back') navigate(-1)") && provider.includes('search: withChange(at.search, null) }, { replace: true, state: null }'))
// The Workspace reads it: the filter, and a link's arrival (with a History source found again by id).
const page = read('src/pages/WorkspacePage.jsx')
assert.ok(page.includes('readChangeParams(location.search)') && page.includes("setBottomPanel({ open: true, tab: 'conflict', conflictFilter: listFilter })"))
assert.ok(page.includes('checkpointRationale(entry, [conflict], comments).evidence.find((candidate) => sourceKeyOf(candidate) === sourceKey)'))
console.log('change-link: ok')

// ── One way to open: full screen with the left list; Merge Studio's bottom panel is the exception, said by name. ──
{
  const provider = read('src/state/WorkspaceProvider.jsx')
  assert.ok(provider.includes("const openConflictReview = useCallback((id, { view = 'overlay', evidence = null, source = null } = {}) => {"), 'a change opens full screen unless asked otherwise')
  assert.ok(provider.includes("const openConflictFromNotification = useCallback((id) => { if (id) openConflictReview(id) }, [openConflictReview])"), 'a notification\'s way in is the one way in')
  // Open full screen ⇒ the Workspace's own view, the left list, the change's pin — however it got there.
  const rule = provider.slice(provider.indexOf('const openedChange = useRef(null)'), provider.indexOf('  const value = {'))
  assert.ok(['exitMergeStudio()', 'requestConflictDrawer(record.id)', 'focusConflictPin(record)'].every((call) => rule.includes(call)))
  // The exception, where it's made.
  const named = { 'src/components/mergestudio/MergeStudioWorkspace.jsx': 2, 'src/components/mergestudio/MergeInfiniteCanvas.jsx': 2, 'src/pages/WorkspacePage.jsx': 1, 'src/components/chat/ChatConversation.jsx': 1 }
  for (const [file, count] of Object.entries(named)) assert.equal((read(file).match(/openConflictReview\([^)]*\{ view: 'panel' \}\)/g) ?? []).length, count, `${file}: the bottom panel's detail, by name`)
  assert.ok(read('src/components/mergestudio/DesignComparison.jsx').includes("const reviewIn = inMergeStudio ? { view: 'panel' } : undefined"))
  // Nothing else asks for the panel, and nothing opens the bottom list on the way.
  for (const file of ['src/components/conflicts/CheckDecisions.jsx', 'src/pages/ProjectOverviewPage.jsx', 'src/components/layout/TopBar.jsx']) assert.ok(!/view: 'panel'/.test(read(file)), `${file} opens a change in the panel`)
  assert.ok(!/setBottomPanel\(\{ open: true, tab: 'conflict' \}\)\s*\n\s*openConflictReview\(conflict\.id\)/.test(read('src/components/conflicts/CheckDecisions.jsx')))
  // Outside Merge Studio the bottom tabs are lists alone.
  assert.ok(read('src/components/dockview/panels/ConflictPanel.jsx').includes("if (inMergeStudio && reviewConflict && reviewView === 'panel') return"))
  assert.ok(read('src/components/mergestudio/DesignComparison.jsx').includes("if (activeReview && inMergeStudio && reviewView === 'panel') return"))
  console.log('change-link (one way in): ok')
}

// ── The detail's path: 워크스페이스 › 확인할 변경점 — its first item goes where Close goes. ──
{
  const overlay = read('src/components/conflicts/ConflictReviewOverlay.jsx')
  assert.ok(overlay.includes("<Breadcrumb items={[{ label: 'Workspace', onClick: () => openConflictReview(null) }, { label: 'Conflicts', onClick: () => requestConflictDrawer(conflict.id) }]} />"))
  assert.ok(overlay.includes('onClick={() => openConflictReview(null)}') && !overlay.includes('projectCrumbs'), 'Close and the first item do the same thing; the project isn\'t in the path')
  assert.ok(overlay.includes('<BreadcrumbBar className="h-16 pt-0" rowClassName="h-12">'), 'the bar is where it was')
  // Where you are stays marked when it's pressable.
  assert.ok(read('src/components/layout/Breadcrumb.jsx').includes('<button type="button" aria-current="page" onClick={item.onClick}'))
  console.log('change-link (path): ok')
}

// ── The global home is "Home" wherever it's named; the project home's rows and counts are links to the address. ──
{
  assert.ok(read('src/components/layout/Breadcrumb.jsx').includes("{ label: 'Home', to: '/dashboard' }"))
  const rail = read('src/components/dashboard/Sidebar.jsx')
  assert.ok(rail.includes("{ id: 'home', label: 'Home', icon: House, path: '/dashboard' }") && rail.includes('<RailButton label="Home" icon={House} render={<Link to="/dashboard" />} />') && !rail.includes('label="Dashboard"'))
  assert.ok(read('src/i18n/ko.js').includes('\nHome|홈\n'))
  const home = read('src/pages/ProjectOverviewPage.jsx')
  assert.ok(home.includes('navigate(changeHref(project.id, conflict.id))') && home.includes('navigate(changesHref(project.id, filter))') && !home.includes('setBottomPanel'), 'the project home sends to the address — nothing of its own')
  console.log('change-link (home): ok')
}

// ── Found while opening a change from each way in ──
{
  // The filter is applied when the address first names it — not again on every change of the address (it would
  // re-open the bottom list and close the left one beside a detail).
  const page = read('src/pages/WorkspacePage.jsx')
  assert.ok(page.includes('if (appliedFilter.current === listFilter) return') && page.includes('if (changeId) { setBottomPanel({ conflictFilter: listFilter }); return }'))
  // The bottom list folds in the same step the left one is asked for.
  const provider = read('src/state/WorkspaceProvider.jsx')
  const rule = provider.slice(provider.indexOf('const openedChange = useRef(null)'), provider.indexOf('  const value = {'))
  assert.ok(rule.indexOf("prev.open && prev.tab === 'conflict' ? { ...prev, open: false } : prev") > 0 && rule.indexOf("prev.open && prev.tab === 'conflict'") < rule.indexOf('requestConflictDrawer(record.id)'))
  console.log('change-link (lists): ok')
}
