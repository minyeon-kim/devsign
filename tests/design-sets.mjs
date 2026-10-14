import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { designSetsOf, designRegionsOf } = await server.ssrLoadModule('/src/lib/designSets.js')
  const { mergeListItems, canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const { composeDraftFrame, regionPicks, regionKey } = await server.ssrLoadModule('/src/data/draftScreens.js')
  const sets = designSetsOf(mergeListItems)
  assert.deepEqual(sets.map((item) => item.id), ['merge-dashboard-drafts', 'merge-checkout-payment-drafts', 'merge-confirmation-drafts'])
  for (const item of sets) {
    const regions = designRegionsOf(item)
    const decisions = Object.fromEntries(regions.map((region, index) => [regionKey(region.id), { custom: item.variants[index % item.variants.length].key }]))
    const base = canvasPages.find((page) => page.id === item.designPageId).frames[0]
    const picks = regionPicks(item.id, decisions)
    const frame = composeDraftFrame(item.id, base, picks)
    assert.ok(frame.layers.length > 0)
    assert.equal(new Set(regions.map((region) => picks[region.id])).size, Math.min(regions.length, item.variants.length))
    const incomplete = { ...item, variants: [...item.variants, { key: 'missing' }] }
    assert.deepEqual(designSetsOf([incomplete]), [])
  }
  console.log('Passed: design sets contain complete composable drafts and exclude design/code review items.')
} finally { await server.close() }
