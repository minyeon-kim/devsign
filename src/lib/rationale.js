import { allPeople } from '@/data/mockData'

// Why a change is the way it is — without anyone typing it each time.
//
// The reasons are registered ahead of the changes they explain:
//   · DESIGN_RULES — the design system's rules, each with why it exists and
//     where it comes from (a Figma frame, a token's definition, WCAG);
//   · a change's purpose — what was asked for when the work or the AI chat
//     that produced it began (`conflict.purpose`).
// When a conflict is detected, the rules it runs into, its purpose and the
// comments on it are linked to it here, on their own. A decision that
// follows the standard (merging with the design reference) uses exactly
// that, with nothing to enter. Only a decision that departs from it — an
// exception, keeping the current implementation, a rollback — asks for a
// reason (`conflict.deviation`), offered from DEVIATION_REASONS or typed.

const TOKENS = 'src/design/tokens.json'
const WCAG_TARGET_SIZE = 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'

export const DESIGN_RULES = [
  {
    id: 'button-color',
    title: 'Buttons use the primary color token',
    reason: 'A hard-coded hex stops following the brand color when the token or the theme changes.',
    sources: [
      { kind: 'token', label: 'color.primary', source: TOKENS, find: 'primary' },
      { kind: 'figma', label: 'Checkout · Payment step (Figma)' },
    ],
    applies: (text) => /button/.test(text) && /background|color|hex|fill/.test(text),
  },
  {
    id: 'button-height',
    title: 'Main buttons are the 44px large size',
    reason: 'The main call to action is the large button, so it is easy to hit and reads as the primary action.',
    sources: [
      { kind: 'token', label: 'button.height.lg = 44', source: TOKENS, find: 'lg' },
      { kind: 'figma', label: 'Checkout · Payment step (Figma)' },
    ],
    applies: (text) => /button/.test(text) && /height|tall/.test(text),
  },
  {
    id: 'touch-target',
    title: 'Touch areas are at least 24px',
    reason: 'A smaller target is easy to miss on a touch screen; 24px is the minimum WCAG 2.2 AA asks for.',
    sources: [{ kind: 'wcag', label: 'WCAG 2.2 · 2.5.8 Target Size (Minimum)', url: WCAG_TARGET_SIZE }],
    checkIds: ['targets'],
    applies: (text) => /touch area|touch target|target size/.test(text),
  },
  {
    id: 'divider-color',
    title: 'Dividers use the border color token',
    reason: 'A fixed gray does not follow the light and dark themes the way the border token does.',
    sources: [
      { kind: 'token', label: 'color.border', source: TOKENS, find: 'border' },
      { kind: 'figma', label: 'Checkout · Summary (Figma)' },
    ],
    applies: (text) => /divider/.test(text),
  },
]

// Reasons people give most often for departing from the standard — offered
// as choices, with typing one's own always possible.
export const DEVIATION_REASONS = [
  'Release schedule: applying it in the next sprint',
  'Kept temporarily until the design is final',
  'Agreed with the design owner as an exception',
  'Needs more verification before changing',
]

export const DEVIATION_LABEL = {
  exception: 'Exception request',
  'keep-current': 'Kept the current implementation',
  rollback: 'Rolled back',
}

const personName = (id) => allPeople.find((person) => person.id === id)?.name ?? null

// The rules a conflict runs into: the ones named on it (`ruleIds`), else
// the ones its failing checks and its own wording point to.
export function rulesFor(conflict, checks) {
  if (!conflict) return []
  if (conflict.ruleIds) return conflict.ruleIds.map((id) => DESIGN_RULES.find((rule) => rule.id === id)).filter(Boolean)
  const failing = new Set((checks?.failing ?? []).map((check) => check.id))
  const text = [conflict.title, conflict.message, ...(conflict.comparisonFields ?? []).map((field) => field.label)].join(' ').toLowerCase()
  return DESIGN_RULES.filter((rule) => rule.checkIds?.some((id) => failing.has(id)) || rule.applies(text))
}

// Everything linked to a conflict, ready to show:
//   what     — the change, and the decision taken on it;
//   why      — the reason: a departure's own, else the purpose it was made
//              for, else the rule it runs into;
//   evidence — where that comes from, each a link: rules, Figma frames,
//              tokens, WCAG, and the comments on it;
//   decision — which way it went, by whom, and whether it departs from the
//              standard.
export function rationaleOf(conflict, { comments = [], checks } = {}) {
  const rules = rulesFor(conflict, checks)
  const deviation = conflict.deviation ?? null
  const purpose = conflict.purpose ?? null
  const why = deviation
    ? { text: deviation.text, source: 'deviation' }
    : purpose ? { text: purpose.text, source: 'purpose' }
      : rules[0] ? { text: rules[0].reason, source: 'rule' }
        : conflict.suggestionReason ? { text: conflict.suggestionReason, source: 'rule' } : null

  const seen = new Set()
  const once = (item) => {
    const key = `${item.kind}:${item.id ?? item.url ?? item.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
  const linked = comments.filter((comment) => (comment.id === conflict.linkedCommentId || comment.target?.conflictId === conflict.id))
  const evidence = [
    ...rules.map((rule) => ({ kind: 'rule', id: rule.id, label: rule.title })),
    ...rules.flatMap((rule) => rule.sources),
    ...(conflict.references ?? []).map((ref) => ({ ...ref, find: ref.label.split(/[ .=]+/).filter((part) => /[a-z]/i.test(part)).at(-1) })),
    ...linked.map((comment) => ({ kind: 'comment', id: comment.id, label: personName(comment.authorId) ?? 'Comment', text: comment.text })),
  ].filter(once)

  const side = conflict.decidedSide ?? conflict.pickedSide ?? null
  const merged = conflict.reviewStage === 'resolved'
  const decidedBy = deviation?.by ?? conflict.decidedBy ?? (merged ? conflict.mergedBy : null) ?? null
  const decision = {
    label: deviation ? DEVIATION_LABEL[deviation.kind]
      : side === 'A' ? 'Merge with the design reference'
        : side === 'B' ? 'Merge with the current implementation'
          : merged ? 'Merged' : null,
    by: personName(decidedBy) ?? (typeof decidedBy === 'string' && decidedBy !== 'system' ? decidedBy : null),
    at: deviation?.at ?? null,
    deviates: Boolean(deviation),
  }
  return { rules, why, purpose, deviation, evidence, decision }
}

// A step of a conflict's replay, explained: the version that caused it (the
// purpose it was made for), its detection (the rule it runs into), and its
// merge (the decision). `evidence` is the subset that backs that reason.
export function stepRationale(entry, conflict, rationale) {
  const saved = entry?.snapshot?.conflicts?.find((item) => item.id === conflict.id)
  const atStep = saved ? rationaleOf(saved) : rationale
  const evidence = mergeEvidence(atStep.evidence.filter((item) => item.kind !== 'comment'), rationale.evidence.filter((item) => item.kind === 'comment'), entry?.evidence)
  const ownReason = entry?.reason ?? (typeof entry?.purpose === 'string' ? entry.purpose : entry?.purpose?.text) ?? entry?.prompt
  if (entry?.kind === 'conflict') {
    const buttonMismatch = atStep.rules.some((rule) => rule.id === 'button-color') && atStep.rules.some((rule) => rule.id === 'button-height')
    return { text: ownReason ?? (buttonMismatch
      ? 'Detected because the button height and color differ from the checkout design'
      : 'Detected because the implementation differs from the design reference'), evidence }
  }
  if (entry?.kind === 'merge') {
    return { text: ownReason ?? atStep.why?.text ?? null, evidence }
  }
  return { text: ownReason ?? atStep.purpose?.text ?? atStep.why?.text ?? 'Saved to record the implementation at this point', evidence }
}

// A History checkpoint, explained the same way: why it happened and what
// backs that, from the conflicts it's tied to (`related`) — plus links to
// those conflicts and the comments on them, so the context can be followed
// from History too. Its own reason wins when it has one (a rollback's, or
// the request an AI edit was made for).
export function checkpointRationale(entry, related, comments = []) {
  const each = related.map((conflict) => ({ conflict, rationale: rationaleOf(entry.snapshot?.conflicts?.find((saved) => saved.id === conflict.id) ?? conflict, { comments }) }))
  const text = entry.reason ?? entry.prompt ?? each.map(({ rationale }) => rationale.why?.text).find(Boolean) ?? null
  const seen = new Set()
  const evidence = each.flatMap(({ conflict, rationale }) => [
    { kind: 'conflict', id: conflict.id, label: conflict.title, conflictId: conflict.id },
    ...rationale.evidence.map((item) => ({ ...item, conflictId: conflict.id })),
  ]).filter((item) => {
    const key = `${item.kind}:${item.id ?? item.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { text, evidence }
}

// Preserve source order and distinct comments while sharing one source list.
export function mergeEvidence(...groups) {
  const seen = new Set()
  return groups.flatMap((items) => items ?? []).filter((item) => {
    const key = `${item.kind}:${item.id ?? item.url ?? `${item.source ?? ''}:${item.label}`}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
