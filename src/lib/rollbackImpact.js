// Does a rollback need other people's agreement first?
//
// Rolling back your own latest work is yours to do — it just gets shared
// afterwards. It needs agreement (and goes on the Conflict list, to be
// checked off by everyone it touches) only when one of these is true:
//   · other-work — checkpoints after the target were made by someone else,
//     so their work would be taken out or broken along with yours;
//   · based-on   — someone is working on that file right now, on top of the
//     version being undone;
//   · irreversible — something after the target can't be fully put back
//     (a merge that already went out, or data).
// `viewers`: the people on the target's file right now.
export function rollbackImpact({ entries, entryId, viewerId, viewers = [] }) {
  const index = entries.findIndex((entry) => entry.id === entryId)
  if (index < 0) return { needsAgreement: false, reasons: [], affected: [] }
  const later = entries.slice(index + 1).filter((entry) => !entry.archived)
  const unique = (ids) => [...new Set(ids.filter((id) => id && id !== viewerId))]

  const othersWork = later.filter((entry) => entry.actorId && entry.actorId !== viewerId)
  const basedOn = unique(viewers.map((member) => member.id))
  const irreversible = later.filter((entry) => entry.kind === 'merge' || entry.irreversible)

  const reasons = [
    othersWork.length > 0 && { id: 'other-work', people: unique(othersWork.map((entry) => entry.actorId)), entries: othersWork.map((entry) => entry.label) },
    basedOn.length > 0 && { id: 'based-on', people: basedOn, entries: [] },
    irreversible.length > 0 && { id: 'irreversible', people: unique(irreversible.map((entry) => entry.actorId)), entries: irreversible.map((entry) => entry.label) },
  ].filter(Boolean)

  return {
    needsAgreement: reasons.length > 0,
    reasons,
    affected: unique(reasons.flatMap((reason) => reason.people)),
  }
}

// `short` is the one-line badge; `need` the sentence the rollback dialog
// leads with.
export const ROLLBACK_REASON = {
  'based-on': { short: 'Someone is working on it', need: 'Someone is working on this, so it needs their agreement.' },
  'other-work': { short: 'Includes other people’s work', need: 'Other people’s work goes with it, so it needs their agreement.' },
  irreversible: { short: 'Not fully reversible', need: 'Part of it can’t be fully undone, so it needs agreement.' },
}
// Which reason leads when there are several.
export const ROLLBACK_REASON_ORDER = ['based-on', 'other-work', 'irreversible']

// What a rollback changes, as values rather than code: the class and prop
// tokens that differ between the file now and the file at the checkpoint,
// grouped by what they set ("Background: #7c3aed → Default"). `fromColor`
// / `toColor` are set when a value is a color, for a swatch.
const TOKEN_LABELS = [
  [/^bg-/, 'Background'], [/^h-/, 'Height'], [/^w-/, 'Width'], [/^text-/, 'Text'], [/^rounded/, 'Radius'],
  [/^(p|px|py|pt|pb|pl|pr)-/, 'Padding'], [/^(m|mx|my|mt|mb|ml|mr|gap)-/, 'Spacing'], [/^tracking-/, 'Letter spacing'],
  [/^font-/, 'Font'], [/^border/, 'Border'], [/^size[=-]/, 'Size'], [/^variant=/, 'Variant'], [/^stroke/i, 'Stroke'],
]

function tokensOf(lines) {
  const tokens = []
  for (const line of lines) {
    for (const match of line.matchAll(/className="([^"]*)"/g)) tokens.push(...match[1].split(/\s+/).filter(Boolean))
    for (const match of line.matchAll(/\b(size|variant|strokeWidth)=(?:"([^"]*)"|\{([^}]*)\})/g)) tokens.push(`${match[1]}=${match[2] ?? match[3]}`)
  }
  return tokens
}

// A token as it's read in the table: the class or value itself, with the
// size it stands for when it's on the 4px scale — "size-5 (20px)".
function tokenValue(token) {
  const bracket = /\[(.+)\]/.exec(token)
  if (bracket) return bracket[1]
  const prop = /^[a-zA-Z]+=(.+)$/.exec(token)
  if (prop) return prop[1]
  const step = /^(?:size|h|w|p[xytblr]?|m[xytblr]?|gap)-(\d+(?:\.\d+)?)$/.exec(token)
  return step ? `${token} (${Number(step[1]) * 4}px)` : token
}

const colorOf = (value) => /#[0-9a-fA-F]{3,8}\b/.exec(value ?? '')?.[0] ?? null

// What a side falls back to when it sets nothing itself — the component's
// own default, named, instead of a bare "default". (The Button's: the
// primary color token and its 40px default size — see cc-11 in mockData.)
const FALLBACK_VALUE = {
  Background: { value: 'color.primary', color: '#6366f1' },
  Height: { value: 'h-10 (40px)' },
  Size: { value: 'default (40px)' },
}

export function rollbackChanges(rows) {
  const current = tokensOf(rows.filter((row) => row.kind === 'remove').map((row) => row.text))
  const target = tokensOf(rows.filter((row) => row.kind === 'add').map((row) => row.text))
  const groups = new Map()
  const add = (token, side) => {
    const label = TOKEN_LABELS.find(([pattern]) => pattern.test(token))?.[1] ?? 'Class'
    const group = groups.get(label) ?? { label, from: [], to: [] }
    group[side].push(tokenValue(token))
    groups.set(label, group)
  }
  current.filter((token) => !target.includes(token)).forEach((token) => add(token, 'from'))
  target.filter((token) => !current.includes(token)).forEach((token) => add(token, 'to'))
  return [...groups.values()].slice(0, 6).map(({ label, from, to }) => {
    const fallback = FALLBACK_VALUE[label]
    const fromValue = from.join(' ') || fallback?.value || null
    const toValue = to.join(' ') || fallback?.value || null
    return {
      label, from: fromValue, to: toValue,
      fromColor: colorOf(fromValue) ?? (from.length ? null : fallback?.color ?? null),
      toColor: colorOf(toValue) ?? (to.length ? null : fallback?.color ?? null),
    }
  })
}

// A rollback agreement's place in the review flow, in its own words.
export const ROLLBACK_STAGE_LABEL = {
  detected: 'Confirmation not requested',
  in_review: 'Awaiting confirmation',
  approved: 'Confirmed · ready to roll back',
  resolved: 'Rolled back',
}
