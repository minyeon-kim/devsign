import { allPeople } from '@/data/mockData'
import { STAGE_LABEL } from '@/lib/conflicts'
import { getLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'

// Replies are built here, past the JSX translation boundary, so they're
// written in the current language directly (names, titles and messages go
// through the dictionary).
const isKo = () => getLanguage() === 'ko'
const tr = (text) => translateText(text, getLanguage())

// Merge Studio's AI Chat is its own conversation per merge item (see
// WorkspaceProvider's `mergeChats`), not the Workspace's: it opens on the
// item it's about and offers prompts about that item, answered from the
// item's live conflicts (their stage, reviewers and messages).

const nameOf = (id) => allPeople.find((p) => p.id === id)?.name ?? id

// The conflicts a merge item covers, open ones first.
export function itemConflicts(item, conflicts) {
  if (!item) return []
  return conflicts.filter((c) => c.mergeItemId === item.id || c.id === item.conflictId)
}

export function mergeChatIntro(item, related) {
  const open = related.filter((c) => c.reviewStage !== 'resolved')
  const count = open.length === 1 ? '1 open conflict' : `${open.length} open conflicts`
  return [
    {
      id: `merge-intro-${item.id}`,
      role: 'assistant',
      text: isKo()
        ? `**${tr(item.title)}**을(를) 머지하고 있어요. 남은 충돌은 ${open.length}개예요. 이 변경에 대해 묻거나, 머지 전에 남은 일을 확인하거나, 검토 요청 메시지를 써 달라고 해 주세요.`
        : `You're merging **${item.title}** — ${count}. Ask me about this change, what's left before it can merge, or have me draft a review request.`,
    },
  ]
}

const PROMPTS = {
  explain: 'Explain this change',
  left: 'What’s left before merging?',
  request: 'Draft a review request',
}

export function mergeChatSuggestions() {
  return [
    { id: 'merge-explain', label: PROMPTS.explain, prompt: PROMPTS.explain, iconName: 'Sparkles' },
    { id: 'merge-left', label: PROMPTS.left, prompt: PROMPTS.left, iconName: 'MessageCircle' },
    { id: 'merge-request', label: PROMPTS.request, prompt: PROMPTS.request, iconName: 'MessageCircle' },
  ]
}

function reviewerLine(conflict) {
  if (!conflict.reviewers.length) return isKo() ? '아직 검토자가 없어요' : 'no reviewers assigned yet'
  const label = (status) => isKo()
    ? (status === 'approved' ? '승인' : status === 'changes_requested' ? '변경 요청' : '대기')
    : (status === 'approved' ? 'approved' : status === 'changes_requested' ? 'changes requested' : 'pending')
  return conflict.reviewers.map((r) => `${nameOf(r.id)} (${label(r.status)})`).join(', ')
}

// The reply to one of the item's prompts, or null for anything else (the
// usual chat handling takes over).
export function mergeChatAnswer(item, related, text) {
  const asked = text.trim().toLowerCase()
  const is = (prompt) => asked === prompt.toLowerCase()
  const open = related.filter((c) => c.reviewStage !== 'resolved')

  if (is(PROMPTS.explain)) {
    if (!related.length) {
      return isKo()
        ? `**${tr(item.title)}**에는 연결된 충돌이 없어요. 캔버스의 두 아트보드를 비교해 차이를 확인해 주세요.`
        : `**${item.title}** has no linked conflicts — compare the two artboards on the canvas to see what differs.`
    }
    return [
      isKo() ? `**${tr(item.title)}**은(는) 코드를 디자인에 맞추는 변경이에요.` : `**${item.title}** brings the code in line with the design:`,
      '',
      ...related.map((c) => `- **${tr(c.title)}** (${tr(c.severity === 'high' ? 'High' : c.severity === 'low' ? 'Low' : 'Medium')})${c.message ? ` — ${tr(c.message)}` : ''}`),
      '',
      isKo()
        ? '각 충돌의 코드는 아래 **충돌 지점**의 리뷰에서 볼 수 있고, 머지 전에 거기서 직접 고칠 수 있어요.'
        : 'Each conflict’s code is in its review in **Conflict Points** below — you can edit it there before it merges.',
    ].join('\n')
  }

  if (is(PROMPTS.left)) {
    if (!open.length) return isKo() ? `**${tr(item.title)}**은(는) 모두 머지됐어요. 남은 일이 없어요.` : `Everything in **${item.title}** is merged — nothing left to do.`
    const lines = open.map((c) => {
      const stage = tr(STAGE_LABEL[c.reviewStage] ?? c.reviewStage)
      const next = c.reviewStage === 'detected'
        ? (isKo() ? '검토를 요청해야 해요' : 'request a review')
        : c.reviewStage === 'approved'
          ? (isKo() ? '머지할 수 있어요' : 'ready to merge')
          : (isKo() ? `대기 중: ${reviewerLine(c)}` : `waiting on ${reviewerLine(c)}`)
      return `- **${tr(c.title)}** — ${stage}: ${next}`
    })
    const ready = open.every((c) => c.reviewStage === 'approved')
    const heading = ready
      ? (isKo() ? '**승인이 모두 끝나서 머지할 수 있어요.**' : '**All approvals are in — ready to merge.**')
      : (isKo() ? '**머지 전에 남은 일:**' : '**Before this can merge:**')
    return [heading, '', ...lines].join('\n')
  }

  if (is(PROMPTS.request)) {
    const reviewers = [...new Set(open.flatMap((c) => c.reviewers.map((r) => nameOf(r.id))))]
    if (isKo()) {
      return [
        '보낼 수 있는 검토 요청 메시지예요.',
        '',
        `> ${reviewers.length ? reviewers.join(', ') : '팀'}님, **${tr(item.title)}** 검토 부탁드려요.`,
        ...open.map((c) => `> - ${tr(c.title)}${c.message ? `: ${tr(c.message)}` : ''}`),
        '> 병합 스튜디오 → 충돌 지점에서 확인할 수 있어요. 감사합니다!',
      ].join('\n')
    }
    return [
      'Here’s a review request you can send:',
      '',
      `> Hi ${reviewers.length ? reviewers.join(', ') : 'team'} — could you review **${item.title}**?`,
      ...open.map((c) => `> - ${c.title}${c.message ? `: ${c.message}` : ''}`),
      '> It’s in Merge Studio → Conflict Points. Thanks!',
    ].join('\n')
  }

  return null
}
