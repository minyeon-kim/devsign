import assert from 'node:assert/strict'
import { affectedDocuments, nextDocumentChange, canProcessDocumentChange, mergeDocumentUpdate } from '../src/lib/documentChanges.js'
const first = { id: 'first', stage: 'update' }
const second = { id: 'second', stage: 'update' }
assert.equal(nextDocumentChange([first, second]).id, 'first')
assert.equal(canProcessDocumentChange([first, second], 'second', 'update'), false)
assert.equal(canProcessDocumentChange([{ ...first, stage: 'documented' }, second], 'second', 'update'), false)
assert.equal(canProcessDocumentChange([{ ...first, stage: 'documented' }, second], 'first', 'documented'), true)
assert.equal(canProcessDocumentChange([{ ...first, stage: 'archived' }, second], 'second', 'update'), true)
const docs = [{ id: 'doc-api', title: 'Backend API' }, { id: 'doc-db', title: 'Database schema' }, { id: 'doc-brand', title: 'Brand guidelines' }, { id: 'doc-release', title: 'Release process' }]
assert.deepEqual(affectedDocuments({ title: 'API authentication' }, docs).map(d => d.id), ['doc-api'])
assert.deepEqual(affectedDocuments({ title: 'Database migration' }, docs).map(d => d.id), ['doc-db'])
assert.deepEqual(affectedDocuments({ title: 'New policy', docIds: ['doc-brand'] }, docs).map(d => d.id), ['doc-brand'])
assert.deepEqual(affectedDocuments({ title: 'Unclassified system change' }, docs).map(d => d.id), ['doc-release'])
const item = { id: 'backend', title: 'API changes', affectedDocIds: ['doc-api'] }
const update = mergeDocumentUpdate(item, 'project', { files: { api: ['new contract'] }, previousFiles: { api: ['old contract'] }, fileNames: { api: 'api.ts' } })
assert.equal(update.source, 'merge')
assert.equal(update.stage, 'update')
assert.deepEqual(update.changes, [{ label: 'api.ts', from: 'old contract', to: 'new contract' }])
assert.deepEqual(affectedDocuments(update, docs).map(d => d.id), ['doc-api'])
assert.equal(mergeDocumentUpdate(item, 'project', { files: { api: ['same'] }, previousFiles: { api: ['same'] } }), null)
assert.equal(mergeDocumentUpdate(item, 'project', { draft: { assemblies: { card: { radius: 16 } } } }).changes.length, 1)
assert.equal(mergeDocumentUpdate(item, 'project', { draft: { resolutions: { 'card:radius': 'B' } }, layerDiffs: { card: [{ id: 'radius', label: 'Radius', optionA: '8px', optionB: '12px' }] } }).changes[0].to, '12px')
console.log('Passed: automatic merge updates, code/design changes, all-document targeting and sequential approval guards.')
