// A design frame shown on another phone, and the part of it that changed.
//
// Frames are drawn at a design scale — a phone frame is ~280 wide for a
// 390pt-wide screen — with absolutely placed layers. On another phone the
// frame takes that phone's proportions at the same scale, and each layer
// keeps to the edge it's laid out against:
//   · spanning the width (inset the same, or nearly, on both sides) → stretches
//   · centered → stays centered
//   · nearer the right edge → keeps its right inset
//   · flush with the bottom (a tab bar) → stays at the bottom
//   · anything else → where it was
// A shorter screen cuts the rest off below the fold, as the phone would.
export const DEVICES = [
  { id: 'design', label: 'Design frame' },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { id: 'galaxy-s24', label: 'Galaxy S24', width: 360, height: 780 },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915 },
]
// The screen width a phone frame is drawn for.
const DESIGN_WIDTH = 390
// A frame this narrow or narrower is a phone's.
export const isPhoneFrame = (frame) => Boolean(frame) && frame.width <= 430 && frame.height > frame.width

export function frameOnDevice(frame, deviceId) {
  const device = DEVICES.find((entry) => entry.id === deviceId)
  if (!frame || !device?.width || !isPhoneFrame(frame)) return frame
  const k = frame.width / DESIGN_WIDTH
  const width = Math.round(device.width * k)
  const height = Math.round(device.height * k)
  const layers = frame.layers.map((layer) => {
    const left = layer.x
    const right = frame.width - (layer.x + layer.width)
    const bottom = frame.height - (layer.y + layer.height)
    const center = layer.x + layer.width / 2
    let { x, width: w, y } = layer
    if (Math.abs(left - right) <= 16 && left <= 48 && layer.width >= frame.width * 0.5) w = width - left - right
    else if (Math.abs(center - frame.width / 2) <= 6) x = Math.round((width - layer.width) / 2)
    else if (right < left) x = width - right - layer.width
    if (bottom <= 4 && layer.y > frame.height / 2) y = height - bottom - layer.height
    return x === layer.x && w === layer.width && y === layer.y ? layer : { ...layer, x, y, width: w }
  })
  return { ...frame, width, height, layers }
}

// The box around `layerIds` in `frame`, with room around it — what the
// "Changed element" view shows. Null when none of them is in the frame.
export function focusBox(frame, layerIds = [], pad = 16) {
  const hits = (frame?.layers ?? []).filter((layer) => layerIds.includes(layer.id))
  if (!hits.length) return null
  const x0 = Math.max(0, Math.min(...hits.map((l) => l.x)) - pad)
  const y0 = Math.max(0, Math.min(...hits.map((l) => l.y)) - pad)
  const x1 = Math.min(frame.width, Math.max(...hits.map((l) => l.x + l.width)) + pad)
  const y1 = Math.min(frame.height, Math.max(...hits.map((l) => l.y + l.height)) + pad)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, layers: hits }
}

// The elements a step changed on the screen, against the step before it:
// every element whose edits differ, and — when the values a checkpoint
// records for the preview differ — the elements those draw (the tab bar,
// the primary button). `frame`: the screen the step is shown on.
const NAV_PROPS = ['iconSize', 'hitArea', 'badgeCount', 'badgeCap']
export function changedLayerIds({ edits = {}, previousEdits = {}, props = {}, previousProps = {}, frame } = {}) {
  const ids = [...new Set([...Object.keys(edits), ...Object.keys(previousEdits)])].filter((id) => JSON.stringify(edits[id]) !== JSON.stringify(previousEdits[id]))
  const differs = (keys) => keys.some((key) => props[key] !== previousProps[key])
  if (differs(NAV_PROPS)) ids.push(...(frame?.layers ?? []).filter((layer) => layer.type === 'tabs').map((layer) => layer.id))
  if (differs(['buttonPadding'])) ids.push('primary-button')
  return [...new Set(ids)]
}
