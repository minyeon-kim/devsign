import assert from 'node:assert/strict'
import { backendReferenceDocs } from '../src/data/backendDocs.js'
import { buildDocTree, countDocs, docPath, searchDocs } from '../src/lib/docCategories.js'

const docs = [...backendReferenceDocs, { id: 'generated-doc', title: 'New button spec', type: 'spec', dsUpdateId: 'update-1', blocks: [] }]
assert.equal(searchDocs(docs, '   '), docs)
assert.deepEqual(searchDocs(docs, 'DATABASE SCHEMA'), searchDocs(docs, 'database schema'))
assert.ok(searchDocs(docs, 'database schema').some((d) => d.id === 'doc-database-schema'))
assert.ok(searchDocs(docs, '백엔드').length === 4)
assert.ok(searchDocs(docs, 'outbox').some((d) => d.id === 'doc-database-schema'))
assert.ok(searchDocs(docs, 'Engineering Backend').length === 4)
assert.deepEqual(searchDocs(docs, 'no-such-document'), [])
const tree = buildDocTree(docs)
assert.equal(tree.reduce((sum, node) => sum + countDocs(node), 0), docs.length)
assert.deepEqual(docPath(tree, 'doc-database-schema'), ['Engineering', 'Database'])
assert.deepEqual(docPath(tree, 'generated-doc'), ['Component specs', 'Design system updates'])
assert.equal(new Set(docs.map((d) => d.id)).size, docs.length)
console.log('Passed: docs title/body/category search, Korean keywords, empty queries, no results and category placement.')
