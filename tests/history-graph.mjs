import assert from 'node:assert/strict'
import { historyGraphEdges } from '../src/lib/historyGraph.js'
const entries = [
  { id: 'initial' },
  { id: 'draft' },
  { id: 'edit', parentIds: ['draft'] },
  { id: 'merge', parentIds: ['edit'], mergedFromIds: ['draft', 'missing', 'edit'] },
  { id: 'restore', parentIds: ['merge'], restoredFrom: 'initial' },
]
const edges = historyGraphEdges(entries)
assert.deepEqual(edges.filter((edge) => edge.kind === 'merge'), [{ from: 'merge', to: 'draft', kind: 'merge' }])
assert.deepEqual(edges.filter((edge) => edge.kind === 'restore'), [{ from: 'restore', to: 'initial', kind: 'restore' }])
assert.equal(edges.find((edge) => edge.from === 'draft').kind, 'sequence')
assert.equal(edges.find((edge) => edge.from === 'edit').kind, 'parent')
assert.deepEqual(historyGraphEdges([{ id: 'standalone', kind: 'merge', parentIds: [] }]), [])
assert.deepEqual(historyGraphEdges([{ id: 'self', parentIds: ['self'], restoredFrom: 'self' }]), [])
console.log('Passed: recorded ancestry, legacy order, merge sources, restore sources and missing/self references.')
