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

// ── The next step, at the row's end ──
// One button that changes with where the mix is: next part → warnings to look at → the request.
assert.match(panel, /pending > 0 \? 'next' : failing\.length > 0 && seenWarnings !== warningKey \? 'warn' : 'ready'/)
assert.ok(panel.includes('data-mix-step={stage}') && panel.includes("data-merge-request={stage === 'ready' ? '' : undefined}"))
assert.ok(panel.includes('`경고 ${failing.length}개 확인`') && panel.includes("'병합 요청됨 · 검토 대기'"))
// A pick moves on after 300ms — not once every part is picked — and it can be turned off.
assert.match(source, /const MIX_ADVANCE_MS = 300/)
assert.match(panel, /if \(!advance \|\| !others\) return/)
assert.match(panel, /data-mix-advance aria-checked=\{advance\}/)
// The request is asked for over the button: the mix, warnings left in, reviewers, a note.
assert.ok(panel.includes('<PopoverContent data-mix-request side="top"') && panel.includes('data-mix-summary') && panel.includes('`경고 ${failing.length}개 포함`') && panel.includes('data-mix-reviewer') && panel.includes('data-mix-send'))
assert.match(panel, /finish\.onSend\(\{ reviewerIds, note: note\.trim\(\), warnings: failing\.length \}\)/)
// Keyboard, with the panel in focus.
assert.match(panel, /\(event\.metaKey \|\| event\.ctrlKey\) && event\.key === 'Enter'\) \{ event\.preventDefault\(\); act\(\); return \}/)
assert.ok(panel.includes("/^[1-9]$/.test(event.key)") && panel.includes('String(option.letter).toLowerCase() === event.key.toLowerCase()'))
// The title says where it stands and has no button to finish from; the request reuses the existing record.
const title = source.slice(source.indexOf('{item && designComparison && ('), source.indexOf('{/* The header row\'s right side'))
assert.ok(!title.includes('data-mix-status') && !title.includes('data-merge-request'), 'no "n/m 선택" pill (the parts bar says it), and the merge request is the parts bar’s alone')
assert.match(source, /const requestId = conflict\?\.id \?\? createMergeRequest\(item\)\.id\n    updateConflict\(requestId, \{/)
// A whole draft in one edit (so one ⌘Z takes it back), offered on each draft's title.
assert.match(source, /function takeWholeDraft\(draftKey\) \{[\s\S]{0,260}setResolutions\(\(prev\) => \{/)
const board = readFileSync(new URL('../src/components/mergestudio/DraftCompareBoard.jsx', import.meta.url), 'utf8')
assert.ok(board.includes('data-draft-take-all={option.key}') && board.includes("'이 시안으로 모두 선택'") && board.includes('group-hover/draft:inline-flex'))

// The canvas's fit follows the bar's height — while the view is still that fit.
const canvas = readFileSync(new URL('../src/components/mergestudio/MergeInfiniteCanvas.jsx', import.meta.url), 'utf8')
assert.ok(canvas.includes('lastFit.current = { view: fitted, lay, options:') && canvas.includes("new ResizeObserver(() => refit())"))
assert.match(canvas, /now\.zoom !== last\.view\.zoom \|\| Math\.abs\(now\.x - last\.view\.x\) > 0\.5/, 'a view the user moved is left alone')
console.log('Passed: the parts bar keeps its cards on one row, folds four ways, remembers it, and the canvas fit follows it.')
