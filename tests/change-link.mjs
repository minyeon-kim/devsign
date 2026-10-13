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
assert.ok(provider.includes("shown ? { replace: true, state: at.state } : { state: { changePushed: true } }"))
assert.ok(provider.includes("if (closeHowOf(at.state) === 'back') navigate(-1)") && provider.includes('search: withChange(at.search, null) }, { replace: true, state: null }'))
// The Workspace reads it: the filter, and a link's arrival (with a History source found again by id).
const page = read('src/pages/WorkspacePage.jsx')
assert.ok(page.includes('readChangeParams(location.search)') && page.includes("setBottomPanel({ open: true, tab: 'conflict', conflictFilter: listFilter })"))
assert.ok(page.includes('checkpointRationale(entry, [conflict], comments).evidence.find((candidate) => sourceKeyOf(candidate) === sourceKey)'))
console.log('change-link: ok')
