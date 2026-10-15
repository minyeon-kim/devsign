import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The board's change list, as an issue list: groups by screen, rows on fixed columns (status · title · due)
// over what kind of clash it is, the risk a chip only when it matters; no blue, no group outline.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const { rowTitleOf, rowKindOf, sortRows } = await server.ssrLoadModule('/src/components/screens/BoardConflicts.jsx')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const byId = (id) => allConflictRecords().find((c) => c.id === id)
  // One title form: what it's about + the property; a sentence's last part becomes the kind.
  assert.deepEqual(rowTitleOf(byId('CON-013')), { target: 'ShippingOptions', property: 'Icon stroke', kind: null })
  assert.deepEqual(rowTitleOf(byId('CON-022')), { target: '주문 버튼', property: '중복 결제 방지', kind: 'Behavior conflict' })
  assert.deepEqual(rowTitleOf(byId('CON-023')), { target: '주문 요약', property: '할인 금액 계산', kind: 'Calculation conflict' })
  assert.deepEqual(['CON-013', 'CON-014', 'CON-022', 'CON-023', 'CON-025'].map((id) => rowKindOf(byId(id))), ['Design Drift', 'Design Drift', 'Behavior conflict', 'Calculation conflict', 'Code merge conflict'])
  // In a group: soonest due, then the riskiest.
  const sorted = sortRows(['CON-013', 'CON-014', 'CON-022', 'CON-023', 'CON-015'].map(byId)).map((c) => c.id)
  assert.deepEqual(sorted, ['CON-022', 'CON-014', 'CON-023', 'CON-013', 'CON-015'])

  const list = read('components/screens/BoardConflicts.jsx')
  assert.ok(!list.includes('RISK_DOT') && !list.includes('sky-') && !list.includes('ring-[#F04E5A]'), 'no dots, no blue, no group outline')
  assert.ok(list.includes('grid-cols-[16px_minmax(0,1fr)_56px]') && list.includes('h-[52px]') && list.includes('gap-x-2.5'), 'fixed columns, 52px rows')
  assert.ok(list.includes('sticky top-0') && list.includes('aria-expanded={open}') && list.includes('h-7'), 'sticky, folding 28px headers')
  assert.ok(list.includes("conflict.dueBucket === 'overdue' ? 'font-semibold text-rose-400' : conflict.dueBucket === 'today' ? 'text-rose-400'"), 'only today (and overdue) in red')
  assert.ok(list.includes("medium: ['Risk medium'") && !list.includes("low: ['Risk"), 'no chip for low risk')
  assert.ok(list.includes("event.key !== 'ArrowDown' && event.key !== 'ArrowUp'") && list.includes("selected ? 'bg-white/[0.08]'"))
  console.log('Passed: the board’s change list — groups, fixed columns, one title form, the risk only when it matters.')
} finally { await server.close() }
