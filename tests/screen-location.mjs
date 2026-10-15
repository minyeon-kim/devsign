// The full-page detail's "영향 / 근거" (at the foot of its one column — no side
// column): where the change is on the screen comes first, folded (the canvas
// beside the pane lights the element itself) — then what it is, open; the
// standard and the reviewers folded with a line of what's in them; the details.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const panel = read('src/components/dockview/panels/ConflictReviewPanel.jsx')
const thumb = read('src/components/conflicts/DesignLinkThumb.jsx')

// The order on the page: screen → what it is → reviewers → developer details.
const overview = panel.slice(panel.indexOf('function OverviewTab('), panel.indexOf('function ReviewersSection('))
const order = ['title="Where on the screen"', 'title="Conflict information"', 'title="Standard"', '{reviewers}', 'title="Developer details"'].map((mark) => overview.indexOf(mark))
assert.ok(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), `the page's order (${order})`)
assert.ok(overview.includes('<FoldSection title="Where on the screen"') && overview.includes('<ScreenLocation conflict={conflict} />'), 'the screen is the first block — folded, on the page')
assert.ok(overview.includes('<FoldSection title="Standard" gist='), 'the standard: folded, its rule named in a line')
assert.ok(panel.includes('<FoldSection key={`reviewers:${conflict.id}`} title="Reviewers"') && panel.includes('defaultOpen={!conflict.reviewers.length}'), 'reviewers: folded unless one has to be picked')
assert.ok(panel.includes('{gist != null && !open && <span data-info-gist'), 'a folded section says what it holds')
assert.ok(overview.includes('{designLink && !page && (') && overview.includes('<Row label="Where on the screen" data-summary-row="Screen">'), 'the panel (not full page) keeps its row as it was')
assert.ok(panel.includes('{!page && reviewersSection}') && panel.includes('reviewers={page && reviewersBody ? { body: reviewersBody,') && panel.includes("reviewers && { key: 'reviewers'"), 'reviewers: first in the panel, after the change\'s information on the page')

// The block: label in a line, the screen across the panel, no taller than 240, on the dark surface, hairline, 8px.
const block = thumb.slice(thumb.indexOf('export function ScreenLocation('))
assert.match(thumb, /export const SCREEN_MAX_HEIGHT = 240/)
assert.ok(block.includes('<LocalizedText text="Where on the screen" /> · <LocalizedText text="Frame" /> {frameNumber}'), '"화면 위치 · 프레임 N" on one line')
assert.ok(block.includes('w-full') && block.includes('rounded-[8px] border border-white/[0.08] bg-[var(--ds-surface-overlay-hover)]') && block.includes('items-center justify-center'))
assert.ok(block.includes('Math.min(1, (width - 32) / size.width, (SCREEN_MAX_HEIGHT - 32) / size.height)'), 'drawn whole, to scale')
assert.ok(block.includes('data-screen-location-mark className="absolute rounded-[2px] border-[1.5px] border-emerald-400"'), 'the changed area: a 1.5px accent box')
assert.ok(block.includes('workspace.revealConflictOnCanvas(conflict)') && block.includes('workspace.openConflictReview?.(null)'), 'pressed: to that frame on the canvas')

// No side column. On the page, tabs at its top — the change itself (Details, open), then its impact and
// evidence, comments, activity — one showing at a time; in the bottom panel's review, the tabs over the
// impact and evidence at the foot of its one column, under a hairline.
assert.ok(!panel.includes('xl:grid-cols-[minmax(0,1fr)_320px]') && !panel.includes('REVIEW_CONTEXT_CARD'), 'no column beside the main view')
assert.ok(panel.includes("...(page ? [['details', 'Change details']] : []),") && panel.includes("[['info', 'Impact & evidence']"), 'Details, then 영향 / 근거')
assert.ok(panel.includes("{page && reviewTabBar(") && panel.includes("{!page && reviewTabBar(") && panel.includes("const [sideTab, setSideTab] = useState(page ? 'details' : 'info')"))
assert.ok(panel.includes("page && sideTab !== 'details' && 'hidden'") && panel.includes("page ? (sideTab === 'details' ? 'hidden' : sideTab === 'comments' || sideTab === 'history' ? 'min-h-0 flex-1' : '') : 'border-t border-white/[0.07] pt-4'"), 'one tab at a time on the page')
// Sections: the existing divider and its 12px either side (24px between) — no larger gap.
assert.ok(panel.includes("page && '[&_[data-info-section]]:mb-0 [&_[data-info-section]+[data-info-section]]:border-t [&_[data-info-section]+[data-info-section]]:pt-3'") && !panel.includes('[data-info-section]+[data-info-section]]:mt-8'))
console.log('screen-location: ok')
