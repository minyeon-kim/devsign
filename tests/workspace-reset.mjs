import assert from 'node:assert/strict'
import { createServer } from 'vite'

const store = () => {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)) },
    removeItem: (k) => { data.delete(k) },
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size },
    [Symbol.iterator]: undefined,
  }
}
// Object.keys(storage) must list keys, as in browsers.
const proxied = () => {
  const s = store()
  return new Proxy(s, { ownKeys: () => [...Array(s.length).keys()].map((i) => s.key(i)), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: s.getItem(k) }) })
}

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { UNDO_MS, resetWorkspace, undoReset, pendingUndo, noteDataChange } = await server.ssrLoadModule('/src/lib/workspaceReset.js')
  const seed = () => {
    const local = proxied(), session = proxied()
    local.setItem('devsign:demo:conflicts', '{"a":1}')
    local.setItem('devsign:demo:project:x:historyEntries', '[1,2]')
    local.setItem('devsign:language', 'ko')
    session.setItem('devsign:notices-seen:v1', 'seen')
    return { local, session }
  }

  // Reset clears the workspace namespace and notices, keeps everything else.
  let { local, session } = seed()
  resetWorkspace({ local, session, now: 1000 })
  assert.equal(local.getItem('devsign:demo:conflicts'), null)
  assert.equal(local.getItem('devsign:demo:project:x:historyEntries'), null)
  assert.equal(session.getItem('devsign:notices-seen:v1'), null)
  assert.equal(local.getItem('devsign:language'), 'ko')

  // Undo within 10s restores everything exactly.
  assert.ok(pendingUndo(session, 1000 + UNDO_MS - 1))
  assert.equal(undoReset({ local, session, now: 1000 + UNDO_MS - 1 }), true)
  assert.equal(local.getItem('devsign:demo:conflicts'), '{"a":1}')
  assert.equal(local.getItem('devsign:demo:project:x:historyEntries'), '[1,2]')
  assert.equal(session.getItem('devsign:notices-seen:v1'), 'seen')
  assert.equal(pendingUndo(session, 1001), null, 'snapshot is dropped after undo')

  // After 10s the snapshot is gone and undo does nothing.
  ;({ local, session } = seed())
  resetWorkspace({ local, session, now: 1000 })
  assert.equal(undoReset({ local, session, now: 1000 + UNDO_MS }), false)
  assert.equal(local.getItem('devsign:demo:conflicts'), null)

  // Failure while clearing leaves the data as it was and no undo pending.
  ;({ local, session } = seed())
  const broken = new Proxy(local, { get: (t, k) => (k === 'removeItem' ? () => { throw new Error('denied') } : t[k]) })
  assert.throws(() => resetWorkspace({ local: broken, session, now: 1000 }))
  assert.equal(local.getItem('devsign:demo:conflicts'), '{"a":1}')
  assert.equal(session.getItem('devsign:notices-seen:v1'), 'seen')
  assert.equal(session.getItem('devsign:reset-undo:v1'), null)

  // A data change after the reload settles discards the snapshot; mount-time writes do not.
  ;({ local, session } = seed())
  const realSession = globalThis.sessionStorage
  globalThis.sessionStorage = session
  try {
    resetWorkspace({ local, session, now: 1000 })
    noteDataChange(1000 + 500)
    assert.ok(pendingUndo(session, 1600), 'writes while the app mounts keep it')
    noteDataChange(1000 + 2000)
    assert.equal(pendingUndo(session, 3100), null, 'a later change drops it')
  } finally { globalThis.sessionStorage = realSession }
  console.log('workspace-reset: ok')
} finally {
  await server.close()
}
