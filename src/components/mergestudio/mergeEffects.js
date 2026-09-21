// Translates one Variant Compare choice into a visual override for the
// Option B layer: color diffs swap the fill class; radius sets the corner
// radius; size / padding / spacing / weight grow or shrink the box by the
// delta from Option A's value (so picking A is always "no change").
export function diffEffect(diff, side) {
  const value = parseFloat(side === 'A' ? diff.optionA : diff.optionB)
  const base = parseFloat(diff.optionA)
  const effect = {}
  const cls = side === 'A' ? diff.optionAClass : diff.optionBClass
  if (cls) effect.className = cls
  if (Number.isNaN(value)) return effect
  const delta = value - base
  if (/radius/.test(diff.id)) effect.radius = value
  else if (/size/.test(diff.id)) effect.dh = delta
  else if (/padding|spacing/.test(diff.id)) {
    effect.dw = delta * 2
    effect.dh = delta * 2
  } else if (/weight/.test(diff.id)) effect.dh = delta / 50
  return effect
}
