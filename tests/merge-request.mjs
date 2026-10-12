import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// A merge request's page says one thing: its state, and everything worked out from it.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { MERGE_REQUEST_LABEL, isMergeRequest, mergeRequestStateOf, mergeRequestStatusOf, mergeRequestRecordOf } = await server.ssrLoadModule('/src/lib/mergeRequest.js')
  const { conflictRef } = await server.ssrLoadModule('/src/lib/conflicts.js')
  const { conflictTypeOf } = await server.ssrLoadModule('/src/lib/conflictInsight.js')
  const nameOf = (id) => ({ james: 'Jordan', min: 'Alex', jane: 'Taylor' })[id] ?? id
  const part = (label, letter) => ({ key: label, label, decided: Boolean(letter), options: ['A', 'B', 'C', 'D'].map((entry) => ({ key: entry, letter: entry, value: `${label} ${entry}`, name: `시안 ${entry}`, picked: entry === letter })) })
  const all = [part('헤더', 'B'), part('주문 요약', 'A'), part('결제 수단', 'C'), part('결제 바', 'D')]
  const some = [part('헤더', 'B'), part('주문 요약', 'A'), part('결제 수단', null), part('결제 바', null)]
  const base = { id: 'mr-merge-checkout-payment-drafts', kind: 'design-review', projectId: 'checkout-redesign', requestedBy: 'jane', reviewers: [{ id: 'james', status: 'pending' }, { id: 'min', status: 'pending' }] }
  const drafts = ['A', 'B', 'C', 'D'].map((letter) => ({ letter, name: `시안 ${letter}` }))
  const view = (conflict, rows) => {
    const status = mergeRequestStatusOf(conflict, rows, { nameOf })
    const record = mergeRequestRecordOf(conflict, rows, { nameOf, drafts })
    return { state: mergeRequestStateOf(conflict, rows), label: MERGE_REQUEST_LABEL[status.state], text: status.text, action: status.action, tone: status.tone, steps: record.map((step) => step.state), done: record.filter((step) => step.state === 'done').length }
  }

  // 조합 중: parts still to pick — carry on in Merge Studio; nothing to ask for yet.
  assert.deepEqual(view({ ...base, reviewStage: 'detected' }, some), { state: 'mixing', label: '조합 중', text: '2개 항목을 더 골라 주세요', action: 'continue', tone: 'neutral', steps: ['done', 'current', 'pending', 'pending', 'pending'], done: 1 })
  // 요청 전: everything picked, not asked for — the one place it can be asked from.
  const ready = view({ ...base, reviewStage: 'detected' }, all)
  assert.deepEqual([ready.state, ready.label, ready.text, ready.action, ready.done], ['ready', '요청 전', '조합을 마쳤어요 · 승인을 요청하세요', 'request', 2])
  assert.equal(mergeRequestStatusOf({ ...base, reviewStage: 'detected' }, all, { nameOf }).actionLabel, '검토자 2명에게 승인 요청')
  assert.equal(mergeRequestStatusOf({ ...base, reviewStage: 'detected' }, all, { nameOf }).actionTitle, 'Jordan, Alex')
  assert.equal(mergeRequestStatusOf({ ...base, reviewStage: 'detected', reviewers: [] }, all, { nameOf }).action, null, 'no reviewer: nothing to send to')
  // 승인 대기: sent from Merge Studio — no request button here, only a reminder.
  const waiting = view({ ...base, reviewStage: 'in_review', mixRequest: { at: Date.now(), note: null, warnings: 0 } }, all)
  assert.deepEqual([waiting.state, waiting.label, waiting.text, waiting.action, waiting.tone, waiting.done], ['waiting', '승인 대기', 'Jordan, Alex의 승인을 기다리는 중', 'remind', 'waiting', 3])
  assert.deepEqual(waiting.steps, ['done', 'done', 'done', 'current', 'pending'])
  // …one of two in: only who's still to decide is named.
  assert.equal(mergeRequestStatusOf({ ...base, reviewStage: 'in_review', reviewers: [{ id: 'james', status: 'approved' }, { id: 'min', status: 'pending' }] }, all, { nameOf }).text, 'Alex의 승인을 기다리는 중')
  // 승인됨: the page's one strong green, and the merge.
  const approved = view({ ...base, reviewStage: 'approved', reviewers: base.reviewers.map((reviewer) => ({ ...reviewer, status: 'approved', reviewedAt: Date.now() })) }, all)
  assert.deepEqual([approved.state, approved.label, approved.text, approved.action, approved.tone, approved.done], ['approved', '승인됨', '승인됐어요 · 병합하면 반영돼요', 'merge', 'success', 4])
  // 반려: who asked for changes and why — fixed in Merge Studio.
  const rejectedConflict = { ...base, reviewStage: 'in_review', reviewers: [{ id: 'james', status: 'changes_requested', note: '결제 바는 A안이 더 눈에 띄어요.' }, { id: 'min', status: 'pending' }] }
  const rejected = view(rejectedConflict, all)
  assert.deepEqual([rejected.state, rejected.label, rejected.text, rejected.action, rejected.tone], ['rejected', '반려', 'Jordan님이 수정을 요청했어요', 'fix', 'warning'])
  assert.equal(mergeRequestStatusOf(rejectedConflict, all, { nameOf }).detail, '결제 바는 A안이 더 눈에 띄어요.')
  assert.deepEqual(rejected.steps, ['done', 'done', 'done', 'problem', 'pending'])
  // 병합 완료.
  const merged = view({ ...base, reviewStage: 'resolved', mergedBy: 'jane', reviewers: base.reviewers.map((reviewer) => ({ ...reviewer, status: 'approved' })) }, all)
  assert.deepEqual([merged.state, merged.label, merged.action, merged.done], ['merged', '병합 완료', null, 5])

  // The record is a merge request's own steps — never a change's ("변경 감지").
  const record = mergeRequestRecordOf({ ...base, reviewStage: 'in_review', mixRequest: { at: Date.now(), note: '주문 요약은 A안으로.', warnings: 1 } }, all, { nameOf, drafts })
  assert.deepEqual(record.map((step) => step.title), ['시안 생성', '조합', '승인 요청', '승인', '병합'])
  assert.deepEqual([record[0].summary, record[1].who, record[2].summary], ['시안 A~D · 4개', 'Taylor', 'Jordan, Alex에게 요청'])
  assert.deepEqual(record[1].rows.map((row) => row.value), ['B · 헤더 B', 'A · 주문 요약 A', 'C · 결제 수단 C', 'D · 결제 바 D'], 'the mix, part by part')
  assert.deepEqual(record[2].rows.map((row) => row.label), ['메모', '경고'])

  // Names: MR-001 like a change's id; its own type, not "디자인 결정".
  assert.ok(isMergeRequest(base) && !isMergeRequest({ id: 'CON-003' }))
  assert.equal(conflictRef(base, [base]), 'MR-001')
  assert.equal(conflictRef({ ...base, id: 'mr-b' }, [base, { ...base, id: 'mr-b' }]), 'MR-002')
  assert.equal(conflictTypeOf(base).id, 'draft-merge')
  assert.equal(conflictTypeOf(base).label, 'Draft merge')

  // The page: no banner and no change-style status line for a request; one status block; the card reports.
  const panel = readFileSync(new URL('../src/components/dockview/panels/ConflictReviewPanel.jsx', import.meta.url), 'utf8')
  assert.match(panel, /const approvalNudge = !page && /, 'the "ready" bar isn’t the page’s')
  assert.match(panel, /\{page && !mergeRequest && !fixUnderWay && !conflict\.rollback/, 'no "해결 방법을 선택해 주세요" on a request')
  assert.match(panel, /\{!conflict\.decisionFlow && !mergeRequest && mergedBanner\}/)
  assert.ok(panel.includes('data-request-status') && panel.includes('data-request-state={requestState}'))
  assert.match(panel, /canEdit: \['mixing', 'ready', 'rejected'\]\.includes\(requestState\)/, 'changed only before it’s asked for, or once it’s sent back')
  assert.ok(panel.includes('{!request && <span className={cn(\'rounded-full px-2 py-0.5 text-[11px]'), 'no "모두 골랐어요" badge on a request')
  // Sent from Merge Studio, once, saying who was asked.
  const studio = readFileSync(new URL('../src/components/mergestudio/MergeStudioWorkspace.jsx', import.meta.url), 'utf8')
  assert.ok(studio.includes("에게 승인을 요청했어요`") && studio.includes("reviewStage: 'in_review'"))
  await server.ssrLoadModule('/src/components/dockview/panels/ConflictReviewPanel.jsx')
  console.log('Passed: a merge request has one state — mixing, ready, waiting, approved, merged or rejected — and its status, meta and record all follow it.')
} finally { await server.close() }
