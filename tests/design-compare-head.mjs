import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Design Compare's header row: the title on the left, everything to do on the
// right — how many drafts are ticked, clearing / ticking them all, the next step.
const source = readFileSync(new URL('../src/components/mergestudio/DesignComparison.jsx', import.meta.url), 'utf8')
const head = source.slice(source.indexOf('data-design-compare-head'), source.indexOf('{commentModeVariantKey && ('))

// Two groups, nothing pushed to the middle (two `ml-auto`s used to split the row's room between them).
assert.ok(head.includes('data-design-title') && head.includes('data-design-actions'))
assert.ok(!/ml-auto/.test(head), 'no auto margins: nothing floats between the title and the actions')
// In order: the count (quiet text), clear / select all (a text button), then the step.
const order = ['data-design-selection', 'data-design-select-all', 'data-design-compose', 'data-design-next'].map((mark) => head.indexOf(mark))
assert.deepEqual(order, [...order].sort((a, b) => a - b))
assert.ok(order.every((at) => at > 0))
assert.match(head, /\{allSelected \? '선택 해제' : '모두 선택'\}/)
assert.ok(head.includes("ml-2 hidden h-7") && head.includes("selectable && 'ml-3'"), '8px to the text button, 12px to the primary one')
// Narrow: the count alone, then the text button under ⋯.
assert.ok(head.includes('hidden @[560px]:inline') && head.includes('@[440px]:inline-flex') && head.includes('@[440px]:hidden'))
// The ticks feed the mix, so they're offered only while there's a mix to start…
assert.match(source, /const selectable = Boolean\(compose\) && choosing && Boolean\(onSelectAll\)/)
assert.match(source, /choosing=\{selectable\}/)
// …and afterwards the cards mark the drafts the mix used, read-only.
assert.ok(source.includes('data-design-used') && source.includes('if (selectable) onToggleVariant(option.key)'))
// Esc clears them, only while they can be changed.
assert.match(source, /event\.key !== 'Escape' \|\| !selectable \|\| !selectedOptions\.length/)
console.log('Passed: Design Compare’s header keeps its actions together on the right, and ticks are read-only once the mix is asked for or merged.')
