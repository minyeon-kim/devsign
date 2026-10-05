import { canvasPages, designMergeVariants } from '@/data/mockData'
import { buildDrifts, buildOverrides } from '@/components/mergestudio/mergeSummary'
import { isCustomResolution } from '@/components/mergestudio/mergeEffects'
import { compositionChecks, composeDraftFrame, draftScreens, regionPicks } from '@/data/draftScreens'

// ----- Merge impact & health assessment (the Check step) --------------
// Everything is derived from the item's own data and the current choices,
// so the numbers move as options are decided.
//
// A property value is "on the token scale" when it matches the design
// system: 4px spacing grid, the radius scale, the type / weight scales, or
// a named color / surface token.
const RADIUS_SCALE = new Set([0, 2, 4, 6, 8, 12, 16, 20, 24, 999])
const TYPE_SCALE = new Set([12, 14, 16, 18, 20, 24, 28, 32, 40, 48])
const WEIGHT_SCALE = new Set([400, 500, 600, 700])
const LAYOUT_PROPS = /padding|spacing|font size|width|height|gap/i
const ACCENT_HEX = { 'Indigo 500': '#6366f1', 'Violet 500': '#8b5cf6' }
// Sections of the page, from layer ids (nav-…, hero-…): the screens a
// merge touches.
const SECTION_NAMES = { nav: 'Navigation', hero: 'Hero', signup: 'Sign-up', social: 'Social proof', avatar: 'Social proof', feature: 'Features', dash: 'Dashboard', cashflow: 'Dashboard', txn: 'Dashboard' }

function onTokenScale(label, value) {
  // CSS variable references are named tokens, not numeric scale values.
  if (/^(?:--[a-zA-Z_][\w-]*|var\(\s*--[a-zA-Z_][\w-]*\s*\))$/.test(String(value).trim())) return true
  // A named color / surface token ("Violet 500", "Card Surface").
  if (/^[A-Z][a-z]+( [A-Z]?[a-z]+)*( \d{2,3})?$/.test(String(value).trim())) return true
  const nums = String(value).match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (!nums.length) return false
  if (/radius/i.test(label)) return nums.every((n) => RADIUS_SCALE.has(n))
  if (/font size/i.test(label)) return nums.every((n) => TYPE_SCALE.has(n))
  if (/weight/i.test(label)) return nums.every((n) => WEIGHT_SCALE.has(n))
  return nums.every((n) => n % 4 === 0)
}

function relLuminance(hex) {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrastOnWhite = (hex) => 1.05 / (relLuminance(hex) + 0.05)

export function assessMerge(item, resolutions, summary, evaluatedFrame) {
  const frame = evaluatedFrame ?? (item.hasDesign ? canvasPages.find((p) => p.id === item.designPageId)?.frames[0] : null)
  const layers = frame?.layers ?? []
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}
  const drifts = buildDrifts(item, frame)

  // Every property decision, with the value that will actually ship
  // (undecided = the Current Implementation's value).
  const props = Object.entries(layerDiffs).flatMap(([layerId, diffs]) =>
    diffs.map((diff) => {
      const r = resolutions[`${layerId}:${diff.id}`]
      const value = isCustomResolution(r) ? r.custom : r === 'A' ? diff.optionA : diff.optionB
      return { layerId, diff, value, decided: Boolean(r), changed: value !== diff.optionA }
    })
  )
  const offScale = props.filter((p) => !onTokenScale(p.diff.label, p.value))
  const consistency = props.length ? Math.round(((props.length - offScale.length) / props.length) * 100) : 100
  const breaking = props.filter((p) => p.changed && LAYOUT_PROPS.test(p.diff.label))
  const risk = breaking.length === 0 ? 'Low' : breaking.length <= 2 ? 'Medium' : 'High'
  const undecided = props.filter((p) => !p.decided).length

  // Screens (page sections) touched, with element / property counts.
  const bySection = new Map()
  for (const [layerId, diffs] of Object.entries(layerDiffs)) {
    const name = SECTION_NAMES[layerId.split('-')[0]] ?? 'Other'
    const entry = bySection.get(name) ?? { name, elements: 0, props: 0 }
    entry.elements += 1
    entry.props += diffs.length
    bySection.set(name, entry)
  }
  const screens = [...bySection.values()]

  // Automated checks.
  // Target size (WCAG 2.5.8) is about the touch area, not how big the
  // glyph is drawn: a control's touch area is its decided Tap / Hit area
  // when it has one, otherwise its own size. Only what this merge changes
  // is checked — an untouched element elsewhere on the screen isn't this
  // change's to fix (with nothing mapped, the whole frame still is).
  const TOUCH_PROP = /tap area|hit area|touch/i
  const sizeProp = (layerId, pattern) => {
    const size = parseFloat(props.find((p) => p.layerId === layerId && pattern.test(p.diff.label))?.value)
    return Number.isFinite(size) ? size : null
  }
  const touchOf = (l) => sizeProp(l.id, TOUCH_PROP) ?? Math.min(l.width, l.height)
  const changedLayers = new Set(Object.keys(layerDiffs))
  const interactive = layers.filter((l) => ['button', 'input', 'iconbtn', 'chip', 'toggle'].includes(l.type) && (!changedLayers.size || changedLayers.has(l.id)))
  const smallTargets = interactive.filter((l) => touchOf(l) < 24)
  // An icon drawn under 24px. With a touch area of 24px or more that isn't
  // an accessibility failure — it's the icon not matching the design
  // system, a suggestion. Without one, it's a real target-size failure.
  const smallIcons = props
    .filter((p) => /icon size/i.test(p.diff.label) && parseFloat(p.value) < 24)
    .map((p) => ({ ...p, touch: sizeProp(p.layerId, TOUCH_PROP), name: item.category ?? layers.find((l) => l.id === p.layerId)?.name ?? p.layerId }))
  const untouchableIcons = smallIcons.filter((icon) => icon.touch == null || icon.touch < 24)
  const mismatchedIcons = smallIcons.filter((icon) => icon.touch != null && icon.touch >= 24)
  const targetFailures = smallTargets.length + untouchableIcons.length
  const accents = [...new Set(props.filter((p) => /accent/i.test(p.diff.label) && ACCENT_HEX[p.value]).map((p) => p.value))]
  const worstAccent = accents.map((a) => ({ a, ratio: contrastOnWhite(ACCENT_HEX[a]) })).sort((x, y) => x.ratio - y.ratio)[0]
  const fontSizes = props.filter((p) => /font size/i.test(p.diff.label)).map((p) => parseFloat(p.value))
  const hasConflict = item.conflictLevel && item.conflictLevel !== 'None'

  const checks = [
    {
      id: 'conflict',
      group: 'Merge',
      ok: !hasConflict,
      title: hasConflict ? `${item.conflictLevel} merge conflict` : 'No merge conflicts',
      hint: hasConflict ? 'Conflicting blocks need a version before this merges cleanly.' : null,
      action: hasConflict ? 'resolve' : null,
    },
    {
      id: 'decided',
      group: 'Merge',
      ok: undecided === 0,
      title: undecided === 0 ? `All ${props.length} design options decided` : `${undecided} design option${undecided === 1 ? '' : 's'} undecided`,
      hint: undecided ? 'Decide them in the conflict’s review — undecided ones ship the Current Implementation’s value.' : null,
    },
    {
      id: 'tokens',
      layerId: offScale[0]?.layerId,
      group: 'Design system',
      ok: offScale.length === 0,
      title: offScale.length === 0 ? 'All values on the token scale' : `${offScale.length} value${offScale.length === 1 ? '' : 's'} off the token scale`,
      hint: offScale.length ? offScale.map((p) => `${layers.find((l) => l.id === p.layerId)?.name ?? p.layerId} ${p.diff.label.toLowerCase()} ${p.value}`).join(' · ') : null,
    },
    worstAccent && {
      id: 'contrast',
      layerId: props.find((p) => /accent/i.test(p.diff.label))?.layerId,
      group: 'Accessibility',
      ok: worstAccent.ratio >= 4.5,
      title: `Button text contrast ${worstAccent.ratio.toFixed(1)}:1`,
      hint: worstAccent.ratio >= 4.5 ? null : `${worstAccent.a} with white text is below WCAG AA (4.5:1).`,
    },
    {
      id: 'targets',
      layerId: smallTargets[0]?.id ?? untouchableIcons[0]?.layerId,
      group: 'Accessibility',
      ok: targetFailures === 0,
      // Named, not counted, when it's one thing: "Menu Button touch area 20px".
      title: targetFailures === 0 ? `Target size ≥ 24px on all ${interactive.length} controls`
        : targetFailures > 1 ? `${targetFailures} controls with a touch area under 24px`
          : smallTargets.length ? `${smallTargets[0].name} touch area ${touchOf(smallTargets[0])}px`
            : `${untouchableIcons[0].name} icon ${untouchableIcons[0].value} with no larger touch area`,
      hint: targetFailures ? 'WCAG 2.2 AA (2.5.8) asks for a touch area of at least 24px.' : null,
    },
    mismatchedIcons.length > 0 && {
      id: 'icon-size',
      layerId: mismatchedIcons[0].layerId,
      // Not Accessibility: the touch area passes. It's the design system's
      // size that isn't matched — a suggestion, never a blocker.
      group: 'Consistency',
      ok: false,
      title: `${mismatchedIcons[0].name} icon ${mismatchedIcons[0].value}`,
      hint: `Its ${mismatchedIcons[0].touch}px touch area meets WCAG 2.5.8, so this doesn’t block the merge — the icon is just smaller than the design system’s ${mismatchedIcons[0].diff.optionA}.`,
    },
    fontSizes.length > 0 && {
      id: 'text',
      layerId: props.find((p) => /font size/i.test(p.diff.label) && parseFloat(p.value) < 12)?.layerId,
      group: 'Accessibility',
      ok: fontSizes.every((n) => n >= 12),
      title: fontSizes.every((n) => n >= 12) ? 'Text sizes ≥ 12px' : 'Text below 12px',
      hint: null,
    },
    {
      id: 'ai',
      group: 'Merge',
      ok: summary.pending === 0,
      title: summary.pending === 0 ? (summary.applied.length ? `${summary.applied.length} AI edit${summary.applied.length === 1 ? '' : 's'} applied` : 'No pending AI notes') : `${summary.pending} AI note${summary.pending === 1 ? '' : 's'} not applied`,
      hint: summary.pending ? 'Use “Apply with AI” on the canvas to include them.' : null,
    },
  ].filter(Boolean)

  return { drifts, props, consistency, breaking, risk, screens, checks, codeFiles: summary.files.length }
}


// Checks run on their own — whenever a change exists or is edited — rather
// than as a step someone takes: this is what every place that shows a
// change's checks reads (the review, the conflict list, merging).
// `blocking` are the ones that stop a merge (merge conflicts, the design
// system, accessibility); undecided options and pending AI notes are
// warnings only. The step flow's "merge conflict" check is left out: it
// read the item's risk level (Low / Medium) as a conflict, so it failed for
// every item; real conflict markers are caught when merging
// (mergeBlockReason).
// Content (e.g. two totals that disagree) is a real bug on screen, so it
// blocks too; Consistency findings are warnings.
const BLOCKING_GROUPS = new Set(['Design system', 'Accessibility', 'Content'])

// `linesOf(fileId)`: the item's files as they are now, for the conflict-
// marker check (a real merge conflict left in the code blocks the merge).
export function checksFor(item, draft = {}, linesOf = () => []) {
  if (!item) return null
  const annotations = draft.annotations ?? []
  const summary = {
    pending: annotations.filter((a) => a.status !== 'done').length,
    applied: annotations.filter((a) => a.status === 'done'),
    files: item.fileIds ?? [],
  }
  const built = buildOverrides(item, draft.resolutions ?? {}, annotations.filter((a) => a.status === 'done'), draft.appliedPreset, draft.assemblies, draft.addedLayers, draft.manualCode, linesOf)
  const frame = draftScreens[item.id] ? composeDraftFrame(item.id, built.frame, regionPicks(item.id, draft.resolutions ?? {}), item.authorAId) : built.frame
  const evaluatedFrame = frame && { ...frame, layers: frame.layers.map((layer) => ({
    ...layer,
    width: draft.assemblies?.[layer.id]?.width ?? layer.width + (built.overrides[layer.id]?.dw ?? 0),
    height: draft.assemblies?.[layer.id]?.height ?? layer.height + (built.overrides[layer.id]?.dh ?? 0),
  })) }
  const assessed = assessMerge(item, draft.resolutions ?? {}, summary, evaluatedFrame)
  const markerFiles = (item.fileIds ?? []).filter((id) => (linesOf(id) ?? []).some((line) => /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/.test(line)))
  const checks = [
    {
      id: 'markers',
      fileId: markerFiles[0],
      group: 'Merge',
      ok: markerFiles.length === 0,
      title: markerFiles.length ? `Merge conflict in ${markerFiles.length} file${markerFiles.length === 1 ? '' : 's'}` : 'No merge conflicts',
      hint: markerFiles.length ? 'Pick a version for the conflicting lines (<<<<<<< / >>>>>>>) in the code.' : null,
    },
    // Drafts mixed by region: the composed screen's own checks in place of
    // the per-property ones (there are no property decisions to check).
    ...(draftScreens[item.id]
      ? [...compositionChecks(item.id, regionPicks(item.id, draft.resolutions ?? {}), item.authorAId), ...assessed.checks.filter((c) => ['targets', 'icon-size', 'ai'].includes(c.id))]
      : assessed.checks.filter((c) => c.id !== 'conflict')),
  ]
  const failing = checks.filter((c) => !c.ok)
  const blocking = failing.filter((c) => c.id === 'markers' || BLOCKING_GROUPS.has(c.group))
  // What the change touches, from the same assessment — the old Check
  // step's impact numbers.
  const impact = { screens: assessed.screens, consistency: assessed.consistency, risk: assessed.risk, breaking: assessed.breaking.length }
  return { checks, passed: checks.length - failing.length, failing, blocking, impact }
}
