import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { default: Deck } = await server.ssrLoadModule('/src/components/mergestudio/BlockDeckPanel.jsx')
  const { default: Library } = await server.ssrLoadModule('/src/components/dockview/panels/AssetsLibrary.jsx')
  const { designSystemComponents } = await server.ssrLoadModule('/src/data/mockData.js')
  const base = { embedded: true, open: true, item: { id: 'test' }, selectedLayer: null }
  const inspect = renderToStaticMarkup(createElement(Deck, { ...base, activeTab: 'assemble' }))
  assert.ok(inspect.includes('Select an element on the canvas to assemble'))
  assert.ok(!inspect.includes('Search components'))
  assert.ok(!inspect.includes('>Library</button>'))
  const assets = renderToStaticMarkup(createElement(Deck, { ...base, activeTab: 'library', onAddComponent: () => {} }))
  assert.ok(assets.includes('Search components'))
  assert.ok(assets.includes('Add to canvas'))
  assert.ok(!assets.includes('>Assemble</button>'))
  assert.ok(!assets.includes('Select an element on the canvas to assemble'))
  for (const def of designSystemComponents) assert.ok(assets.includes(def.name))
  const browseOnly = renderToStaticMarkup(createElement(Library, { layer: null }))
  assert.ok(browseOnly.includes('Search components'))
  assert.ok(!browseOnly.includes('Add to canvas'))
  console.log('Passed: Properties owns editing, Assets owns the shared library, merge placement actions remain available.')
} finally {
  await server.close()
}
