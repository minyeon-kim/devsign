import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The prototype played in a card's place on the Screens board: a session of
// its own on the shared engine, what each card is to the screen showing,
// where the camera goes once, the lines from hotspots, its address — and the
// frame that never shows a gap between two screens.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { prototypeOf, boardLayout } = await server.ssrLoadModule('/src/lib/screens.js')
  const { startSession, follow, currentOf, sessionAt } = await server.ssrLoadModule('/src/lib/prototypeEngine.js')
  const { interactionsOf, tierOf, pathAhead, cameraFor, hotspotLine, readProto, withProto, motionOf, MOTION } = await server.ssrLoadModule('/src/lib/boardPrototype.js')
  const shop = prototypeOf('checkout-redesign')
  const layout = boardLayout(shop)
  const ids = shop.screens.map((screen) => screen.id)
  const card = (id) => layout.cards.find((entry) => entry.id === id)

  // Its own session: moving here leaves another session (Preview's) where it was — same engine, two states.
  const preview = startSession('page-cart')
  let board = startSession('page-home')
  board = follow(shop, board, shop.screens.find((s) => s.id === 'page-home').transitions.find((t) => t.targetScreenId === 'page-product')).session
  assert.deepEqual([currentOf(board), currentOf(preview), preview.history], ['page-product', 'page-cart', ['page-cart']])
  assert.equal(sessionAt(preview, 'page-cart'), preview, 'the screen in view didn’t change, so Preview’s session didn’t')

  // The interactions of a screen, numbered as listed.
  const home = interactionsOf(shop, 'page-home')
  assert.deepEqual(home.map((entry) => [entry.n, entry.transition.hotspotId, entry.target]), [[1, 'hm-search', 'page-products'], [2, 'hm-cat-lighting', 'page-products'], [3, 'hm-featured', 'page-product']])
  assert.ok(home.every((entry) => entry.layer))
  assert.deepEqual(interactionsOf(shop, 'page-nope'), [])

  // What each card is to the screen showing.
  const at = { frameId: 'page-home', current: 'page-product' }
  assert.equal(tierOf(shop, at, 'page-home'), 'frame')
  assert.equal(tierOf(shop, at, 'page-product'), 'current', 'the board’s own card of the screen showing')
  assert.equal(tierOf(shop, at, 'page-cart'), 'next')
  assert.equal(tierOf(shop, at, 'page-products'), 'next', 'a way back is somewhere it leads')
  assert.equal(tierOf(shop, at, 'page-checkout'), 'later')
  assert.equal(tierOf(shop, at, 'page-order-complete'), 'later')
  assert.equal(tierOf(shop, at, 'page-splash'), 'rest', 'another flow')
  assert.equal(tierOf(shop, at, 'page-coupon-notice'), 'rest')
  // On a branch, "later" is what follows the screen it branched from.
  assert.equal(tierOf(shop, { frameId: 'page-home', current: 'page-payment-failed' }, 'page-order-complete'), 'later')
  assert.equal(tierOf(shop, { frameId: 'page-home', current: 'page-payment-failed' }, 'page-checkout'), 'next')
  assert.deepEqual(pathAhead(shop, 'page-product'), ['page-cart', 'page-checkout', 'page-order-complete'])
  assert.deepEqual(pathAhead(shop, 'page-order-complete'), [])
  assert.deepEqual(pathAhead(shop, 'page-coupon-notice'), [])

  // The camera: the frame readable (50%–100%), with where it leads in view when that fits; whole pixels.
  const room = { width: 1200, height: 800 }
  const camera = cameraFor(layout.cards, 'page-home', ['page-products', 'page-product'], room, 0.2)
  assert.ok(camera.zoom >= 0.5 && camera.zoom <= 1)
  assert.ok(Number.isInteger(camera.x) && Number.isInteger(camera.y))
  for (const id of ['page-home', 'page-products', 'page-product']) {
    const c = card(id)
    assert.ok(camera.x + c.x * camera.zoom >= 0 && camera.x + (c.x + c.width) * camera.zoom <= room.width, `${id} is in view`)
  }
  // No room for them at a size that reads: the frame alone, centred — still at 50% or more.
  const tight = cameraFor(layout.cards, 'page-login', ['page-home', 'page-login-error'], { width: 500, height: 500 }, 0.2)
  assert.ok(tight.zoom >= 0.5)
  const login = card('page-login')
  assert.ok(Math.abs(tight.x + (login.x + login.width / 2) * tight.zoom - 250) <= 1, 'the frame is centred')
  assert.equal(cameraFor(layout.cards, 'page-nope', [], room, 1), null)
  // Already closer than that: the zoom is left alone (never past 100%).
  assert.equal(cameraFor(layout.cards, 'page-home', [], room, 1).zoom, 1)

  // A line: from the hotspot's height on the frame's facing side to the card it leads to.
  const layer = home[2].layer
  const line = hotspotLine(card('page-home'), layer, card('page-product'))
  assert.ok(line.d.startsWith(`M${card('page-home').x + card('page-home').width + 2} ${card('page-home').y + layer.y + layer.height / 2}`))
  assert.equal(hotspotLine(card('page-home'), layer, card('page-products')).short, true, 'between neighbours: room for the number only')
  assert.match(hotspotLine(card('page-checkout'), { x: 20, y: 240, width: 240, height: 40 }, card('page-payment-failed')).d, /C/, 'down to a branch: a curve')
  assert.ok(hotspotLine(card('page-products'), { x: 16, y: 34, width: 28, height: 28 }, card('page-home')).d.startsWith(`M${card('page-products').x - 2} `), 'a way back leaves from the left')

  // The address: the card it plays in, and the screen showing.
  assert.deepEqual(readProto('?view=screens&proto=home&at=cart', ids), { frameId: 'page-home', current: 'page-cart' })
  assert.deepEqual(readProto('?proto=home', ids), { frameId: 'page-home', current: 'page-home' })
  assert.equal(readProto('?proto=nope&at=cart', ids), null)
  assert.equal(readProto('?view=screens', ids), null)
  assert.equal(withProto('?view=screens&screen=home', { frameId: 'page-home', current: 'page-cart' }), '?view=screens&screen=home&proto=home&at=cart')
  assert.equal(withProto('?view=screens&proto=home&at=cart', null), '?view=screens')

  // Motion: only transform and opacity; a fade never makes the old screen see-through; none under reduced motion.
  assert.deepEqual([MOTION.slide.duration, MOTION.slide.easing, MOTION.fade.duration], [300, 'cubic-bezier(0.2, 0, 0, 1)', 200])
  for (const motion of Object.values(MOTION)) for (const frames of [motion.incoming, motion.outgoing].filter(Boolean)) for (const frame of frames) assert.ok(Object.keys(frame).every((key) => key === 'transform' || key === 'opacity'))
  assert.equal(MOTION.fade.outgoing, null, 'the screen going out stays whole under the one coming in')
  assert.deepEqual([MOTION.slide.incoming[0].transform, MOTION.slide.outgoing[1].transform], ['translateX(100%)', 'translateX(-100%)'], 'the two move edge to edge: the frame is always covered')
  assert.equal(motionOf('slide', true), null)
  assert.equal(motionOf('none'), null)
  assert.equal(motionOf('fade'), MOTION.fade)

  // --- The frame ---
  const frame = read('components/screens/PlayFrame.jsx')
  const boardSource = read('components/screens/ScreensBoard.jsx')
  // Two layers; the one coming is got ready unseen, and nothing moves before it's painted.
  assert.ok(frame.includes('data-play-layer="shown"') && frame.includes('data-play-layer="coming"') && frame.includes('style={{ opacity: 0 }}'))
  assert.ok(frame.includes('Promise.all([fontsReady(), imagesReady(incoming)]).then(painted)') && frame.includes('requestAnimationFrame(() => requestAnimationFrame(resolve))') && frame.includes('img.decode'))
  // Keyed by screen: the layer that came in is the same element once it's the one showing; the swap is one commit.
  assert.ok(frame.includes('<div key={shown.id} ref={shownRef}') && frame.includes('<div key={coming.screen.id} ref={comingRef}'))
  assert.ok(frame.indexOf('setShown(coming.screen)') < frame.indexOf('setComing(null)') && frame.includes('// One commit: the new layer is the one showing and the old one is gone.'))
  // will-change only while it moves; the frame is the screen's paper throughout; one change at a time.
  assert.ok(frame.includes("layer.style.willChange = 'transform, opacity'") && frame.includes("layer.style.willChange = ''"))
  assert.ok(frame.includes("className={cn('relative overflow-hidden bg-white', className)}") && frame.includes('className="absolute inset-0 bg-white"'))
  assert.ok(frame.includes('if (busy.current || !next) return false'))
  assert.ok(!/animate\(\[[^\]]*(width|height|left|top)/.test(frame) && !/transition-\[(width|height)/.test(frame), 'no layout property is animated')
  // Slow: the screen showing stays, with a mark; failed: it stays and says so.
  assert.ok(frame.includes('window.setTimeout(() => { if (!cancelled) setSlow(true) }, 800)') && frame.includes('data-play-loading') && frame.includes('data-play-failed'))
  // --- On the board ---
  assert.ok(boardSource.includes('onDoubleClick={() => enter(card.id)}') && boardSource.includes('enter(activePageId)') && boardSource.includes("onClick={() => { if (!proto) { setActivePageId(card.id); rootRef.current?.focus() } }}"))
  assert.ok(boardSource.includes('if (!proto || frameRef.current?.busy()) return'), 'a press during a change is let go')
  assert.ok(boardSource.includes("if (event.target.closest('[data-proto-frame]') && !(event.ctrlKey || event.metaKey)) return"), 'a plain wheel over the frame never moves the board')
  assert.ok(boardSource.includes('onPointerDown={(event) => event.stopPropagation()}\n                  onClick={(event) => event.stopPropagation()}\n                  onDoubleClick={(event) => event.stopPropagation()}'))
  for (const mark of ['data-proto-toolbar', 'data-proto-back', 'data-proto-restart', 'data-proto-marks', 'data-proto-preview', 'data-proto-exit', 'data-proto-panel', 'data-proto-row', 'data-proto-ahead', 'data-proto-end', 'data-proto-lines', 'data-proto-badge', 'data-proto-now', 'data-proto-leads']) assert.ok(boardSource.includes(mark), mark)
  assert.ok(boardSource.includes("showScreenIn('preview', current)") && boardSource.includes("tier === 'later' && 'opacity-60', tier === 'rest' && 'opacity-25'"))
  assert.ok(boardSource.includes('{ el.blur(); return }') && boardSource.includes('exitNow.current()'), 'Esc: out of a field first, then out')
  assert.ok(boardSource.includes('role="status" aria-live="polite"') && boardSource.includes('aria-expanded={panelOpen}') && boardSource.includes('localStorage.setItem(PANEL_KEY'))
  // (While it plays the screen in view isn't touched — that's Preview's; leaving selects the last screen shown.)
  const enterBody = boardSource.slice(boardSource.indexOf('const press = (transition) => {'), boardSource.indexOf('const exit = () => {'))
  assert.ok(!enterBody.includes('setActivePageId'), 'moving in the frame doesn’t move the Workspace’s screen')
  console.log('Passed: the board’s prototype — its own session, card tiers, camera, lines, address, and the two-layer frame’s rules.')
} finally { await server.close() }
