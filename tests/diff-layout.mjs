import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Every code diff (conflict detail, History, Merge Studio) is one view in
// two layouts — stacked (− over +) or side by side (old | new, line for
// line) — switched by the same pair of tabs.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { DiffView, DiffLayoutTabs } = await server.ssrLoadModule('/src/components/diff/DiffView.jsx')
  const { diffLines } = await server.ssrLoadModule('/src/lib/lineDiff.js')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const shows = (html, text) => html.includes(`>${text}<`) || html.includes(`>${translateText(text, 'ko')}<`)
  const rows = diffLines(['<a>', '<Icon className="size-5" />', '</a>'], ['<a>', '<Icon className="size-6" />', '</a>'])
  const render = (props) => renderToStaticMarkup(createElement(DiffView, { rows, ...props }))

  const stacked = render({ layout: 'unified', startLine: 10 })
  assert.ok(stacked.includes('data-diff-view="unified"'))
  assert.ok(stacked.indexOf('−') < stacked.indexOf('+'), 'the old line above the new one')
  assert.match(stacked, /bg-red-400\/35[^>]*>size-5</, 'the removed value lit red')
  assert.match(stacked, /bg-emerald-400\/35[^>]*>size-6</, 'the added value lit green')
  assert.ok(stacked.includes('>11<'), 'line numbers start at startLine')

  const split = render({ layout: 'split', labels: ['Before', 'After'] })
  assert.ok(split.includes('data-diff-view="split"'))
  assert.ok(shows(split, 'Before') && shows(split, 'After'), 'column titles (translated)')
  assert.equal((split.match(/&lt;a&gt;/g) ?? []).length, 2, 'an unchanged line shows on both sides')
  assert.ok(split.indexOf('size-5') < split.indexOf('size-6'), 'old on the left, new on the right')

  // An added line with nothing removed: the left side is left empty.
  const added = renderToStaticMarkup(createElement(DiffView, { rows: diffLines(['a'], ['a', 'b']), layout: 'split' }))
  assert.ok(added.includes('repeating-linear-gradient'), 'the missing side is marked empty')

  const tabs = renderToStaticMarkup(createElement(DiffLayoutTabs))
  assert.ok(tabs.includes('data-diff-layout="unified"') && tabs.includes('data-diff-layout="split"'))
  console.log('Passed: one diff view, stacked or side by side, with − red / + green and the changed value lit.')
} finally { await server.close() }
