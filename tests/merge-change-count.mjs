import assert from 'node:assert/strict'
import { mergeChangeCount } from '../src/lib/mergeChangeCount.js'
assert.equal(mergeChangeCount(null), 0)
assert.equal(mergeChangeCount({ design: [] }), 0)
const summary = { design: [{ key: 'assembly' }, { key: 'added' }, { key: 'preset' }] }
assert.equal(mergeChangeCount(summary, { file: [{ line: 2 }, { line: 3 }] }, { 'file:2': 'edited', 'copy:4': 'text' }, [
  { fileId: 'file', line: 2, status: 'done' },
  { fileId: 'file', line: 5, status: 'thinking' },
  { layerId: 'layer', status: 'done' },
]), 7)
console.log('Passed: design totals, distinct code lines, manual text edits and completed AI changes.')
