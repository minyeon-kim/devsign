// How a canvas's camera moves when the room beside it changes (a panel opening or closing: the app sidebar, the
// tool panel, the right panel). The scale never changes; only the pan does, by the least that keeps what matters
// in view.
//
//   · something picked (a frame, the change in view) that was in view: the content moves only as far as it takes
//     to bring it back inside the narrower canvas — not at all while it is still whole;
//   · nothing picked, or it was out of view: what was at the canvas's centre stays at its centre — the content
//     moves by half of what the canvas gained or lost.
//
// `box`: the picked thing's { left, right } in the canvas's own coordinates (the room already resized);
// `before` / `after`: the canvas's width then and now. → the sideways move, in px (positive: to the right).
export const CAMERA_MARGIN = 16

export function resizeShift({ box = null, before, after, margin = CAMERA_MARGIN }) {
  const centred = (after - before) / 2
  if (!box || !(box.right > 0 && box.left < before)) return centred
  const width = box.right - box.left
  if (width > after - margin * 2) return margin - box.left
  if (box.right > after - margin) return after - margin - box.right
  if (box.left < margin) return margin - box.left
  return 0
}
