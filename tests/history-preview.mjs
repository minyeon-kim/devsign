import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { writeDemo } = await server.ssrLoadModule('/src/lib/demoStorage.js')
  globalThis.localStorage = new class { getItem(k) { return this[k] ?? null } setItem(k, v) { this[k] = String(v) } }()
  const { canvasPages, projects } = await server.ssrLoadModule('/src/data/mockData.js')
  const projectId = 'checkout-redesign'
  const page = canvasPages.find(p => p.projectId === projectId)
  const layer = page.frames.flatMap(f => f.layers).find(l => l.type === 'button')
  assert.ok(layer)
  writeDemo(`project:${projectId}:prototypeEdits`, { [layer.id]: { fill: '#123abc' } })
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Preview } = await server.ssrLoadModule('/src/components/dockview/panels/PreviewPanelContent.jsx')
  const render = child => renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId }, child))))
  assert.match(render(createElement(Preview)), /#123abc/, 'live preview includes current edits')
  assert.doesNotMatch(render(createElement(Preview, { historical: true })), /#123abc/, 'old snapshots never inherit current edits')
  assert.match(render(createElement(Preview, { historical: true, prototypeEdits: { [layer.id]: { fill: '#abc123' } } })), /#abc123/, 'recorded edits are rendered')
  const { default: ProjectCard } = await server.ssrLoadModule('/src/components/projects/ProjectCard.jsx')
  const project = projects.find(p => p.id === projectId)
  for (const view of ['grid', 'list']) {
    // The whole card is the way in — no separate Workspace link — and its
    // counts are badges that open the project's Conflict list; none at zero.
    const html = render(createElement(ProjectCard, { project, view, counts: { needsMyReview: 2, open: 3 } }))
    assert.doesNotMatch(html, /href="\/projects\/checkout-redesign\/workspace"/, 'no separate Workspace link')
    assert.match(html, /after:inset-0/, 'the card is one click target')
    assert.equal(html.match(/data-card-badge/g)?.length, 2, 'review and conflict badges')
    assert.doesNotMatch(render(createElement(ProjectCard, { project, view, counts: { needsMyReview: 0, open: 0 } })), /data-card-badge/, 'no badge at zero')
  }
  console.log('Passed: historical preview isolation, recorded preview edits, and project cards as one click target with count badges in grid/list views.')
} finally { delete globalThis.localStorage; await server.close() }
