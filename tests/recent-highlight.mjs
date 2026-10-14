// A value or a state changing re-draws what's on the screen in place: no
// picture is taken down and put up again, nothing starts from empty or from
// transparent, nothing lights up. "방금" is still text that becomes "N분 전".
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' })
try {
  const { RECENT_MS, isRecent, relativeLabelOf } = await server.ssrLoadModule('/src/lib/recentTime.js')
  const { RecentTime } = await server.ssrLoadModule('/src/components/ui/RecentTime.jsx')
  const { translateText } = await server.ssrLoadModule('/src/i18n/translate.js')
  const now = 1_700_000_000_000
  // 방금 within a minute; then the usual relative time.
  assert.equal(RECENT_MS, 60_000)
  assert.deepEqual([0, 59_000, 60_000, 5 * 60_000, 3 * 3_600_000, 2 * 86_400_000].map((ago) => relativeLabelOf(now - ago, now)), ['Just now', 'Just now', '1m ago', '5m ago', '3h ago', '2d ago'])
  assert.deepEqual(['Just now', '5m ago'].map((text) => translateText(text, 'ko')), ['방금', '5분 전'])
  assert.deepEqual([isRecent(now - 1000, now), isRecent(now - 61_000, now), isRecent(undefined, now)], [true, false, false])
  // The label: still text, one small dot while it's 방금.
  const fresh = renderToString(createElement(RecentTime, { at: Date.now() }))
  assert.ok(fresh.includes('data-recent-time="now"') && fresh.includes('data-recent-dot') && !/animate-|ds-/.test(fresh), '방금 is static')
  assert.ok(!renderToString(createElement(RecentTime, { at: Date.now() - 5 * 60_000 })).includes('data-recent-dot'))
} finally {
  await server.close()
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('src/index.css')
const flow = read('src/components/conflicts/DesignDecisionFlow.jsx')
const preview = read('src/components/conflicts/ElementPreview.jsx')

// ── No highlight: its keyframes, classes, tokens and play-once memory are gone. ──
for (const name of ['ds-recent', 'highlight-recent', 'duration-highlight', 'ds-swap', 'ds-fade', 'ds-step-status', 'ds-step-ring', 'ds-pin-pulse']) assert.ok(!css.includes(name), `index.css still has ${name}`)
assert.ok(!/playOnce|useRecentHighlight|RecentBox/.test(read('src/lib/recentTime.js') + read('src/components/ui/RecentTime.jsx')))

// ── The picture stays mounted: never keyed by what it shows, never faded in from nothing. ──
assert.ok(!flow.includes('afterKey') && flow.includes('<div data-after-picture>'), 'the result picture is not keyed by its value')
assert.ok(!/className="[^"]*\b(ds-swap|ds-fade|animate-in)\b/.test(flow), 'nothing in the flow fades in from transparent when it changes')
assert.ok(flow.includes('key={`${conflict.id}:${formRound}`}') && !/key=\{`[^`]*\$\{(cardMode|request\?\.round)/.test(flow), 'the card is not re-mounted when its state changes')
assert.equal(flow.match(/\{card\}/g).length, 1, 'the card is rendered from one place in the tree')
// (No component is defined inside another's render: every `function Name(` in the flow is at the top level.)
assert.deepEqual(flow.split('\n').filter((line) => /^\s+function [A-Z]\w*\(/.test(line)), [], 'a component defined inside a render')
// ── A drawing is measured before the first paint: no empty frame. ──
const box = preview.slice(preview.indexOf('function useBox('), preview.indexOf('// One picture of the change'))
assert.ok(box.includes('useLayoutEffect(') && !box.includes('useEffect('), 'the box is measured in a layout effect')

// ── What's eased: colours and a height, over the tokens — and nothing under reduced motion. ──
assert.match(css, /--duration-fast: 150ms;\s*--duration-base: 200ms;\s*--ease-out: cubic-bezier/)
assert.match(css, /\.ds-tone \{ transition: background-color var\(--duration-fast\)[^}]*border-color[^}]*color var\(--duration-fast\)/)
assert.ok(css.includes('.ds-tone { transition: none; }'))
for (const file of ['src/components/conflicts/DesignDecisionFlow.jsx', 'src/components/conflicts/ElementPreview.jsx', 'src/components/conflicts/ValueScale.jsx', 'src/components/dashboard/ConflictsDrawer.jsx']) assert.ok(!/transition-all|transition: all/.test(read(file)), `${file}: transition: all`)
// No keyframes ring, glow or scale. (Except the Screens board's change count, asked to ripple: ds-ripple.)
const keyframes = [...css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]|\{[^{}]*\})*)\}/g)].filter(([, name]) => !/^(ai-gen|ai-layer-badge|history-row-(typein|flash)|ds-ripple)/.test(name))
const loud = keyframes.filter(([, , body]) => /box-shadow|outline|scale\(/.test(body)).map(([, name]) => name)
assert.deepEqual(loud, [], `keyframes that ring, glow or scale: ${loud.join(', ')}`)

// ── Nothing loops but loading. ──
const LOADING = [
  ['src/components/ui/skeleton.jsx', /animate-pulse/], ['src/components/layout/PageSkeleton.jsx', /animate-pulse/],
  ['src/components/chat/ChatConversation.jsx', /animate-bounce/],
  ['src/components/mergestudio/MergeInfiniteCanvas.jsx', /Sparkles.*animate-pulse/], ['src/components/dockview/panels/EditorPanel.jsx', /Sparkles.*animate-pulse/],
]
const files = []
const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(jsx?|css)$/.test(name)) files.push(path) } }
walk('src')
const loops = []
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (!/animation[^;]*\binfinite\b|animate-(pulse|ping|bounce)|iteration-count|animation: [^;]* [2-9];/.test(line) || /^\s*(\/\/|\/?\*)/.test(line)) return
    // (Besides loading: the Screens board's change count, asked to keep rippling — ds-ripple, still under reduced motion.)
    const allowed = LOADING.some(([path, what]) => file.endsWith(path) && what.test(line)) || (file.endsWith('src/index.css') && /ai-gen-|ai-layer-badge-in 1\.1s|ds-ripple/.test(line))
    if (!allowed) loops.push(`${file}:${index + 1}  ${line.trim().slice(0, 90)}`)
  })
}
assert.deepEqual(loops, [], `looping animations that aren't loading:\n${loops.join('\n')}`)
console.log('recent-highlight: ok')
