import assert from 'node:assert/strict'
import { createServer } from 'vite'

// History's preview on another phone: the frame takes the phone's
// proportions and each element keeps to its edge; the "Changed element"
// view is the box around what changed.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { DEVICES, focusBox, frameOnDevice, isPhoneFrame } = await server.ssrLoadModule('/src/lib/devicePreview.js')
  const { canvasPages } = await server.ssrLoadModule('/src/data/mockData.js')
  const frame = canvasPages.find((page) => page.id === 'page-1').frames[0]
  const layer = (f, id) => f.layers.find((l) => l.id === id)
  assert.ok(isPhoneFrame(frame))
  assert.equal(frameOnDevice(frame, 'design'), frame, 'the design frame is drawn as is')

  const max = frameOnDevice(frame, 'iphone-15-pro-max')
  assert.ok(max.width > frame.width && max.height > frame.height)
  assert.equal(layer(max, 'tab-bar').width, max.width, 'a full-width bar stretches')
  assert.equal(layer(max, 'tab-bar').y + layer(max, 'tab-bar').height, max.height, 'the tab bar stays at the bottom')
  assert.equal(max.width - (layer(max, 'menu-button').x + layer(max, 'menu-button').width), 20, 'a right-aligned button keeps its inset')
  assert.equal(layer(max, 'nav-title').x, layer(frame, 'nav-title').x, 'left-aligned text stays put')
  assert.equal(layer(max, 'primary-button').width, max.width - 40, 'an inset full-width button stretches')

  const se = frameOnDevice(frame, 'iphone-se')
  assert.ok(se.height < frame.height, 'a shorter phone cuts the screen off')
  assert.equal(layer(se, 'tab-bar').y + layer(se, 'tab-bar').height, se.height, '…with the tab bar still at its bottom')

  const box = focusBox(max, ['tab-bar'])
  assert.ok(box && box.layers[0].id === 'tab-bar')
  assert.ok(box.y <= layer(max, 'tab-bar').y && box.y + box.height >= layer(max, 'tab-bar').y + layer(max, 'tab-bar').height)
  assert.equal(focusBox(max, ['nope']), null)
  assert.ok(DEVICES.length >= 5 && DEVICES[0].id === 'design')
  // A tablet or a browser: the content in a centred column, fluid; a browser trades the status bar for its address bar.
  const { BROWSER_CHROME } = await server.ssrLoadModule('/src/lib/devicePreview.js')
  const tablet = frameOnDevice(frame, 'ipad-air')
  assert.ok(tablet.width > max.width && !tablet.chrome)
  const button = layer(tablet, 'primary-button')
  assert.ok(Math.abs(button.x + button.width / 2 - tablet.width / 2) <= 2, 'the column is centred')
  assert.ok(button.width > layer(frame, 'primary-button').width, 'its layers grow with it')
  assert.equal(layer(tablet, 'tab-bar').width, tablet.width, 'a full-bleed bar spans the screen')
  assert.equal(layer(tablet, 'tab-bar').y + layer(tablet, 'tab-bar').height, tablet.height, '…at its bottom')
  const browser = frameOnDevice(frame, 'browser-1440')
  assert.ok(browser.chrome && browser.chrome.height === Math.round(BROWSER_CHROME * frame.width / 390))
  assert.ok(browser.layers.every((l) => !(l.type === 'bar' && l.y <= browser.chrome.height && l.width >= browser.width - 4)), 'no status bar in a browser')
  assert.ok(Math.min(...browser.layers.map((l) => l.y)) >= browser.chrome.height, 'nothing under the address bar')
  assert.deepEqual([...new Set(DEVICES.filter((d) => d.kind).map((d) => d.kind))], ['phone', 'tablet', 'browser'])
  console.log('Passed: phones re-lay the frame edge by edge, and the changed element is boxed for the close-up view.')
} finally { await server.close() }
