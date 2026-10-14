import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Preview is the prototype, playing (one engine, one session — the
// Workspace's); the Screens board counts each screen's open changes on the
// change pin.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { prototypeOf } = await server.ssrLoadModule('/src/lib/screens.js')
  const engine = await server.ssrLoadModule('/src/lib/prototypeEngine.js')
  const { startSession, currentOf, sessionAt, follow, stepBack, canStepBack, restart, flowOf, positionOf, isEnd } = engine
  const { conflictsByScreen, countLabel, conflictReferenceProblems, isCounted } = await server.ssrLoadModule('/src/lib/screenConflicts.js')
  const derive = await server.ssrLoadModule('/src/mocks/derive.js')
  const { LANDING_PROJECT_ID } = await server.ssrLoadModule('/src/data/screenPages.js')
  const shop = prototypeOf('checkout-redesign')
  const landing = prototypeOf(LANDING_PROJECT_ID)
  const t = (screenId, target) => shop.screens.find((s) => s.id === screenId).transitions.find((x) => x.targetScreenId === target)

  // --- The engine ---
  let session = startSession('page-home')
  assert.equal(currentOf(session), 'page-home')
  assert.equal(canStepBack(session), false)
  // A hotspot pressed: on to its target, the way taken remembered.
  for (const [from, to] of [['page-home', 'page-product'], ['page-product', 'page-cart'], ['page-cart', 'page-checkout']]) {
    const result = follow(shop, session, t(from, to))
    assert.deepEqual([result.moved, result.broken, currentOf(result.session)], [true, false, to])
    session = result.session
  }
  assert.deepEqual(session.history, ['page-home', 'page-product', 'page-cart', 'page-checkout'])
  // Round a loop (a declined card, and back): the history just grows.
  session = follow(shop, session, t('page-checkout', 'page-payment-failed')).session
  session = follow(shop, session, t('page-payment-failed', 'page-checkout')).session
  assert.deepEqual(session.history.slice(-3), ['page-checkout', 'page-payment-failed', 'page-checkout'])
  // Back: one screen at a time, through what was passed; nothing at the first.
  assert.equal(currentOf(stepBack(session)), 'page-payment-failed')
  assert.equal(stepBack(startSession('page-home')).history.length, 1)
  // On to another flow: the flow it's in changes with it.
  const login = startSession('page-login')
  assert.equal(flowOf(shop, 'page-login').id, 'onboarding')
  assert.equal(flowOf(shop, currentOf(follow(shop, login, t('page-login', 'page-home')).session)).id, 'purchase')
  assert.equal(flowOf(shop, 'page-login-error').id, 'onboarding', 'a branch is part of its flow')
  assert.equal(flowOf(shop, 'page-coupon-notice'), null)
  // A link that can't be followed: nothing moves, and it's said so.
  const nowhere = { id: 'ghost', hotspotId: 'hm-search', targetScreenId: 'page-missing' }
  assert.deepEqual([follow(shop, login, nowhere).moved, follow(shop, login, nowhere).broken, follow(shop, login, nowhere).session], [false, true, login])
  assert.equal(follow(shop, login, t('page-home', 'page-product')).broken, true, 'a hotspot of another screen isn’t this screen’s')
  assert.equal(follow(shop, login, null).broken, true)
  // Start over: from the first screen of the flow it's in (or the one asked for, or the project's start).
  assert.deepEqual(restart(shop, session).history, ['page-home'])
  assert.deepEqual(restart(shop, session, 'onboarding').history, ['page-splash'])
  assert.deepEqual(restart(shop, startSession('page-coupon-notice')).history, ['page-splash'])
  // Where it stands: a step of its flow's row; on a branch, no step; outside any flow, nothing.
  assert.deepEqual([positionOf(shop, 'page-product').step, positionOf(shop, 'page-product').total], [3, 6])
  assert.deepEqual([positionOf(shop, 'page-payment-failed').flow.id, positionOf(shop, 'page-payment-failed').step], ['purchase', null])
  assert.deepEqual(positionOf(shop, 'page-checkout-tabs'), { flow: null, step: null, total: null })
  // The end of a flow: a screen with nowhere to go. (None of the shop's flow screens is one; its component states are.)
  assert.equal(isEnd(shop, 'page-order-complete'), false)
  assert.equal(isEnd(shop, 'page-coupon-notice'), true)
  // A page's own links: nothing moves — the section to scroll to is named.
  const anchor = landing.screens[0].transitions[0]
  const jumped = follow(landing, startSession('page-landing'), anchor)
  assert.deepEqual([jumped.moved, jumped.scrollTo, jumped.session.history], [false, anchor.scrollTo, ['page-landing']])
  assert.equal(isEnd(landing, 'page-landing'), true, 'anchors go nowhere else')
  // One session, shared: it carries on when the screen in view is where it is, and starts over from a screen picked elsewhere.
  assert.equal(sessionAt(session, 'page-checkout'), session)
  assert.deepEqual(sessionAt(session, 'page-splash'), { history: ['page-splash'] })

  // --- Open changes, by screen ---
  const conflicts = derive.seededConflicts().filter((c) => c.projectId === 'checkout-redesign')
  const counted = conflictsByScreen(shop, conflicts)
  const count = (id) => counted.byScreen.get(id)?.length ?? 0
  assert.deepEqual([count('page-checkout-tabs'), count('page-coupon-notice'), count('page-checkout'), count('page-home'), count('page-cart')], [1, 2, 6, 0, 0], 'one, two, several, and screens with none')
  assert.ok(conflicts.some((c) => c.reviewStage === 'resolved') && [...counted.byScreen.values()].flat().every(isCounted), 'a resolved one isn’t counted')
  assert.deepEqual(counted.unplaced.map((c) => c.id), ['CON-025'], 'about no screen: on no card')
  assert.equal(counted.total, 10, '…but in the total')
  assert.equal(conflictsByScreen(shop, conflicts.map((c) => ({ ...c, reviewStage: 'resolved' }))).total, 0, 'decided elsewhere, the numbers follow')
  assert.equal(conflictsByScreen(shop, [{ id: 'x', layerId: 'place-order', reviewStage: 'detected', rollback: true }]).total, 0)
  // One change about elements on two screens is on both cards, once in the total.
  const two = conflictsByScreen(shop, [{ id: 'both', reviewStage: 'detected', layerId: 'place-order', layerIds: ['ct-checkout'] }])
  assert.deepEqual([two.byScreen.get('page-checkout').length, two.byScreen.get('page-cart').length, two.total], [1, 1, 1])
  assert.deepEqual([countLabel(1), countLabel(99), countLabel(100), countLabel(2500)], ['1', '99', '99+', '99+'])
  // Every change points at an element and a screen that exist.
  assert.deepEqual(conflictReferenceProblems(shop, conflicts), [])
  assert.deepEqual(conflictReferenceProblems(landing, derive.seededConflicts().filter((c) => c.projectId === LANDING_PROJECT_ID)), [])
  assert.equal(conflictReferenceProblems(shop, [{ id: 'bad', layerId: 'nope', designPageId: 'page-gone' }]).length, 2)

  // --- In the app ---
  const preview = read('components/screens/PrototypePreview.jsx')
  const board = read('components/screens/ScreensBoard.jsx')
  const provider = read('state/WorkspaceProvider.jsx')
  const layout = read('components/workspace/WorkspaceSplitLayout.jsx')
  const rail = read('components/dashboard/Sidebar.jsx')
  const panel = read('components/dockview/panels/PreviewPanelContent.jsx')
  // One engine, one session: the provider's; Preview only presses.
  assert.ok(provider.includes('const prototypeSession = sessionAt(playedSession, activePageId)') && provider.includes('const result = follow(now, session, transition)'))
  assert.ok(preview.includes('const result = prototypeFollow(transition)') && !/history: \[/.test(preview), 'no second copy of the moves')
  assert.ok(layout.includes('preview: PrototypePreview,'))
  // Its toolbar: back, start over, flows, where it is, hotspots, show on Screens — the flow ones not on a single page.
  for (const mark of ['data-proto-back', 'data-proto-restart', 'data-proto-flows', 'data-proto-position', 'data-proto-hotspots', 'data-proto-locate']) assert.ok(preview.includes(mark), mark)
  assert.ok(preview.indexOf('{!single && (') < preview.indexOf('data-proto-back') && preview.indexOf('data-proto-position') < preview.indexOf('data-proto-hotspots'))
  assert.ok(preview.includes("showScreenIn('screens', activePageId)") && panel.includes('data-preview-fullscreen aria-pressed={fullscreen}'))
  // Hotspots are buttons (Enter and Space press them); the animation is the transition's — none under reduced motion.
  assert.ok(preview.includes('data-hotspot={transition.hotspotId}') && preview.includes("how: reducedMotion() ? 'none' : transition.animation ?? 'none'"))
  assert.ok(preview.includes("scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })"))
  assert.ok(preview.includes('data-proto-end') && preview.includes('const end = !single && isEnd(prototype, activePageId)'))
  assert.ok(preview.includes('role="status" aria-live="polite"') && preview.includes('console.warn(`[prototype]'))
  // ⌥← · R · H — not while typing, only while Preview shows, never under a layer.
  assert.ok(preview.includes("event.altKey && event.key === 'ArrowLeft'") && preview.includes("event.key.toLowerCase() === 'r' && !single") && preview.includes("event.key.toLowerCase() === 'h'") && preview.includes('isTyping(event.target)') && preview.includes("const showing = workspaceView === 'preview'"))
  // Screens and addresses move in one step, replacing — the browser's Back isn't the prototype's.
  assert.ok(provider.includes("sayView({ view, screen: id })") && provider.includes('{ replace: true, state: at.state }'))
  // The board's changes, by distance: far (under 55%) "+N" on the card; near, a marker (the canvas's pin) on every element
  // a change is about — pointed at, the element outlined; pressed, the change opens (several: listed) — and "+N" for the rest.
  assert.ok(board.includes('const DETAIL_ZOOM = 0.55') && board.includes('const detailed = shown.zoom >= DETAIL_ZOOM'))
  assert.ok(board.includes('<CountBubble compact={corner} count={countLabel(rest.length)}') && board.includes('+{count}</span>') && board.includes('const rest = detailed && !proto ? open.filter((conflict) => !onElements.has(conflict.id)) : open'))
  assert.ok(board.includes('function markersOf(screen, conflicts)') && board.includes('data-screen-marker') && board.includes('data-marker-outline') && board.includes('onOpen={(conflict) => openConflictReview(conflict.id)}'))
  assert.ok(board.includes('<PinShape head=') && read('components/conflicts/ConflictPins.jsx').includes('export function PinShape('), 'the same pin as the canvas’s')
  // Pressed, a marker's popover — right there: each change's risk, status, a line of it, and a way to its detail.
  assert.ok(board.includes('<PopoverContent side="right"') && board.includes('data-marker-open={conflict.id}') && board.includes('line-clamp-2'))
  assert.ok(board.includes('transform: `scale(${1 / shown.zoom})`'), 'the same size on screen at any zoom')
  assert.ok(board.includes('onOpen={(event) => { event.stopPropagation(); setActivePageId(card.id); setChangesOfScreenOnly(true); requestConflictDrawer() }}') && board.includes('onDoubleClick={(event) => event.stopPropagation()}') && board.includes('onPointerDown={(event) => event.stopPropagation()}'))
  assert.ok(board.includes('setChangesOfScreenOnly(true); requestConflictDrawer()'), 'its changes open in the pane beside the Workspace, narrowed to that screen')
  assert.ok(board.includes('data-board-changes') && board.includes('data-board-change-prev') && board.includes('data-board-change-next') && board.includes('label={openLabel(rest.length)}'))
  console.log('Passed: the prototype engine and its one session, Preview playing it, and per-screen change counts on the board.')
} finally { await server.close() }
