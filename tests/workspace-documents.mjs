import assert from 'node:assert/strict'
import { answerDocumentQuestion, documentTarget, openWorkspaceDocument } from '../src/lib/workspaceDocuments.js'

const doc = { id: 'backend', title: 'Backend guide', summary: 'Service conventions', blocks: [
  { type: 'h2', text: 'Authentication' },
  { type: 'p', text: 'Tokens expire after 15 minutes.' },
  { type: 'h2', text: 'Database' },
  { type: 'table', columns: ['Table', 'Key'], rows: [['users', 'user_id']] },
] }
assert.equal(documentTarget(doc).docId, 'backend')
assert.match(answerDocumentQuestion(doc, 'tokens'), /15 minutes/)
assert.doesNotMatch(answerDocumentQuestion(doc, 'tokens'), /user_id/)
assert.match(answerDocumentQuestion(doc, 'database'), /user_id/)
assert.match(answerDocumentQuestion(doc, '요약해줘'), /Authentication/)
assert.match(answerDocumentQuestion(doc, 'billing'), /일치하는 내용을 찾지 못했습니다/)
assert.match(answerDocumentQuestion(null, 'question'), /찾을 수 없습니다/)
let adds = 0
let activated = false
let moved
let saved
const api = {
  getPanel(id) { return id === saved?.id ? { api: { setActive() { activated = true } } } : id === 'editor' ? { group: { id: 'group1' } } : null },
  addPanel(options) { adds++; saved = options; return options },
  dockPanel(...args) { moved = args },
}
openWorkspaceDocument(api, doc, { referencePanel: 'editor', direction: 'right' })
assert.equal(saved.component, 'document')
assert.equal(saved.params.docId, doc.id)
assert.equal(saved.position.direction, 'right')
openWorkspaceDocument(api, doc, { referencePanel: 'editor', direction: 'within' })
assert.equal(adds, 1)
assert.equal(activated, true)
assert.deepEqual(moved, ['document:backend', 'group1', 'center'])
console.log('workspace document docking and grounded answers passed')
