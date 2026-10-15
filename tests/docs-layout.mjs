import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// What the Docs layer shows is read in the middle of the layer: a document is
// one block — the 680px article and its contents list beside it — centred,
// the list folding into the article when there isn't room; the index and the updates
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

  // One block in the middle: the article and, beside it, the list.
  assert.equal(DOC_PAGE_FRAME, 'flex w-full justify-center px-6 pt-6 pb-24')
  assert.match(page, /data-doc-frame="page" class="flex w-full justify-center/)
  assert.match(page, /<article data-doc-article="true" class="min-w-0 max-w-\[680px\] flex-1"/)
  const toc = page.match(/<nav[^>]*data-doc-toc[^>]*class="([^"]*)"/)?.[1] ?? page.match(/<nav[^>]*class="([^"]*)"[^>]*data-doc-toc/)?.[1] ?? ''
  assert.ok(toc.includes('ml-12') && toc.includes('w-44') && toc.includes('shrink-0') && toc.includes('sticky') && toc.includes('top-10'), `the list: 48px off the article, 176px, sticky — ${toc}`)
  // It shows when the block fits (680 + 48 + 176, and 24px at the sides: 1100px of layer) — the layer's own width.
  assert.ok(toc.includes('hidden') && toc.includes('@min-[1100px]/doc:block'))
  assert.ok(page.includes('@min-[1100px]/doc:hidden'), 'under it the list folds into the article')
  assert.ok(page.includes('@container/doc'))
  // The header, in the article's column: bigger title, summary, meta.
  // (A quieter title, as the other pages': 22px semibold over a 14px summary.)
  assert.match(page, /<h1 class="[^"]*text-\[22px\][^"]*font-semibold/)
  assert.match(page, /text-\[14px\] leading-6/)
  // A panel's document keeps its own frame.
  assert.match(panel, /<div class="mx-auto flex max-w-5xl gap-8/)
  
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
