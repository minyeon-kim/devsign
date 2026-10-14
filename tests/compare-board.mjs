import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// The resolution's comparison board: beside the detail (never over its ways),
// one at a time or side by side in an editorial grid, picking in sync with
// the detail.
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { placeBoard, changedParts, chipOf, STATES } = await server.ssrLoadModule('/src/components/conflicts/CompareBoard.jsx')
  // It opens on the detail's roomier side, never over it.
  const viewport = { width: 1560, height: 960 }
  const size = { width: 720, height: 400 }
  const leftPanel = { left: 48, right: 562, top: 0 }
  const at = placeBoard(leftPanel, size, viewport)
  assert.ok(at.x >= leftPanel.right, 'a detail at the left: the board to its right')
  const rightPanel = { left: 1110, right: 1540, top: 90 }
  const there = placeBoard(rightPanel, size, viewport)
  assert.ok(there.x + size.width <= rightPanel.left, 'a detail at the right: the board to its left')
  assert.ok(there.y >= 16 && there.y + size.height <= viewport.height - 16)
  // What a way changes against what's built is the part set in bold.
  const current = 'Height 40px (default size) · Background #7c3aed (fixed hex)'
  assert.deepEqual(changedParts('Height 44px (button.height.lg) · Background #7c3aed (fixed hex)', current).map((part) => part.changed), [true, false])
  assert.deepEqual(changedParts(current, current).map((part) => part.changed), [false, false])
  // A way's chip is the colour it sets, when it sets one; what's built is grey.
  assert.equal(chipOf({ spec: current }, 2), '#7c3aed')
  assert.equal(chipOf({ current: true, spec: current }, 0), '#94a3b8')
  assert.match(chipOf({ spec: 'Height 44px' }, 1), /^#/)
  assert.deepEqual(STATES.map((state) => state.id), ['default', 'hover', 'pressed', 'disabled'])

  const board = read('components/conflicts/CompareBoard.jsx')
  const flow = read('components/conflicts/DesignDecisionFlow.jsx')
  // Not modal: the ways behind it stay usable; moved by its header and kept where it's left; Esc and ✕ close it.
  assert.ok(board.includes('aria-modal="false"') && board.includes('createPortal(board, document.body)') && !board.includes('fixed inset-0'))
  assert.ok(board.includes('onPointerDown={drag}') && board.includes('write(POS_KEY, last)') && board.includes("event.key === 'Escape'") && board.includes('data-compare-close'))
  // The view and the scale are kept for next time.
  assert.ok(board.includes("useState(() => ({ view: 'single', zoom: 'fit', ...read(PREFS_KEY, {}) }))"))
  // One at a time: tabs with their values, ← / → and 1–4, a cross-fade in place.
  assert.ok(board.includes('role="tab"') && board.includes("event.key === 'ArrowRight' ? at + 1") && board.includes('/^[1-9]$/.test(event.key)') && board.includes('transition-opacity duration-150') && board.includes('col-start-1 row-start-1'))
  // Side by side: a 160px label column, one size for every picture, 8px apart, a dotted rule between rows, the light frames.
  assert.ok(board.includes('const LABEL_W = 160') && board.includes('const GAP = 8') && board.includes('border-dashed border-white/10') && board.includes('bg-[#F2F2F2]'))
  assert.ok(board.includes('sticky left-0') && board.includes('data-compare-side className="min-h-0 overflow-auto'), 'the labels stay while the pictures scroll')
  assert.ok(board.includes("event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0") && board.includes('선택됨') && board.includes('border-emerald-400'))
  // Picking here picks in the detail, and the detail's pick shows here.
  assert.ok(board.includes('if (row && !row.current) onPick(id)') && board.includes('if (seenPick !== picked)'))
  assert.ok(flow.includes('<CompareBoard') && flow.includes("onOpen={(event) => openBoard('__current', event)}") && !flow.includes('data-picture-zoomed'), 'the pictures open the board, not a popover')
  console.log('Passed: the comparison board — beside the detail, one at a time or side by side, in sync with the ways.')
} finally { await server.close() }
