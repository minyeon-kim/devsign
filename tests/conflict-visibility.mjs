import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { allConflictRecords, restoreCodeConflicts, toConflictRecord } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { conflictTypeOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { default: Preview } = await server.ssrLoadModule('/src/components/conflicts/ChangePreview.jsx')
  const records = allConflictRecords()
  const code = records.find((record) => record.id === 'CON-025')
  assert.ok(code)
  assert.equal(conflictTypeOf(code).id, 'code-conflict')
  assert.equal(conflictTypeOf({ title: 'Frame update', diff: code.diff }).id, 'code-conflict')
  const saved = records.filter((record) => record.id !== code.id)
  const restored = restoreCodeConflicts(saved)
  assert.equal(restored.filter((record) => record.id === code.id).length, 1)
  const reviewed = restored.map((record) => record.id === code.id ? { ...record, reviewStage: 'resolved' } : record)
  assert.equal(restoreCodeConflicts(reviewed).find((record) => record.id === code.id).reviewStage, 'resolved')
  for (const record of records.filter((record) => record.comparisonFields?.length)) {
    const migrated = toConflictRecord({ ...record, preview: undefined })
    assert.ok(migrated.preview, `${record.id} has a preview after loading old storage`)
    assert.ok(renderToStaticMarkup(createElement(Preview, { preview: migrated.preview, side: 'before' })).length)
    assert.ok(renderToStaticMarkup(createElement(Preview, { preview: migrated.preview, side: 'after' })).length)
  }
  const { MemoryRouter } = await import('react-router-dom')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: Panel } = await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null,
    createElement(WorkspaceProvider, { projectId: code.projectId }, createElement(Panel, { conflict: code, onOpenChange() {} })))))
  // (A merge of code is reviewed by developers: to the designer viewing it — not hers — it's read-only: the two
  // sides said, the file, and nothing to pick, approve or remind.)
  assert.ok(html.includes('src/components/DesignCanvas.jsx') && html.includes('프레임 선택 처리') && html.includes('프레임 식별 키 추가'))
  assert.ok(!html.includes('data-code-conflict') && !html.includes('data-approval-approve') && !html.includes('data-approval-remind'))
  const { useConflictList } = await server.ssrLoadModule('/src/components/conflicts/useConflictList.js')
  function ListProbe() {
    const list = useConflictList()
    return createElement('div', null, list.visible.map((record) => createElement('span', { key: record.id }, record.id)))
  }
  for (const projectId of ['checkout-redesign']) {
    const listHtml = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null,
      createElement(WorkspaceProvider, { projectId }, createElement(ListProbe)))))
    const samples = records.filter((record) => record.kind === 'code-conflict' && /^CON-/.test(record.id) && record.projectId === projectId)
    assert.ok(samples.length > 0)
    for (const sample of samples) {
      assert.ok(listHtml.includes(sample.id), `${sample.id} appears in the actual conflict list`)
      assert.equal(conflictTypeOf(sample).id, 'code-conflict')
      assert.ok(sample.diff.before.some((line) => line.startsWith('<<<<<<<')))
    }
  }
  console.log('Passed: design previews, persisted record migration, code-conflict classification and rendered conflict/resolution code.')
} finally { await server.close() }
