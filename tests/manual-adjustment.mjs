import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { mergeListItems, conflictChecklist, canvasPages, projectFileSets } = await server.ssrLoadModule('/src/data/mockData.js')
  const { comparisonBlockers, driftRowsFor } = await server.ssrLoadModule('/src/lib/driftDecisions.js')
  const { checksFor } = await server.ssrLoadModule('/src/components/mergestudio/mergeChecks.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const { readDemo, writeDemo } = await server.ssrLoadModule('/src/lib/demoStorage.js')
  const item = mergeListItems.find((entry) => entry.id === 'merge-checkout-manual-target')
  const conflict = conflictChecklist.find((entry) => entry.id === item.conflictId)
  assert.equal(conflict.layerId, 'coupon-close')
  assert.ok(canvasPages.find((page) => page.id === item.designPageId).frames[0].layers.some((layer) => layer.id === conflict.layerId))
  assert.ok(projectFileSets[item.projectId].some((file) => file.id === conflict.fileId))
  for (const side of ['A', 'B']) {
    const resolutions = { 'coupon-close:close-radius': side }
    const failures = checksFor(item, { resolutions }).blocking
    assert.deepEqual(failures.map((check) => check.id), ['targets'], `${side} must require manual resizing`)
    assert.equal(failures[0].layerId, conflict.layerId)
    assert.deepEqual(failures[0].editFields, { layerId: conflict.layerId, minimum: 24 })
    const rows = driftRowsFor(conflict, item)
    const fileCheck = { id: 'markers', fileId: conflict.fileId }
    const otherLayerCheck = { id: 'targets', layerId: 'unrelated' }
    assert.deepEqual(comparisonBlockers([...failures, fileCheck, otherLayerCheck], side, rows), failures, 'only checks belonging to the chosen card appear inside it')
    assert.deepEqual(comparisonBlockers(failures, null, rows), [], 'unpicked checks remain visible below the comparison')
    assert.match(translateText(failures[0].title, 'ko'), /쿠폰 닫기 버튼 터치 영역 20px/)
    assert.match(translateText(failures[0].editHint, 'ko'), /W와 H를 각각 24px/)
    assert.ok(checksFor(item, { resolutions, assemblies: { 'coupon-close': { width: 24, height: 20 } } }).blocking.length, 'both dimensions must pass')
    assert.equal(checksFor(item, { resolutions, assemblies: { 'coupon-close': { width: 24, height: 24 } } }).blocking.length, 0)
  }
  for (const text of [conflict.token, conflict.message, conflict.suggestion, conflict.riskReason,
    'Shipping option', 'Icon stroke', 'Matches the rest of the icon set', 'Letter spacing', 'Normal',
    'Button text contrast 3.2:1', '2 AI edits applied', '1 AI note not applied', 'iconbtn', 'Neo Glow']) {
    assert.notEqual(translateText(text, 'ko'), text, `missing Korean translation: ${text}`)
    assert.equal(translateText(text, 'en'), text, 'English mode preserves its source text')
  }
  for (const text of ['2.5', '24px', '--button-height-md', 'src/components/checkout/CouponNotice.jsx']) {
    assert.equal(translateText(text, 'ko'), text, 'technical values and paths remain intact')
  }
  globalThis.localStorage = new class {
    getItem(key) { return this[key] ?? null }
    setItem(key, value) { this[key] = String(value) }
  }()
  for (const [key, example] of [['conflicts', conflict], ['project:checkout-redesign:mergeItems', item]]) {
    const saved = { id: 'existing', reviewStage: 'approved', custom: 'keep' }
    writeDemo(key, [saved])
    const loaded = readDemo(key, [example])
    assert.deepEqual(loaded, [example, saved], 'append the example without resetting saved work')
    writeDemo(key, loaded)
    assert.deepEqual(readDemo(key, [example]), loaded, 'reload must not duplicate the example')
  }
  console.log('Passed: manual example requires resizing on both sides, 24 × 24 clears it, Korean copy and non-destructive seed migration.')
} finally {
  await server.close()
}
