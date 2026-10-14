import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Design Compare says what was put together — which part from which draft,
// by whom, when — and the set's one state, without a trip to History.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const m = await server.ssrLoadModule('/src/lib/mixRecord.js')
  const { mergeListItems } = await server.ssrLoadModule('/src/data/mockData.js')
  const { regionKey } = await server.ssrLoadModule('/src/data/draftScreens.js')
  const item = mergeListItems.find((entry) => entry.id === 'merge-dashboard-drafts')
  const picks = (header, cards, cta) => ({ [regionKey('header')]: { custom: header }, [regionKey('cards')]: { custom: cards }, [regionKey('cta')]: { custom: cta } })

  // ── What a mix took from where ──
  const sources = m.mixSourcesOf(item, picks('ai-a', 'ai-b', 'ai-a'))
  assert.deepEqual(sources.map((source) => `${source.label} · ${source.letter}`), ['헤더 · A', '카드 배치 · B', '구매 버튼 (CTA) · A'])
  // "요소 N개 사용": how many parts a draft gave.
  assert.deepEqual([m.usedCountOf(sources, 'ai-a'), m.usedCountOf(sources, 'ai-b')], [2, 1])
  // A draft's property is lit when a part it's about came from that draft.
  const used = (id, draft) => m.traitUsedOf(item.differences.find((difference) => difference.id === id), sources, draft)
  assert.deepEqual(['layout', 'color', 'spacing', 'component'].map((id) => used(id, 'ai-a')), [false, true, false, true])
  assert.deepEqual(['layout', 'color', 'spacing', 'component'].map((id) => used(id, 'ai-b')), [true, false, true, true])
  assert.equal(m.traitUsedOf({ id: 'x', label: 'X' }, sources, 'ai-a'), null, 'a property tied to no part is left as it is')

  // ── Every save, newest first, with what changed ──
  const save = (id, by, timestamp, resolutions, lines) => ({ id, kind: 'merge', mergeItemId: item.id, actorId: by, timestamp, snapshot: { lines, mergeOutput: { savedAt: 1, resolutions, design: { frame: { id: 'f', width: 280, layers: [] } } } } })
  const history = [
    { id: 'h0', kind: 'edit', snapshot: { lines: ['a'] } },
    save('h1', 'jane', 'Today, 9:30 AM', picks('ai-a', 'ai-b', 'ai-a'), ['a']),
    { id: 'hx', kind: 'merge', mergeItemId: 'another-set', snapshot: { lines: ['a'], mergeOutput: {} } },
    save('h2', 'min', 'Today, 11:00 AM', picks('ai-b', 'ai-b', 'ai-a'), ['a', 'b']),
  ]
  const records = m.mixRecordsOf(item, history)
  assert.deepEqual(records.map((record) => [record.id, record.by, record.at]), [['h2', 'min', 'Today, 11:00 AM'], ['h1', 'jane', 'Today, 9:30 AM']])
  assert.deepEqual(records[0].changed, ['헤더'], 'the later save says which part moved to another draft')
  assert.deepEqual(records[1].changed, [])
  // Whether a save changed the code: only then is there code to look at.
  assert.deepEqual(records.map((record) => record.hasCode), [true, false])
  assert.ok(records[0].frame, 'the composed screen is kept with it')
  // (A save from before sets were tagged is found by its name; another set's never is.)
  assert.equal(m.mixRecordsOf(item, [{ id: 'old', kind: 'merge', label: `Merged ${item.title}`, snapshot: { mergeOutput: { resolutions: picks('ai-a', 'ai-a', 'ai-a') } } }]).length, 1)
  assert.equal(m.mixRecordsOf(item, [{ id: 'other', kind: 'merge', label: 'Merged something else', snapshot: {} }]).length, 0)

  // ── One state, one primary action ──
  const state = (overrides, record, saved) => m.mixStatusOf({ ...item, ...overrides }, record, saved)
  assert.deepEqual([state({}, null, false).label, state({}, null, true).label, state({ tag: 'Merged' }, null, false).label], ['조합 전', '저장됨', '저장됨'])
  assert.deepEqual([state({}, { reviewStage: 'in_review' }, true).label, state({}, { reviewStage: 'approved' }, true).label, state({}, { reviewStage: 'resolved' }, true).label], ['병합 요청됨', '병합 요청됨', '병합 완료'])
  assert.equal(state({ tag: 'Merged', saveOnFinish: false }, null, false).label, '병합 완료')
  assert.ok(!Object.values(m.MIX_STATUS).some((status) => status.label === '저장 완료'), '“저장 완료” isn’t one of the names')
  const actions = (id) => { const { primary, secondary } = m.mixActionsOf(id); return [m.MIX_ACTION_LABEL[primary] ?? null, m.MIX_ACTION_LABEL[secondary] ?? null] }
  assert.deepEqual([actions('draft'), actions('saved'), actions('requested'), actions('merged')], [['조합하기', null], ['병합 요청', '조합 수정'], ['요청 보기', null], [null, '조합 수정']])

  // ── Where it shows ──
  const panel = readFileSync(new URL('../src/components/mergestudio/DesignComparison.jsx', import.meta.url), 'utf8')
  assert.ok(!panel.includes('History에서 보기'), 'no button that leaves for History')
  assert.ok(!panel.includes('저장 완료'))
  assert.ok(panel.includes('<MixResultCard') && panel.includes('data-mix-sources') && panel.includes('data-mix-by') && panel.includes('data-mix-older') && panel.includes('코드 변경 보기'))
  assert.match(panel, /onViewCode=\{current\.hasCode && current\.id \? \(\) => setCodeEntryId\(current\.id\) : null\}/, 'the code link only when the save changed code')
  assert.ok(panel.includes('<HistoryCompare embedded hideRestore codeOpenByDefault entryId={codeEntryId} />'), 'the History’s own viewer, opened over the panel')
  assert.ok(panel.includes('data-trait-used') && panel.includes('data-design-used-count'))
  const head = panel.slice(panel.indexOf('data-design-compare-head'), panel.indexOf('{commentModeVariantKey && ('))
  assert.ok(!head.includes('data-design-status'), 'the state isn’t repeated beside the title')
  // Saved mixes say whose they are; the studio's title doesn't repeat "저장됨".
  const provider = readFileSync(new URL('../src/state/WorkspaceProvider.jsx', import.meta.url), 'utf8')
  assert.ok(provider.includes('...(item && { mergeItemId: item.id }),'))
  const studio = readFileSync(new URL('../src/components/mergestudio/MergeStudioWorkspace.jsx', import.meta.url), 'utf8')
  assert.ok(!studio.includes("data-mix-status") && !studio.includes("data-merge-progress"), "the picking is said once — by the parts bar — not by a pill beside the title")
  console.log('Passed: a set’s mixes are a record — sources, who and when, what changed — with one state and one primary action, shown in Design Compare.')
} finally { await server.close() }
