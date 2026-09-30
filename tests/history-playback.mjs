import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Run the production hook with deterministic effect/timer scheduling.
const slots = []
let cursor = 0, dirty = false, selected = 'c', output, pending = []
let timeline = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const timers = new Map()
let timerId = 0
const hooks = {
  useState(initial) {
    const i = cursor++
    slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }
    return [slots[i].value, value => {
      const next = typeof value === 'function' ? value(slots[i].value) : value
      if (next !== slots[i].value) { slots[i].value = next; dirty = true }
    }]
  },
  useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i] },
  useEffect(effect, deps) {
    const i = cursor++
    const previous = slots[i]
    if (!previous || deps.some((v, n) => v !== previous.deps[n])) {
      pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() } })
    }
  },
}
globalThis.window = {
  setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id },
  clearTimeout(id) { timers.delete(id) },
}
const source = (await readFile(new URL('../src/components/history/useHistoryPlayback.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/, '').replace('export function', 'function')
const hook = new Function('hooks', `const { useState, useRef, useEffect } = hooks; ${source}; return useHistoryPlayback`)(hooks)
const select = id => { selected = id; dirty = true }
function render() {
  do {
    dirty = false; cursor = 0; pending = []
    output = hook(timeline, selected, select)
    pending.forEach(fn => fn())
  } while (dirty)
}
function tick() {
  const callbacks = [...timers.values()]; timers.clear()
  callbacks.forEach(fn => fn()); render()
}
render()
output.toggle(); render()
assert.equal(selected, 'a', 'play from newest restarts at oldest')
assert.equal(output.playing, true)
tick(); assert.equal(selected, 'b'); assert.equal(output.playing, true)
tick(); assert.equal(selected, 'c'); assert.equal(output.playing, false)
assert.equal(timers.size, 0, 'stops at the last checkpoint')
output.toggle(); render(); output.pause(); render(); tick()
assert.equal(selected, 'a', 'pause cancels the queued advance')
output.toggle(); render(); select('b'); render()
assert.equal(output.playing, false, 'manual selection of even the next version stops replay')
assert.equal(timers.size, 0)
output.toggle(); render(); tick()
assert.equal(selected, 'c'); assert.equal(output.playing, false)
timeline = [{ id: 'a' }]; select('a'); render(); output.toggle(); render()
assert.equal(output.playing, false, 'one checkpoint cannot play')
delete globalThis.window
console.log('Passed: replay restart, ordered advancement, end stop, pause cancellation and manual selection interruption.')
