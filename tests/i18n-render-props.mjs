import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement, cloneElement } from 'react'
import { jsx } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { localizedJsx } = await server.ssrLoadModule('/src/i18n/runtime.js')
  let received
  function Probe(props) { received = props; return createElement('button', null, props.children) }
  const click = () => {}
  const ref = () => {}
  const translated = localizedJsx(jsx, Probe, { title: 'Settings', children: 'Settings' })
  renderToStaticMarkup(cloneElement(translated, { onClick: click, ref, 'aria-expanded': true, 'data-state': 'open' }))
  assert.equal(received.onClick, click)
  assert.equal(received.ref, ref)
  assert.equal(received['aria-expanded'], true)
  assert.equal(received['data-state'], 'open')
  assert.ok(received.children)
  console.log('Passed: translated render elements forward injected click handlers, refs and popup state.')
} finally {
  await server.close()
}
