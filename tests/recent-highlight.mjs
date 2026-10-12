// Something that just changed is lit once and then still: "방금" for a minute,
// then "N분 전" — and nothing on the screen keeps moving but a loading sign.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { RECENT_MS, isRecent, relativeLabelOf, playOnce, resetPlayed } = await server.ssrLoadModule('/src/lib/recentTime.js')
  const { RecentTime, RecentBox } = await server.ssrLoadModule('/src/components/ui/RecentTime.jsx')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const now = 1_700_000_000_000

  // 방금 within a minute; then the usual relative time.
  assert.equal(RECENT_MS, 60_000)
  assert.deepEqual([0, 59_000, 60_000, 5 * 60_000, 3 * 3_600_000, 2 * 86_400_000].map((ago) => relativeLabelOf(now - ago, now)), ['Just now', 'Just now', '1m ago', '5m ago', '3h ago', '2d ago'])
  assert.deepEqual(['Just now', '5m ago'].map((text) => translateText(text, 'ko')), ['방금', '5분 전'])
  assert.deepEqual([isRecent(now - 1000, now), isRecent(now - 61_000, now), isRecent(undefined, now), isRecent(now + 5000, now)], [true, false, false, false])

  // The highlight: the first time an item is drawn — never again.
  resetPlayed()
  // (`owner`: the one that drew it first keeps it through its own re-renders; anyone after doesn't get it.)
  assert.deepEqual([playOnce('merged:CON-1', 'a'), playOnce('merged:CON-1', 'a'), playOnce('merged:CON-1', 'b'), playOnce('merged:CON-2', 'b'), playOnce('merged:CON-1', 'a')], [true, true, false, true, true])
  resetPlayed()
  const at = Date.now()
  const box = () => renderToString(createElement(RecentBox, { id: 'review:x', at }, 'row'))
  assert.ok(box().includes('ds-recent'), 'lit as it first shows')
  // (Drawn again by another mount it isn't — the owner rule above; two server renders share one id, so that's not shown here.)
  resetPlayed()
  assert.ok(!renderToString(createElement(RecentBox, { id: 'review:old', at: Date.now() - 120_000 }, 'row')).includes('ds-recent'), 'not recent: never lit')

  // The label: 방금 with one small dot, still; older, no dot.
  const fresh = renderToString(createElement(RecentTime, { at: Date.now() }))
  assert.ok(fresh.includes('data-recent-time="now"') && fresh.includes('data-recent-dot') && !/animate-|ds-recent/.test(fresh), '방금 is static')
  const older = renderToString(createElement(RecentTime, { at: Date.now() - 5 * 60_000 }))
  assert.ok(older.includes('data-recent-time="ago"') && !older.includes('data-recent-dot'))
} finally {
  await server.close()
}

// ── The tokens, and the one highlight: once, eased out, off under reduced motion. ──
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
assert.match(css, /--highlight-recent: color-mix\(in oklab, var\(--color-emerald-400\) 10%, transparent\)/)
assert.match(css, /--duration-highlight: 1800ms/)
assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.ds-recent \{ animation: ds-recent var\(--duration-highlight\) ease-out 1 both; \}/)
assert.match(css, /@keyframes ds-recent \{ from \{ background-color: var\(--highlight-recent\); \} to \{ background-color: transparent; \} \}/)

// ── Nothing loops but loading: every looping animation in the source is on this list. ──
const LOADING = [
  ['src/index.css', /ai-gen-/], // AI generating a layer / a line
  ['src/components/ui/skeleton.jsx', /animate-pulse/], ['src/components/layout/PageSkeleton.jsx', /animate-pulse/], // skeletons
  ['src/components/chat/ChatConversation.jsx', /animate-bounce/], // the reply being written
  ['src/components/mergestudio/MergeInfiniteCanvas.jsx', /Sparkles.*animate-pulse/], ['src/components/dockview/panels/EditorPanel.jsx', /Sparkles.*animate-pulse/], // AI generating / thinking
]
const files = []
const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(jsx?|css)$/.test(name)) files.push(path) } }
walk('src')
const loops = []
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    const looping = /animation[^;]*\binfinite\b|animate-(pulse|ping|bounce)|iteration-count|animation: [^;]* [2-9];/.test(line)
    if (!looping || /^\s*(\/\/|\/?\*)/.test(line)) return
    // (ai-gen-*: its rules are the lines under `.ai-gen-…` selectors, all in one block of index.css.)
    const allowed = LOADING.some(([path, what]) => file.endsWith(path) && (what.test(line) || (path === 'src/index.css' && /ai-gen-|ai-layer-badge-in 1\.1s/.test(line))))
    if (!allowed) loops.push(`${file}:${index + 1}  ${line.trim().slice(0, 90)}`)
  })
}
assert.deepEqual(loops, [], `looping animations that aren't loading:\n${loops.join('\n')}`)
// (Spinners — animate-spin — are loading too, and the only other thing that turns.)
console.log('recent-highlight: ok')
