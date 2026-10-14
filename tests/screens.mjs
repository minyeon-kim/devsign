import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The Workspace as Preview · Screens · Code: the view and the screen in the
// address, the Screens board's placement (by the flows' own order, the same
// every time), its links, and the prototype data itself — every reference
// real, every screen reachable.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { prototypeOf, boardLayout, linksOf, transitionsOf, validatePrototype, screenOrder, BOARD } = await server.ssrLoadModule('/src/lib/screens.js')
  const { boardFit, clampZoom, zoomAt, visibleCards, linkPath, ZOOM_MIN, ZOOM_MAX } = await server.ssrLoadModule('/src/lib/screensBoard.js')
  const { VIEWS, readViewParams, withView, screenSlug, defaultViewOf, readLastView, writeLastView } = await server.ssrLoadModule('/src/lib/viewLink.js')
  const { projects } = await server.ssrLoadModule('/src/data/mockData.js')
  const { PROTOTYPES, LANDING_PROJECT_ID } = await server.ssrLoadModule('/src/data/screenPages.js')
  const { PROTOTYPE_FILES } = await server.ssrLoadModule('/src/lib/prototypeSync.js')
  const files = new Set(PROTOTYPE_FILES.map((file) => file.path))

  // --- The data: every project's prototype is sound (run for all of them, always) ---
  for (const project of projects) {
    const prototype = prototypeOf(project.id)
    assert.deepEqual(validatePrototype(prototype, { files }), [], `${project.id}: no broken references, duplicates, unreachable screens or dead ends`)
    assert.ok(prototype.screens.length > 0, `${project.id} has a screen`)
  }
  for (const id of Object.keys(PROTOTYPES)) assert.ok(projects.some((project) => project.id === id), `${id} is a project`)

  // The shop: fourteen screens in two flows — a branch off Login, three off Checkout (a declined card, the
  // payment methods, a coupon), each leading back — and a way back Home.
  const shop = prototypeOf('checkout-redesign')
  assert.equal(shop.kind, 'multi-screen')
  assert.equal(shop.startScreenId, 'page-splash')
  assert.deepEqual(shop.flows.map((flow) => [flow.id, flow.screenIds.length, flow.branches.length]), [['onboarding', 4, 1], ['purchase', 6, 3]])
  assert.equal(shop.flows.reduce((n, flow) => n + flow.screenIds.length + flow.branches.reduce((m, b) => m + b.screenIds.length, 0), 0), 14)
  assert.equal(shop.screens.length, 14, 'every screen is a step of a flow')
  const goes = (from, to) => shop.screens.find((s) => s.id === from).transitions.some((t) => t.targetScreenId === to)
  assert.ok(goes('page-login', 'page-login-error') && goes('page-login-error', 'page-login'), 'a wrong password, and back')
  assert.ok(goes('page-checkout', 'page-payment-failed') && goes('page-payment-failed', 'page-checkout'), 'a declined card, and back')
  assert.ok(goes('page-checkout', 'page-checkout-tabs') && goes('page-checkout-tabs', 'page-checkout'), 'the payment methods, and back')
  assert.ok(goes('page-checkout', 'page-coupon-notice') && goes('page-coupon-notice', 'page-checkout'), 'a coupon, and back')
  assert.ok(shop.screens.every((s) => s.size.width === 280 && s.size.height === 560), 'every screen the same size')
  assert.ok(goes('page-order-complete', 'page-home'), 'the end leads back Home')
  assert.ok(shop.screens.every((s) => s.codeFile && files.has(s.codeFile)), 'every screen has its code file')
  // (The Checkout screen CON-014 is about is the same page as before.)
  assert.deepEqual(shop.screens.find((s) => s.id === 'page-checkout').frame.layers.map((l) => l.id).slice(-2), ['total-text', 'place-order'])
  // Its numbers agree: an $84.00 lamp and a $44.00 cushion are the $128.00 the cart, checkout and receipt say.
  const copy = JSON.stringify(shop.screens.map((s) => s.frame.layers))
  assert.ok(copy.includes('Qty 1 · $84.00') && copy.includes('Qty 1 · $44.00') && copy.includes('Subtotal  $128.00') && copy.includes('2 items · $128.00'))
  assert.ok(!/lorem ipsum/i.test(copy) && !/https?:\/\//.test(copy), 'no filler text, no outside images')
  // The landing page: one page, no flows, its nav jumping to its own sections.
  const landing = prototypeOf(LANDING_PROJECT_ID)
  assert.deepEqual([landing.kind, landing.device, landing.screens.length, landing.flows.length], ['single-page', 'desktop', 1, 0])
  assert.ok(landing.screens[0].transitions.length >= 3 && landing.screens[0].transitions.every((t) => t.scrollTo && t.targetScreenId === 'page-landing'))
  assert.ok(landing.screens[0].size.height > landing.screens[0].size.width, 'a long page')

  // What validation catches.
  const broken = { ...shop, startScreenId: 'page-nope', flows: [{ id: 'f', name: 'F', screenIds: ['page-splash', 'page-ghost'], branches: [{ fromScreenId: 'page-cart', screenIds: ['page-void'] }] }], screens: shop.screens.map((s) => (s.id === 'page-splash' ? { ...s, codeFile: 'src/none.jsx', transitions: [{ id: 't1', hotspotId: 'not-a-layer', targetScreenId: 'page-missing' }, { id: 't1', hotspotId: 'sp-start', targetScreenId: 'page-home' }] } : s)) }
  const said = validatePrototype(broken, { files }).join('\n')
  for (const part of ['start screen "page-nope"', '"page-ghost", which doesn\'t exist', 'branches from "page-cart"', '"page-void"', 'goes to "page-missing"', 'starts from "not-a-layer"', 'transition id "t1" is used twice', '"src/none.jsx", which doesn\'t exist']) assert.ok(said.includes(part), `says: ${part}`)
  const island = { ...shop, screens: shop.screens.map((s) => (s.id === 'page-order-complete' ? { ...s, transitions: [] } : s.id === 'page-login' ? { ...s, transitions: s.transitions.filter((t) => t.targetScreenId !== 'page-home') } : s)) }
  const lost = validatePrototype(island, { files }).join('\n')
  assert.ok(lost.includes('"page-home" can\'t be reached from the start') && lost.includes('"page-order-complete" is a dead end'))
  // A link that can't be followed is set aside, never followed.
  assert.deepEqual(transitionsOf(broken, 'page-splash').live.map((t) => t.targetScreenId), ['page-home'])
  assert.equal(transitionsOf(broken, 'page-splash').broken.length, 1)

  // --- The board ---
  const layout = boardLayout(shop)
  assert.deepEqual(boardLayout(shop), layout, 'the same data, the same board')
  const at = (id) => layout.cards.find((card) => card.id === id)
  assert.equal(layout.cards.length, shop.screens.length, 'every screen is placed, once')
  // A flow's screens: left to right on one row, in the order the flow says.
  for (const flow of shop.flows) {
    const row = flow.screenIds.map(at)
    assert.ok(row.every((card, i) => card.row === 0 && card.col === i && card.y === row[0].y && (i === 0 || card.x > row[i - 1].x + row[i - 1].width)), `${flow.id} runs left to right`)
  }
  // A branch: on the same row, after the flow's own screens — a flow is one row.
  const onboarding = shop.flows.find((flow) => flow.id === 'onboarding')
  assert.deepEqual([at('page-login-error').row, at('page-login-error').col], [0, onboarding.screenIds.length])
  assert.ok(layout.cards.every((card) => card.row === 0), 'every flow is one row')
  assert.equal(at('page-login-error').y, at('page-login').y)
  assert.ok(at('page-payment-failed').x > at('page-checkout').x && at('page-payment-failed').y === at('page-checkout').y)
  // Flows are groups, one under the other, each named; what's in no flow comes last as "Other screens".
  assert.deepEqual(layout.groups.map((group) => group.name), ['Onboarding', 'Purchase'])
  assert.ok(layout.groups.every((group, i) => i === 0 || group.y > layout.groups[i - 1].y + layout.groups[i - 1].height))
  // (A shop where Checkout's two other states are in no flow, for what's said of such screens.)
  const loose = { ...shop, flows: shop.flows.map((flow) => (flow.id === 'purchase' ? { ...flow, branches: flow.branches.slice(0, 1) } : flow)), screens: shop.screens.map((s) => (['page-checkout-tabs', 'page-coupon-notice'].includes(s.id) ? { ...s, transitions: [] } : s)) }
  assert.deepEqual(boardLayout(loose).groups.map((group) => group.name), ['Onboarding', 'Purchase', 'Other screens'])
  assert.deepEqual(boardLayout(loose).cards.filter((card) => card.group === 'other').map((card) => card.id), ['page-checkout-tabs', 'page-coupon-notice'])
  assert.deepEqual(layout.cards.filter((card) => card.start).map((card) => card.id), ['page-splash'])
  assert.deepEqual(layout.cards.map((card) => card.n), layout.cards.map((_, i) => i + 1), 'numbered as placed')
  assert.deepEqual(screenOrder(shop).slice(0, 5), ['page-splash', 'page-onboarding-1', 'page-onboarding-2', 'page-login', 'page-login-error'])
  // No two cards overlap.
  for (const a of layout.cards) for (const b of layout.cards) if (a.id < b.id) assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `${a.id} and ${b.id} don't overlap`)
  // Placement goes by the flow's order, not by what links to what.
  const reversed = { ...shop, flows: [{ ...shop.flows[0], screenIds: [...shop.flows[0].screenIds].reverse(), branches: [] }] }
  assert.deepEqual(boardLayout(reversed).cards.slice(0, 4).map((card) => card.id), ['page-login', 'page-onboarding-2', 'page-onboarding-1', 'page-splash'])
  // One screen: a single card, no group name. No screens: nothing, and no error.
  const one = boardLayout(landing)
  assert.deepEqual([one.cards.length, one.groups.length, one.groups[0].name], [1, 1, null])
  assert.deepEqual(boardLayout({ ...landing, screens: [], startScreenId: null }), { cards: [], groups: [], width: 0, height: 0, cellW: 0, cellH: 0 })
  assert.ok(BOARD.gapX > 0)

  // The links: straight to the next screen of a row; a curve for a branch; another for a way back.
  const links = linksOf(shop, layout.cards)
  const kind = (from, to) => links.find((link) => link.from === from && link.to === to)?.kind
  assert.equal(kind('page-splash', 'page-onboarding-1'), 'next')
  assert.equal(kind('page-onboarding-1', 'page-login'), 'branch', 'a skip ahead isn’t the next screen')
  assert.equal(kind('page-login', 'page-login-error'), 'next', 'a branch is the next card on its flow’s row')
  assert.equal(kind('page-login-error', 'page-login'), 'back')
  assert.equal(kind('page-order-complete', 'page-home'), 'back')
  assert.equal(kind('page-login', 'page-home'), 'branch', 'on to the next flow')
  assert.equal(linksOf(landing, one.cards).length, 0, 'a page’s own anchors aren’t links on the board')
  const straight = linkPath(links.find((l) => l.kind === 'next'), at('page-splash'), at('page-onboarding-1'), layout)
  assert.match(straight.d, /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/)
  assert.match(linkPath({ kind: 'back' }, at('page-login-error'), at('page-login'), layout).d, /C/)
  assert.match(linkPath({ kind: 'branch' }, at('page-login'), at('page-home'), layout).d, /H[\d.]+V[\d.]+H[\d.]+V/, 'between flows: around the cards')
  assert.notEqual(linkPath({ kind: 'branch' }, at('page-login'), at('page-login-error'), layout).d, linkPath({ kind: 'back' }, at('page-login-error'), at('page-login'), layout).d.split('').reverse().join(''))

  // The view: fitted whole, zoomed between 10% and 400% about a point, only what's in view drawn.
  assert.deepEqual([ZOOM_MIN, ZOOM_MAX, clampZoom(5), clampZoom(0.01)], [0.1, 4, 4, 0.1])
  const fitted = boardFit(layout, { width: 1200, height: 800 })
  assert.ok(fitted.zoom <= 1 && layout.width * fitted.zoom <= 1200 && layout.height * fitted.zoom <= 800)
  assert.equal(boardFit({ width: 100, height: 100 }, { width: 1200, height: 800 }).zoom, 1, 'never past 100%')
  const zoomed = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 50 })
  assert.deepEqual(zoomed, { zoom: 2, x: -100, y: -50 }, 'the point under the pointer stays put')
  assert.ok(visibleCards(layout.cards, { x: 0, y: 0, zoom: 1 }, { width: 600, height: 500 }).length < layout.cards.length)
  // Thirty screens are placed and culled like any others.
  const many = { ...shop, flows: [{ id: 'long', name: 'Long', screenIds: Array.from({ length: 30 }, (_, i) => `s${i}`), branches: [] }], screens: Array.from({ length: 30 }, (_, i) => ({ ...shop.screens[0], id: `s${i}` })) }
  const big = boardLayout(many)
  assert.equal(big.cards.length, 30)
  assert.ok(visibleCards(big.cards, { x: 0, y: 0, zoom: 1 }, { width: 1200, height: 800 }).length <= 6)

  // --- The address ---
  const ids = shop.screens.map((s) => s.id)
  assert.deepEqual(VIEWS, ['preview', 'screens', 'code'])
  assert.deepEqual(readViewParams('?view=screens&screen=cart', ids), { view: 'screens', screen: 'page-cart' })
  assert.deepEqual(readViewParams('?view=canvas&screen=nope', ids), { view: null, screen: null }, 'what isn’t real is read as nothing said')
  assert.deepEqual(readViewParams('', ids), { view: null, screen: null })
  assert.equal(withView('?history=h-1', { view: 'code', screen: 'page-cart' }), '?history=h-1&view=code&screen=cart', 'the rest of the address is kept')
  assert.equal(withView('?view=code&screen=cart', { view: null, screen: null }), '')
  assert.equal(screenSlug('page-product'), 'product')
  assert.deepEqual(readViewParams(withView('', { view: 'screens', screen: 'page-order-complete' }), ids), { view: 'screens', screen: 'page-order-complete' }, 'there and back')
  assert.deepEqual([defaultViewOf('multi-screen'), defaultViewOf('single-page')], ['screens', 'preview'])
  const map = new Map(); const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }
  writeLastView('checkout-redesign', 'code', storage); writeLastView('checkout-redesign', 'nope', storage)
  assert.deepEqual([readLastView('checkout-redesign', storage), readLastView(LANDING_PROJECT_ID, storage)], ['code', null], 'kept per project')

  // --- The views, in the app ---
  const tabs = read('components/workspace/WorkspaceViewTabs.jsx')
  const layoutSource = read('components/workspace/WorkspaceSplitLayout.jsx')
  const provider = read('state/WorkspaceProvider.jsx')
  const board = read('components/screens/ScreensBoard.jsx')
  assert.ok(tabs.includes('role="tablist"') && tabs.includes('role="tab"') && tabs.includes('aria-selected={selected}') && tabs.includes('aria-controls={VIEW_PANEL_ID}') && tabs.includes('tabIndex={selected ? 0 : -1}'))
  assert.ok(tabs.includes("selected ? 'bg-white/[0.12] font-semibold text-white'") && tabs.includes('{selected && <span aria-hidden className="absolute inset-x-2.5 bottom-0.5'), 'the one showing: weight and a bar, not color alone')
  assert.ok(read('components/workspace/FloatingWindow.jsx').includes("role={viewPanel ? 'tabpanel' : undefined}"))
  assert.ok(layoutSource.includes("const VIEW_PANELS = { preview: ['preview'], screens: ['screens', 'canvas'], code: ['editor'] }"), 'Screens is its board, or the canvas a screen is edited on')
  assert.ok(layoutSource.includes("/^Digit[1-3]$/.test(event.code) && !isTyping(event.target)"), '⌥1–3, not while typing')
  assert.ok(provider.includes('navigate({ pathname: at.pathname, search }, { replace: true, state: at.state })'), 'tabs and screens replace the address')
  assert.ok(provider.includes('const workspaceView = viewSaid.view ?? lastView ?? defaultViewOf(prototype.kind)'))
  assert.ok(provider.includes("if (workspaceView !== 'code' || !activePageId || codeScreen.current === activePageId) return"), 'Code opens the screen’s file')
  // The board: cards never interactive inside, each behind its own error boundary; play, select, keys.
  assert.ok(board.includes('class CardBoundary extends Component') && board.includes('static getDerivedStateFromError()') && board.includes('data-screen-error'))
  assert.ok(board.includes('<div aria-hidden className="pointer-events-none absolute inset-0">'))
  assert.ok(board.includes('{drawn.has(card.id) && <ScreenDrawing frame={screen.frame} />}'), 'only the cards in view are drawn')
  assert.ok(board.includes('onDoubleClick={() => enter(card.id)}') && board.includes("event.key === 'Enter' && activePageId") && board.includes("{ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }"))
  assert.ok(board.includes("aria-label={`Screen ${card.n}, ${screen.name}, goes to ${out} ${out === 1 ? 'screen' : 'screens'}${open.length ? `, ${openLabel(open.length)}` : ''}`}"), 'a card is named with where it goes and its open changes')
  // (No overlay player: a double press plays in the card's place — tests/board-prototype; ▶ shows the screen in Preview.)
  assert.ok(!/PrototypePlayer|data-prototype-player|data-board-play\b/.test(board) && board.includes("showScreenIn('preview', id)"))
  assert.ok(board.includes('data-single-page') && board.includes('This project is a single page.') && board.includes('data-empty'))
  console.log('Passed: Preview · Screens · Code in the address; the board placed by its flows, linked and culled; every project’s prototype data sound.')
} finally { await server.close() }
