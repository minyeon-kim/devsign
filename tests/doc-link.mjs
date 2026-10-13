// Docs have an address the way a change's detail does (lib/docLink): a layer
// over the Workspace at ?doc=<id> / ?docs=index / ?docs=updates — so a
// document survives a reload, can be shared, and Back closes it.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const d = await server.ssrLoadModule('/src/lib/docLink.js')
  const c = await server.ssrLoadModule('/src/lib/changeLink.js')
  // The addresses.
  assert.equal(d.docHref('dashboard-redesign', 'brand-guide'), '/projects/dashboard-redesign/workspace?doc=brand-guide')
  assert.equal(d.docsHref('p'), '/projects/p/workspace?docs=index')
  assert.equal(d.docsHref('p', 'updates'), '/projects/p/workspace?docs=updates')
  assert.equal(d.docsHref('p', 'nonsense'), '/projects/p/workspace?docs=index')
  // Reading one.
  assert.deepEqual(d.readDocParams('?doc=brand-guide'), { doc: 'brand-guide', docs: null })
  assert.deepEqual(d.readDocParams('?docs=updates'), { doc: null, docs: 'updates' })
  assert.deepEqual(d.readDocParams('?docs=other'), { doc: null, docs: null }, 'only the views there are')
  assert.deepEqual(d.readDocParams('?doc=a&docs=index'), { doc: 'a', docs: null }, 'a document wins over a list')
  assert.deepEqual(d.readDocParams(''), { doc: null, docs: null })
  // Opening and closing keep whatever else the address says…
  assert.equal(d.withDoc('?changes=mine', { doc: 'a' }), '?changes=mine&doc=a')
  assert.equal(d.withDoc('?doc=a', { doc: 'b' }), '?doc=b')
  assert.equal(d.withDoc('?doc=a', { docs: 'index' }), '?docs=index')
  assert.equal(d.withDoc('?docs=updates&tab=x', null), '?tab=x')
  assert.equal(d.withDoc('?doc=a', null), '')
  // …except the other layer: a document and a change's detail are never open together.
  assert.equal(d.withDoc('?change=CON-2&evidence=h-1&source=a%3Ab', { doc: 'a' }), '?doc=a', 'opening a document closes the change')
  assert.equal(d.withDoc('?change=CON-2', { docs: 'updates' }), '?docs=updates')
  assert.equal(d.withDoc('?change=CON-2&doc=a', null), '?change=CON-2', 'closing the docs layer leaves a change alone')
  assert.equal(c.withChange(d.withoutDoc('?doc=a&changes=mine'), 'CON-2'), '?changes=mine&change=CON-2', 'opening a change closes the document')
  assert.equal(d.withoutDoc('?docs=index'), '')
  // Closing: the same rule and the same mark in history as a change's.
  assert.equal(d.closeHowOf, c.closeHowOf)
  assert.deepEqual([d.closeHowOf({ changePushed: true }), d.closeHowOf(null)], ['back', 'replace'])
  // Old /docs links (the view in router state) land on the address that means the same.
  assert.equal(d.legacyDocsHref('p', { docId: 'api-spec' }), '/projects/p/workspace?doc=api-spec')
  assert.equal(d.legacyDocsHref('p', { tab: 'dsUpdates' }), '/projects/p/workspace?docs=updates')
  assert.equal(d.legacyDocsHref('p', null), '/projects/p/workspace?docs=index')
  assert.equal(d.legacyDocsHref('p', { tab: 'history' }), '/projects/p/workspace?docs=index')
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// The old route is a redirect; the page is gone; nothing passes a document through router state.
const app = read('src/App.jsx')
assert.ok(app.includes('<Route path="docs" element={<DocsRedirect />} />') && app.includes('<Navigate to={legacyDocsHref(projectId, state)} replace />'))
assert.ok(!existsSync(new URL('../src/pages/DocsPage.jsx', import.meta.url)), 'DocsPage is a layer now')
for (const file of ['src/components/dashboard/DocsDrawer.jsx', 'src/pages/ProjectOverviewPage.jsx', 'src/components/docs/DocsOverlay.jsx']) {
  const text = read(file)
  assert.ok(!/state=\{\{ docId|state: \{ docId|tab: 'dsUpdates'|keepDrawer|\/docs`/.test(text), `${file} still goes to the old docs route`)
}
assert.ok(/docHref\(project\.id, doc\.id\)/.test(read('src/pages/ProjectOverviewPage.jsx')) && read('src/pages/ProjectOverviewPage.jsx').includes("docsHref(project.id, 'index')"))
// The provider: the address is what's shown; pushed here, replaced over an open layer, back or replace to close.
const provider = read('src/state/WorkspaceProvider.jsx')
assert.ok(provider.includes("const docLayer = onWorkspace && !changeParam ? readDocParams(location.search) : { doc: null, docs: null }"), 'a change\'s detail wins when an address names both')
assert.ok(provider.includes("search: withDoc(at.search, target) }, anyLayer ? { replace: true, state: at.state } : { state: { changePushed: true } }"))
assert.ok(provider.includes("else navigate({ pathname: at.pathname, search: withDoc(at.search, null) }, { replace: true, state: null })"))
assert.ok(provider.includes('search: withChange(withoutDoc(at.search), id, { evidence, source }) }, anyLayer ?'), 'opening a change takes the document off the address')
// The rail's Docs button is on by the address, not by a path.
assert.ok(read('src/components/dashboard/Sidebar.jsx').includes('Boolean(docLayer.doc || docLayer.docs)') && !read('src/components/dashboard/Sidebar.jsx').includes('`${base}/docs`'))
// The layer is the Workspace's, beside the change's detail.
assert.ok(read('src/pages/WorkspacePage.jsx').includes('<DocsOverlay />'))
console.log('doc-link: ok')

// ── The layer's structure: the Workspace's, with the Docs drawer beside it — as a change's detail has its list. ──
{
  const overlay = read('src/components/docs/DocsOverlay.jsx')
  assert.ok(overlay.includes('className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card') && overlay.includes('animate-in fade-in duration-150'), 'the same layer as the change\'s detail: over the work area, same level, same surface')
  assert.ok(read('src/components/conflicts/ConflictReviewOverlay.jsx').includes('className="absolute inset-0 z-[650] flex min-h-0 flex-col bg-card animate-in fade-in duration-150'))
  const provider = read('src/state/WorkspaceProvider.jsx')
  const rule = provider.slice(provider.indexOf('const openedDocs = useRef(false)'), provider.indexOf('  const value = {'))
  assert.ok(rule.includes('exitMergeStudio()') && rule.includes('requestDocsDrawer()'), 'open ⇒ the Workspace\'s own view and the Docs drawer')
  const shell = read('src/components/dashboard/AppShell.jsx')
  assert.ok(shell.includes("if (docsDrawerRequest && docsDrawerRequest !== handledDocsRequest) {") && shell.includes("setDrawer('docs')"))
  // A document can still be dragged from the drawer into the Workspace as a panel.
  const drawer = read('src/components/dashboard/DocsDrawer.jsx')
  assert.ok(drawer.includes('draggable') && drawer.includes('event.dataTransfer.setData(DOCUMENT_DRAG_TYPE, doc.id)'))
  console.log('doc-link (structure): ok')
}

// ── The top bar: the change detail's own — same place, same height, same Close; the path says where this is. ──
{
  const overlay = read('src/components/docs/DocsOverlay.jsx')
  const change = read('src/components/conflicts/ConflictReviewOverlay.jsx')
  const BAR = '<BreadcrumbBar className="h-16 pt-0" rowClassName="h-12">'
  assert.ok(overlay.includes(BAR) && change.includes(BAR))
  const CLOSE = 'className="ds-intrinsic ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"'
  assert.ok(overlay.includes(CLOSE) && change.includes(CLOSE), 'the same Close button')
  assert.ok(overlay.includes("title={`${translateText('Close', language)} · Esc`}"))
  // 워크스페이스 › 문서 (› 문서 업데이트): the first item closes, as Close does; the project and the categories aren't in it.
  assert.ok(overlay.includes("{ label: 'Workspace', onClick: closeDocs }") && overlay.includes('onClick={closeDocs}'))
  assert.ok(overlay.includes("[{ label: 'Docs', onClick: toIndex }, { label: 'Document updates' }]") && overlay.includes(": [{ label: 'Docs', onClick: toIndex }]"))
  assert.ok(!overlay.includes('projectCrumbs') && overlay.includes("requestDocsDrawer(); if (view.kind !== 'index') openDocs({ docs: 'index' })"))
  // The category path is the document's own meta line.
  assert.ok(overlay.includes('path={docPath(tree, view.doc.id) ?? []}') && read('src/components/archive/ReferenceDocView.jsx').includes('data-doc-path'))
  // Esc and focus, as the change's detail does.
  for (const text of [overlay, change]) assert.ok(text.includes(`document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]')`) && text.includes('closeRef.current?.focus()') && text.includes('if (before instanceof HTMLElement && before.isConnected) before.focus()'))
  console.log('doc-link (top bar): ok')
}

// ── The content starts on the path's line: the list, a document and the updates sit in the page's column. ──
{
  const overlay = read('src/components/docs/DocsOverlay.jsx')
  assert.ok(overlay.includes("const COLUMN = cn(BREADCRUMB_COLUMN, 'pt-2 pb-10')"), 'the path\'s column, 8px under the bar — where a change\'s detail has its title row')
  assert.ok(overlay.includes('<div data-docs-index className={COLUMN}>') && overlay.includes('<div className="-mx-3 max-w-3xl">'), 'the list: its rows\' own inset is taken back, so their text starts on the line')
  assert.ok(overlay.includes("frameClassName={cn(COLUMN, 'flex gap-8')}") && overlay.includes('<div className={COLUMN}><DesignSystemUpdates onOpenDoc={openDoc} onOpenHistory={openHistory} className="px-0 py-0" /></div>'))
  assert.ok(!/max-w-3xl px-6 py-5/.test(overlay))
  // A document keeps its reading width and its contents list; as a Workspace panel it keeps its own centred frame.
  const view = read('src/components/archive/ReferenceDocView.jsx')
  assert.ok(view.includes("const DOC_FRAME = 'mx-auto flex max-w-5xl gap-8 px-5 py-8 @min-[960px]/doc:px-8 @min-[960px]/doc:py-10'") && view.includes('frameClassName = DOC_FRAME') && view.includes('<article className="min-w-0 max-w-[680px] flex-1">'))
  assert.ok(read('src/components/dockview/panels/DocumentPanel.jsx').includes('<ReferenceDocView doc={doc} />'))
  console.log('doc-link (alignment): ok')
}
