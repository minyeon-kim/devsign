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
assert.deepEqual(docPath(tree, 'generated-doc'), ['Process', 'Document updates'])
assert.equal(new Set(docs.map((d) => d.id)).size, docs.length)
console.log('Passed: docs title/body/category search, Korean keywords, empty queries, no results and category placement.')

const { documentCategoryOptions, suggestedDocumentCategory, validDocumentCategory } = await import('../src/lib/docCategories.js')
assert.equal(suggestedDocumentCategory({ title: 'Database migration strategy' }), 'database')
assert.equal(suggestedDocumentCategory({ title: 'Backend API authentication' }), 'backend')
assert.equal(suggestedDocumentCategory({ title: 'Button variants' }), 'inputs')
assert.equal(suggestedDocumentCategory({ title: 'Color tokens' }), 'foundations')
assert.equal(suggestedDocumentCategory({ title: 'Database migration', categoryId: 'quality' }), 'quality')
assert.equal(validDocumentCategory('not-a-category'), false)
assert.deepEqual(documentCategoryOptions().find(c => c.id === 'database').path, ['Engineering', 'Database'])
const generated = { id: 'new-schema-doc', title: 'New schema', type: 'doc', docUpdateId: 'update-2', categoryId: 'database', blocks: [] }
assert.deepEqual(docPath(buildDocTree([...docs, generated]), generated.id), ['Engineering', 'Database'])
assert.deepEqual(docPath(buildDocTree([{ ...generated, categoryId: 'quality' }]), generated.id), ['Process', 'Quality & release'])
assert.deepEqual(docPath(buildDocTree([{ ...generated, categoryId: 'invalid' }]), generated.id), ['Process', 'Document updates'])
assert.equal(searchDocs([generated], 'Engineering Database').length, 1)
console.log('Passed: destination recommendations, custom paths, invalid category fallback and categorized generated-doc search.')
