// The full-page detail's side panel: where the change is on the screen comes
// first — a block across the panel, right under the tabs — then what it is,
// who reviews it, the details; and the panel's top is the main view's first container's.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const panel = read('src/components/dockview/panels/ConflictReviewPanel.jsx')
const thumb = read('src/components/conflicts/DesignLinkThumb.jsx')

// The order on the page: screen → what it is → reviewers → developer details.
const overview = panel.slice(panel.indexOf('function OverviewTab('), panel.indexOf('function ReviewersSection('))
const order = ['data-info-section="Screen"', 'title="Conflict information"', '{reviewers}', 'title="Developer details"'].map((mark) => overview.indexOf(mark))
assert.ok(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), `the page's order (${order})`)
assert.ok(overview.includes('{page && !mix && !conflict.rollback && designLink && <section data-info-section="Screen"'), 'the screen is its own first block — on the page')
assert.ok(overview.includes('{designLink && !page && (') && overview.includes('<Row label="Where on the screen" data-summary-row="Screen">'), 'the panel (not full page) keeps its row as it was')
assert.ok(panel.includes('{!page && reviewersSection}') && panel.includes('reviewers={page ? reviewersSection : null}'), 'reviewers: first in the panel, after the change\'s information on the page')

// The block: label in a line, the screen across the panel, no taller than 240, on the dark surface, hairline, 8px.
const block = thumb.slice(thumb.indexOf('export function ScreenLocation('))
assert.match(thumb, /export const SCREEN_MAX_HEIGHT = 240/)
assert.ok(block.includes('<LocalizedText text="Where on the screen" /> · <LocalizedText text="Frame" /> {frameNumber}'), '"화면 위치 · 프레임 N" on one line')
assert.ok(block.includes('w-full') && block.includes('rounded-[8px] border border-white/[0.08] bg-[var(--ds-surface-overlay-hover)]') && block.includes('items-center justify-center'))
assert.ok(block.includes('Math.min(1, (width - 32) / size.width, (SCREEN_MAX_HEIGHT - 32) / size.height)'), 'drawn whole, to scale')
assert.ok(block.includes('data-screen-location-mark className="absolute rounded-[2px] border-[1.5px] border-emerald-400"'), 'the changed area: a 1.5px accent box')
assert.ok(block.includes('workspace.revealConflictOnCanvas(conflict)') && block.includes('workspace.openConflictReview?.(null)'), 'pressed: to that frame on the canvas')

// The panel on the page: in the grid's row beside the main view — its top is the first container's top
// (measured in the browser: 0px apart); never lifted out of the row.
assert.ok(panel.includes("REVIEW_CONTEXT_CARD, page && 'xl:!pt-3')}>") && !/data-review-sidebar[^>]*xl:absolute/.test(panel) && !panel.includes('data-review-sidebar-space'))
assert.ok(panel.includes('xl:grid-cols-[minmax(0,1fr)_320px]'), 'the panel\'s width is as it was')
// Sections: the existing divider and its 12px either side (24px between) — no larger gap.
assert.ok(panel.includes("page && '[&_[data-info-section]]:mb-0 [&_[data-info-section]+[data-info-section]]:border-t [&_[data-info-section]+[data-info-section]]:pt-3'") && !panel.includes('[data-info-section]+[data-info-section]]:mt-8'))
console.log('screen-location: ok')
