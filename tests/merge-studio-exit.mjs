import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// Merge Studio has its way out: "← Workspace" first in the header row (AI Chat's pill
// after it), and Esc — unless something else is waiting for the key.
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
try {
  const { shouldExitOnEscape, ESC_FIRST } = await server.ssrLoadModule('/src/components/mergestudio/StudioExit.jsx')
  const key = (over = {}) => ({ key: 'Escape', defaultPrevented: false, metaKey: false, ctrlKey: false, altKey: false, target: { closest: () => null }, ...over })
  const root = (open) => ({ querySelector: (selector) => (selector === ESC_FIRST && open ? {} : null) })

  // Esc leaves only when nothing else wants it.
  assert.equal(shouldExitOnEscape(key(), root(false)), true, 'a bare Esc leaves')
  assert.equal(shouldExitOnEscape(key(), root(true)), false, 'an open dialog / menu / popover / listbox / full-screen preview goes first')
  assert.equal(shouldExitOnEscape(key({ target: { closest: (s) => (s.includes('input') ? {} : null) } }), root(false)), false, 'not while typing')
  assert.equal(shouldExitOnEscape(key({ defaultPrevented: true }), root(false)), false, 'a key something else took')
  assert.equal(shouldExitOnEscape(key({ metaKey: true }), root(false)), false)
  assert.equal(shouldExitOnEscape(key({ key: 'Enter' }), root(false)), false, 'only Esc')
  for (const layer of ['[role="dialog"]', '[data-slot="dialog-content"]', '[data-slot="popover-content"]', '[role="menu"]', '[role="listbox"]', '[data-preview-fullscreen-layer]']) assert.ok(ESC_FIRST.includes(layer), `${layer} goes before the studio`)

  // The button, rendered.
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  const { WorkspaceProvider } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { default: StudioExit } = await server.ssrLoadModule('/src/components/mergestudio/StudioExit.jsx')
  const html = renderToString(createElement(MemoryRouter, null, createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: 'dashboard-redesign' }, createElement(StudioExit)))))
  assert.match(html, /data-studio-exit/)
  assert.match(html, /aria-label="워크스페이스로 돌아가기"/, 'named for everyone, text or not')
  assert.match(html, /title="워크스페이스로 돌아가기 · Esc"/)
  assert.match(html, /워크스페이스<\/span>/, 'the name beside the arrow')
  assert.match(html, /@max-\[1100px\]:hidden/, 'in a narrow window the name steps aside…')
  assert.match(html, /@max-\[1100px\]:w-8/, '…leaving the arrow in a round button')
  assert.match(html, /top-2 left-4/, 'the first thing in the header row')

  // It's wired in, and AI Chat's pill makes room for it.
  const source = read('src/components/mergestudio/StudioExit.jsx')
  assert.ok(source.includes('onClick={exitMergeStudio}'), 'one press: back')
  assert.ok(!/confirm|Dialog|toast/.test(source.replace(/\/\/.*$/gm, '')), 'nothing to confirm, nothing to announce')
  assert.ok(read('src/components/mergestudio/MergeStudioView.jsx').includes('<StudioExit />'))
  const layout = read('src/components/workspace/WorkspaceSplitLayout.jsx')
  assert.ok(layout.includes("corner === 'top' ? 'left-[9.75rem] @max-[1100px]:left-14' : 'left-4'"), 'AI Chat’s pill sits after it')

  console.log('Passed: Merge Studio exit — “← Workspace” first in the header row, Esc unless something else is waiting, nothing to confirm.')
} finally { delete globalThis.localStorage; await server.close() }
