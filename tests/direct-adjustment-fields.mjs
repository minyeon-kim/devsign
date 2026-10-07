import assert from 'node:assert/strict'
import { createServer } from 'vite'

// The review's direct adjustment sets every compared value — not only the
// element's own numbers — and a value set there is written into the code
// that Merge Studio's code view edits (and read back from it).
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { conflictChecklist, mergeListItems } = await server.ssrLoadModule('/src/data/mockData.js')
  const { fieldControlsFor, handLinesOf, mergeResultOf, readFieldValue, withHandLines, writeFieldValue } = await server.ssrLoadModule('/src/lib/mergeResult.js')
  const conflicts = conflictChecklist.filter((c) => c.comparisonFields?.length && !c.diff?.before?.some((line) => /^<{7}/.test(line)))
  assert.ok(conflicts.length >= 8, 'design conflicts with compared values are seeded')
  const itemOf = (conflict) => mergeListItems.find((item) => item.id === conflict.mergeItemId || item.conflictId === conflict.id)

  // 1 · Every compared value has an editor.
  for (const conflict of conflicts) {
    const controls = fieldControlsFor(conflict, itemOf(conflict))
    assert.equal(controls.length, conflict.comparisonFields.length, `${conflict.id}: one editor a value`)
    assert.ok(controls.every(Boolean), `${conflict.id}: no value is left without an editor`)
  }

  const byId = (id) => conflicts.find((c) => c.id === id)
  const write = (conflict, label, value, from = conflict.diff.before) => writeFieldValue(conflict, from, conflict.comparisonFields.find((f) => f.label === label), value)

  // 2 · Values the element doesn't own are written in the code…
  const gap = byId('cc-7')
  assert.equal(fieldControlsFor(gap, itemOf(gap))[0].mode, 'code')
  assert.deepEqual(write(gap, 'Field gap', '12px'), ['<form className="flex flex-col gap-3">'])
  assert.deepEqual(write(gap, 'Field gap', '8px'), gap.diff.after, 'the standard is written as the reference writes it')

  const stroke = byId('cc-10')
  assert.deepEqual(write(stroke, 'Stroke', '1.5'), ['<Truck className="size-4" strokeWidth={1.5} />'])
  assert.deepEqual(write(stroke, 'Stroke', '2'), stroke.diff.after)

  const tracking = byId('cc-9')
  assert.deepEqual(write(tracking, 'Tracking', 'normal'), tracking.diff.after)
  assert.deepEqual(write(tracking, 'Tracking', '0.05em (tracking-wider)'), ['<label className="text-xs font-medium tracking-wider">'])

  const divider = byId('cc-8')
  assert.deepEqual(write(divider, 'Divider', '#cbd5e1'), ['<hr className="border-[#cbd5e1]" />'])

  const cta = byId('cc-11')
  const cards = fieldControlsFor(cta, itemOf(cta))
  assert.equal(cards[0].mode, 'layer', 'the button height is still set on the element')
  assert.equal(cards[1].type, 'color')
  assert.match(write(cta, 'Background', '#0ea5e9')[0], /bg-\[#0ea5e9\]/)
  assert.doesNotMatch(write(cta, 'Background', 'color.primary (Indigo 500)')[0], /bg-\[/, 'the token drops the fixed hex')

  // 3 · …and read back, so the card, its picture and its code agree.
  const lines = write(gap, 'Field gap', '12px')
  assert.equal(readFieldValue(gap, lines, gap.comparisonFields[0]), '12px')
  const result = mergeResultOf(gap, itemOf(gap), 'B', { handLines: lines })
  assert.equal(result.rows[0].to, '12px')
  assert.equal(result.preview.gap, 12)
  assert.deepEqual(result.lines, lines)
  assert.ok(result.adjusted)

  // 4 · The same lines are Merge Studio's hand-written code: written to its
  // `manualCode` with the file's indent, and found there again.
  const manual = withHandLines(stroke, {}, write(stroke, 'Stroke', '3'), ['', '', '', '      <Truck className="size-4" strokeWidth={2.5} />'])
  assert.deepEqual(manual, { 'shipping:4': '      <Truck className="size-4" strokeWidth={3} />' })
  assert.deepEqual(handLinesOf(stroke, manual), ['<Truck className="size-4" strokeWidth={3} />'])
  assert.equal(mergeResultOf(stroke, itemOf(stroke), 'B', { handLines: handLinesOf(stroke, manual) }).rows[0].to, '3')
  // (Typed back to what it was: nothing is left written by hand.)
  assert.deepEqual(withHandLines(stroke, manual, stroke.diff.before), {})

  // 5 · What the code can't spell is still set, as text.
  const icon = byId('cc-4')
  const hitAt = icon.comparisonFields.findIndex((field) => field.label === 'Hit area')
  const hit = fieldControlsFor(icon, itemOf(icon))[hitAt]
  assert.equal(hit.mode, 'text')
  assert.equal(mergeResultOf(icon, itemOf(icon), 'B', { handValues: { 'Hit area': '48px' } }).rows[hitAt].to, '48px')

  console.log(`Passed: every compared value of ${conflicts.length} conflicts is editable; values are written into and read back from the code Merge Studio edits.`)
} finally { await server.close() }
