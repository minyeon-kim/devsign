import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// What the Docs layer shows is read in the middle of the layer: a document is
// the middle of three columns (680px), its contents list floats in the empty
// one at its right — and never moves the article; the index and the updates
// sit in one middle column too.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const { default: ReferenceDocView, DOC_PAGE_FRAME } = await server.ssrLoadModule('/src/components/archive/ReferenceDocView.jsx')
  const { referenceDocs } = await server.ssrLoadModule('/src/data/mockData.js')
  const doc = referenceDocs.find((d) => d.id === 'doc-copy')
  assert.ok(doc.blocks.filter((b) => b.type === 'h2').length > 1, 'a document with a contents list')
  const render = (props) => renderToString(createElement(MemoryRouter, null, createElement(ReferenceDocView, { doc, path: ['디자인 가이드'], ...props })))
  const page = render({ page: true })
  const panel = render({})

  // Three columns; the article is the middle one, the list the right one.
  assert.equal(DOC_PAGE_FRAME, 'grid w-full grid-cols-[minmax(0,1fr)_minmax(0,680px)_minmax(0,1fr)] px-6 pt-6 pb-24')
  assert.match(page, /data-doc-frame="page" class="grid w-full grid-cols-\[minmax\(0,1fr\)_minmax\(0,680px\)_minmax\(0,1fr\)\]/)
  assert.match(page, /<article data-doc-article="true" class="col-start-2 min-w-0"/, 'the article is the middle column')
  const toc = page.match(/<nav[^>]*data-doc-toc[^>]*class="([^"]*)"/)?.[1] ?? page.match(/<nav[^>]*class="([^"]*)"[^>]*data-doc-toc/)?.[1] ?? ''
  assert.ok(toc.includes('col-start-3') && toc.includes('row-start-1') && toc.includes('ml-12') && toc.includes('w-44') && toc.includes('sticky') && toc.includes('top-10'), `the list: right column, 48px off the article, 176px, sticky — ${toc}`)
  // It needs 680 + 224 either side (1176px of layer) — the layer's own width, not the window's.
  assert.ok(toc.includes('hidden') && toc.includes('@min-[1176px]/doc:block'))
  assert.ok(page.includes('@min-[1176px]/doc:hidden'), 'under it the list folds into the article')
  assert.ok(page.includes('@container/doc'))
  // The list is not in the article's flow: the article's place doesn't depend on it.
  assert.ok(!/<article[^>]*flex-1/.test(page))
  // The header, in the article's column: bigger title, summary, meta.
  assert.match(page, /<h1 class="[^"]*text-4xl[^"]*font-bold/)
  assert.match(page, /text-base leading-\[1\.6\]/)
  // A panel's document keeps its own frame.
  assert.match(panel, /<div class="mx-auto flex max-w-5xl gap-8/)
  assert.doesNotMatch(panel, /grid-cols-\[/)

  // The layer: the index and the updates in the same middle column.
  const overlay = read('src/components/docs/DocsOverlay.jsx')
  assert.ok(overlay.includes("const READING = 'mx-auto w-full max-w-[760px] px-6 pt-6 pb-24'"))
  assert.ok(overlay.includes('data-docs-index className={READING}') && overlay.includes('data-docs-updates className={READING}'))
  assert.ok(overlay.includes('page />}'), 'a document is the page layout')
  assert.ok(!overlay.includes('COLUMN'), 'no left-hung column left')
  // The path keeps the bar's own line; the bar and the other layers are untouched.
  assert.ok(read('src/components/layout/Breadcrumb.jsx').includes("export const BREADCRUMB_COLUMN = 'mx-auto w-full max-w-[1180px] px-6 sm:px-10'"))

  console.log('Passed: Docs layout — the article in the middle column, the contents list in the right one, the index and updates in one middle column.')
} finally { delete globalThis.localStorage; await server.close() }
