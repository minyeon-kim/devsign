import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The lower part of 해결 방법 — from the ways to the action: 다른 값's value in its own row, the reason only
// for a way that differs from the design, then one action bar. No sentences in between.
const flow = readFileSync(new URL('../src/components/conflicts/DesignDecisionFlow.jsx', import.meta.url), 'utf8')

// 다른 값: a stepper in its row (28px, step 0.25), no 원안/현재 boxes, no "직접 입력".
assert.ok(flow.includes('function ValueStepper(') && flow.includes('h-7') && flow.includes("step={scale.unit === 'px' ? 1 : 0.25}"))
assert.ok(!flow.includes('<ValueScale') && !flow.includes('data-proposal-scale'), 'the scale under the row is gone')
// No sentences under the list.
for (const text of ['캔버스에서 미리보는 중', '원안과 다른 수정안이라 승인이 필요해요', '원안대로 맞추는 거라 승인 없이 바로 적용돼요', 'data-request-note']) assert.ok(!flow.includes(text), `"${text}" is gone`)
// The reason: compact (one line growing to three), its one suggestion unlabelled, only for a way that asks.
assert.ok(flow.includes('<ReasonField\n            compact') && flow.includes('placeholder="이 값을 고른 이유"') && flow.includes('<FoldBody open={asking}>'))
assert.ok(flow.includes('Math.min(Math.max(node.scrollHeight, 36), 76)') && flow.includes('compact ? (value.trim() ? [] : suggestions.slice(0, 1))'))
// One action bar: a rule, 나란히 비교 (ghost, one line, its tooltip the Space hint) at the left, the action at the right.
assert.ok(flow.includes('border-t border-white/[0.06] pt-4') && flow.includes('title="Space: 현재와 비교"') && flow.includes('whitespace-nowrap'))
assert.ok(flow.includes("'변경 사유를 입력해 주세요'") && flow.includes('disabled={Boolean(missing)}'), 'asking without a reason waits')
console.log('Passed: 해결 방법’s lower part — the value in its row, the reason when asked, one action bar.')
