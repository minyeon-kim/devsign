import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { WorkspaceProvider, useWorkspace } = await server.ssrLoadModule('/src/state/WorkspaceProvider.jsx')
  const { ConflictStoreProvider } = await server.ssrLoadModule('/src/state/ConflictStore.jsx')
  let workspace
  function Capture() { workspace = useWorkspace(); return null }
  renderToString(createElement(ConflictStoreProvider, null, createElement(WorkspaceProvider, { projectId: 'checkout-redesign' }, createElement(Capture))))
  let nextId = 0
  const timers = new Map()
  globalThis.window = {
    setTimeout(fn) { timers.set(++nextId, fn); return nextId },
    clearTimeout(id) { timers.delete(id) },
  }
  workspace.sendChatMessage('hello')
  assert.equal(timers.size, 1)
  const stale = [...timers.values()][0]
  workspace.sendChatMessage('duplicate')
  assert.equal(timers.size, 1, 'reject concurrent sends')
  workspace.stopChatGeneration()
  assert.equal(timers.size, 0, 'cancel scheduled response')
  workspace.sendChatMessage('retry')
  assert.equal(timers.size, 1, 'allow sending after stop')
  stale()
  workspace.sendChatMessage('duplicate after stale callback')
  assert.equal(timers.size, 1, 'cancelled callback cannot finish the newer generation')
  workspace.stopChatGeneration()
  workspace.stopChatGeneration()
  assert.equal(timers.size, 0)
  console.log('Passed: cancel response timer, reject concurrent sends, restart and ignore stale callbacks.')
} finally {
  delete globalThis.window
  await server.close()
}
