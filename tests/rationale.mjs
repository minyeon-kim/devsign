import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { DESIGN_RULES, mergeEvidence, rationaleOf, stepRationale, checkpointRationale } = await server.ssrLoadModule('/src/lib/rationale.js')
  assert.equal(DESIGN_RULES.length, 4)
  const original = { id: 'order', ruleIds: ['button-color', 'button-height'], purpose: { text: 'Original request' } }
  const comments = [
    { id: 'one', authorId: 'james', text: 'Use primary', target: { conflictId: 'order' } },
    { id: 'two', authorId: 'james', text: 'Also large', target: { conflictId: 'order', replyTo: 'one' } },
  ]
  const current = { ...original, deviation: { kind: 'keep-current', text: 'Temporary exception' } }
  const rationale = rationaleOf(current, { comments })
  assert.equal(rationale.evidence.filter((item) => item.kind === 'comment').length, 2)
  assert.deepEqual(mergeEvidence(rationale.evidence, rationale.evidence), rationale.evidence)
  assert.equal(mergeEvidence(rationale.evidence, [{ kind: 'token', label: 'historical.token', source: 'tokens.json' }]).length, rationale.evidence.length + 1)
  const detected = stepRationale({ kind: 'conflict' }, current, rationale)
  assert.equal(detected.text, 'Detected because the button height and color differ from the checkout design')
  const newSource = { kind: 'token', label: 'new.token', source: 'tokens.json' }
  const stepWithSource = stepRationale({ kind: 'ai-edit', evidence: [newSource] }, current, rationale)
  assert.deepEqual(mergeEvidence(rationale.evidence, stepWithSource.evidence).slice(rationale.evidence.length), [newSource])
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { DecisionSummary } = await server.ssrLoadModule('/src/components/conflicts/Rationale.jsx')
  const summary = renderToStaticMarkup(createElement(DecisionSummary, { rationale: rationaleOf(original, { comments }) }))
  assert.equal((summary.match(/<dt /g) ?? []).length, 3)
  assert.equal((summary.match(/data-evidence=/g) ?? []).length, 3)
  assert.ok(summary.includes('aria-expanded="false"'))
  const checkpoint = { kind: 'merge', snapshot: { conflicts: [original] } }
  assert.equal(checkpointRationale(checkpoint, [current], comments).text, 'Original request')
  assert.equal(stepRationale(checkpoint, current, rationale).text, 'Original request')
  const aiStep = stepRationale({ kind: 'ai-edit', prompt: 'New chat request' }, current, rationale)
  assert.equal(aiStep.text, 'New chat request')
  assert.ok(aiStep.evidence.some((item) => item.kind === 'token'))
  assert.ok(aiStep.evidence.some((item) => item.kind === 'figma'))
  assert.equal(stepRationale({ kind: 'rollback', reason: 'Release schedule' }, current, rationale).text, 'Release schedule')
  console.log('Rationale: source links, distinct comments, historical decisions and step purposes passed')
} finally {
  await server.close()
}
