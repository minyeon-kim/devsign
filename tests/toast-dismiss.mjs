import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Notices: the "Workspace reset" notice (with its Undo) is gone — a reset says nothing after the reload — and
// any notice goes when the person presses anywhere else (on the press, in the capture phase, so a notice the
// click itself raises survives it).
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const demo = read('components/workspace/DemoTools.jsx')
const sonner = read('components/ui/sonner.jsx')
assert.ok(!demo.includes("toast(translateText('Workspace reset'") && !demo.includes("label: 'Undo'") && demo.includes('discardUndo()'), 'no reset notice; the snapshot is let go')
assert.ok(sonner.includes('pointerdown') && sonner.includes('onPressElsewhere') && sonner.includes('toast.dismiss()') && sonner.includes('true)'), 'a press elsewhere puts notices away, in the capture phase')
assert.ok(sonner.includes('[data-sonner-toast], [data-sonner-toaster]'), 'pressing a notice itself is its own')
console.log('Passed: no reset notice; notices go when the person presses elsewhere.')
