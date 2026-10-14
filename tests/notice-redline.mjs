// The Inbox card of a change: what was said, the diff chip, the file and who
// asked, the two pictures, the way in — all from the title's text line. A
// legend's spacing is drawn live, in the dark, measured with a redline; and
// an old digest says its date, and isn't shown twice.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { LegendRedline, legendGapsOf, LEGEND_WIDTH } = await server.ssrLoadModule('/src/components/mergestudio/NoticeRedline.jsx')
  const { supersededDigest, isDigest } = await server.ssrLoadModule('/src/lib/inboxNotifications.js')
  const { allConflictRecords } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const legend = allConflictRecords().find((conflict) => conflict.id === 'CON-008')

  // The legend change is drawn with its two gaps; nothing else is.
  assert.deepEqual(legendGapsOf(legend), { before: 4, after: 8 })
  assert.equal(legendGapsOf(allConflictRecords().find((conflict) => conflict.id === 'CON-003')), null)
  // The picture: the legend at 320px, wrapping; six items; the gap measured once, its number on it.
  assert.equal(LEGEND_WIDTH, 320)
  for (const gap of [4, 8]) {
    const html = renderToString(createElement(LegendRedline, { gap }))
    assert.equal(html.split('data-legend-item').length - 1, 6, 'the six items the request speaks of')
    assert.match(html, new RegExp(`width:320px;gap:${gap}px`))
    assert.ok(html.includes('flex-wrap'), 'it wraps where it must')
    assert.equal(html.split('data-redline=').length - 1, 1, 'one measure')
    assert.match(html, new RegExp(`data-redline-value[^>]*>${gap}<`))
    assert.ok(html.includes('bg-pink-500') && html.includes('text-slate-200') && !/bg-white\b|#fff/i.test(html), 'a pink redline, on the dark surface — no white ground')
  }

  // Yesterday's digest of the very changes today's lists isn't shown again; one that listed more is.
  const today = { id: 'review-medium-2026-10-13-CON-002-CON-005', reviewConflictIds: ['CON-002', 'CON-005'] }
  assert.ok(isDigest(today) && !isDigest({ id: 'review-high-CON-1' }))
  assert.equal(supersededDigest({ id: 'review-medium-2026-10-12-CON-002-CON-005', reviewConflictIds: ['CON-002', 'CON-005'] }, [today]), true)
  assert.equal(supersededDigest({ id: 'review-medium-2026-10-12-x', reviewConflictIds: ['CON-002', 'CON-005', 'CON-008'] }, [today]), false, 'it listed a change that has since been dealt with: its own history')
  assert.equal(supersededDigest(today, [today]), false)
  assert.equal(supersededDigest({ id: 'n-1', reviewConflictIds: ['CON-002'] }, [today]), false)
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const drawer = read('src/components/mergestudio/MergeInboxDrawer.jsx')
const body = drawer.slice(drawer.indexOf('function NoticeBody('), drawer.indexOf('// What a notification is, worked out once'))
// The order: what was said → the diff chip → file and who → the pictures → the button.
const order = ['data-notice-lead', 'data-notice-changes', 'data-notice-meta', '<NoticeThumbs', 'className={ACTION_BUTTON}'].map((mark) => body.indexOf(mark))
assert.ok(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), `the card's order (${order})`)
assert.ok(body.includes('rounded-[4px] bg-white/[0.06]') && body.includes('font-mono'), 'the change is a monospace diff chip')
// The pictures' place: a surface token, a hairline, 8px corners, the same height, 8px apart — no white, no inner frame.
const thumbs = drawer.slice(drawer.indexOf('function NoticeThumbs('), drawer.indexOf('// What opens under a change\'s notification'))
assert.ok(thumbs.includes('h-[88px] w-full overflow-hidden rounded-[8px] border border-white/[0.08] bg-[var(--ds-surface-overlay-hover)]'))
assert.ok(thumbs.includes('className="flex gap-2"') && thumbs.includes('min-w-0 flex-1'))
assert.ok(thumbs.includes("side === 'after' && <span aria-hidden className=\"size-1.5 shrink-0 rounded-full bg-emerald-400\""), 'the accent dot is the proposal\'s alone')
assert.ok(thumbs.includes('text-xs leading-4 text-slate-400'), 'labels: 12px, secondary text')
// A notice's body starts on the title's text line; other cards are as they were.
assert.ok(drawer.includes("card.type === 'thread' ? 'pl-3 pt-1' : notice ? 'pl-[50px]' : 'pl-[42px]'"))
// A stale "Today" is said as its date and time.
assert.ok(read('src/state/WorkspaceProvider.jsx').includes("['Just now', 'Today', 'Now'].includes(n.timeLabel)"))
console.log('notice-redline: ok')
