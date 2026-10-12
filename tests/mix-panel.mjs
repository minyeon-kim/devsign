import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The parts bar under the Result (Merge Studio's mixing): the drafts' cards
// stay on one row, and the bar folds down to its row of parts.
const source = readFileSync(new URL('../src/components/mergestudio/MergeStudioWorkspace.jsx', import.meta.url), 'utf8')
const panel = source.slice(source.indexOf('function MixPanel('), source.indexOf('function RegionThumb('))

// One row, shared evenly, never under 140px a card; past that it scrolls sideways in place.
assert.match(source, /const MIX_CARD_MIN = 140/)
assert.match(panel, /grid-flow-col/)
assert.match(panel, /gridAutoColumns: `minmax\(\$\{MIX_CARD_MIN\}px, 1fr\)`/)
assert.ok(/overflow-x-auto/.test(panel) && /snap-x/.test(panel) && /maskImage/.test(panel) && /ArrowRight/.test(panel) && /scrollIntoView/.test(panel))
assert.ok(!/repeat\(\$\{Math\.min\(current\.options\.length, 3\)\}/.test(panel), 'no three-a-row grid that wraps the fourth card')
// At most 70% of the canvas.
assert.match(source, /const MIX_PANEL_SHARE = 0\.7/)

// Folding: a labelled button that says its state, the part's own tab, a double-click on the row, and P.
assert.match(panel, /aria-expanded=\{!folded\}/)
assert.ok(panel.includes("'시안 펴기'") && panel.includes("'시안 접기'"))
assert.match(panel, /if \(!folded && index === stepNow\) \{ setFolded\(true\); return \}/, 'the picked part’s tab, pressed again, folds')
assert.match(panel, /if \(folded\) setFolded\(false\)/, 'a tab pressed while folded unfolds on that part')
assert.match(panel, /onDoubleClick=/)
assert.match(panel, /event\.key\.toLowerCase\(\) !== 'p' \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/)
// Folded, a part says the draft it uses beside its name; the cards can't be tabbed into.
assert.match(panel, /folded && letterOf\(row\) && <span data-mix-picked/)
assert.match(panel, /inert=\{folded\}/)
assert.match(panel, /motion-reduce:transition-none/)
// Kept across a reload, and safe when storage isn't there.
assert.match(source, /const readFolded = \(\) => \{ try \{ return localStorage\.getItem\(MIX_FOLD_KEY\) === '1' \} catch \{ return false \} \}/)

// The canvas's fit follows the bar's height — while the view is still that fit.
const canvas = readFileSync(new URL('../src/components/mergestudio/MergeInfiniteCanvas.jsx', import.meta.url), 'utf8')
assert.ok(canvas.includes('lastFit.current = { view: fitted, lay, options:') && canvas.includes("new ResizeObserver(() => refit())"))
assert.match(canvas, /now\.zoom !== last\.view\.zoom \|\| Math\.abs\(now\.x - last\.view\.x\) > 0\.5/, 'a view the user moved is left alone')
console.log('Passed: the parts bar keeps its cards on one row, folds four ways, remembers it, and the canvas fit follows it.')
