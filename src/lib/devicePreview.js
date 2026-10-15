// A design frame shown on another phone, a tablet or in a browser, and the
// part of it that changed.
//
// Frames are drawn at a design scale — a phone frame is ~280 wide for a
// 390pt-wide screen — with absolutely placed layers. On another device the
// frame takes that device's proportions at the same scale.
// On a phone each layer keeps to the edge it's laid out against:
//   · spanning the width (inset the same, or nearly, on both sides) → stretches
//   · centered → stays centered
//   · nearer the right edge → keeps its right inset
//   · flush with the bottom (a tab bar) → stays at the bottom
//   · anything else → where it was
// On a tablet or in a browser the layout is fluid instead: the content sits
// in a centred column (the whole width up to `column`), every layer keeps its
// place and share of it, a full-bleed layer spans the whole screen, and the
// bottom-flush ones stay at the bottom. A browser has no status bar — its
// own address bar instead (`chrome`), drawn over the top of the frame.
// A shorter screen cuts the rest off below the fold, as the device would.
export const DEVICE_KINDS = [
  { id: 'phone', label: 'Mobile' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'browser', label: 'Browser' },
]
export const DEVICES = [
  { id: 'design', label: 'Design frame' },
  { id: 'iphone-se', kind: 'phone', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-15', kind: 'phone', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'iphone-15-pro-max', kind: 'phone', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { id: 'galaxy-s24', kind: 'phone', label: 'Galaxy S24', width: 360, height: 780 },
  { id: 'pixel-8', kind: 'phone', label: 'Pixel 8', width: 412, height: 915 },
  { id: 'ipad-mini', kind: 'tablet', label: 'iPad mini', width: 744, height: 1133, column: 600 },
  { id: 'ipad-air', kind: 'tablet', label: 'iPad Air', width: 820, height: 1180, column: 640 },
  { id: 'ipad-air-landscape', kind: 'tablet', label: 'iPad Air · landscape', width: 1180, height: 820, column: 720 },
  { id: 'browser-1024', kind: 'browser', label: 'Browser · small', width: 1024, height: 700, column: 720 },
  { id: 'browser-1280', kind: 'browser', label: 'Browser · laptop', width: 1280, height: 800, column: 760 },
  { id: 'browser-1440', kind: 'browser', label: 'Browser · desktop', width: 1440, height: 900, column: 800 },
]
// The address bar a browser draws over the frame, in screen px.
export const BROWSER_CHROME = 40
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
  if (device.kind === 'tablet' || device.kind === 'browser') return fluidFrame(frame, device, k, width, height)
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

// A phone's frame on a wider screen: a centred column, the layers fluid in it.
// (The phone's status bar: a bar across the very top — said so, or by where it is.)
const isStatusBar = (layer, frame) => layer.type === 'bar' && (layer.mock?.role === 'status' || (layer.y <= 2 && layer.height <= 32 && layer.width >= frame.width - 4))
function fluidFrame(frame, device, k, width, height) {
  const browser = device.kind === 'browser'
  const chrome = browser ? Math.round(BROWSER_CHROME * k) : 0
  const column = Math.min(width, Math.round((device.column ?? device.width) * k))
  const ratio = column / frame.width
  const offset = Math.round((width - column) / 2)
  const layers = frame.layers.filter((layer) => !(browser && isStatusBar(layer, frame))).map((layer) => {
    const bottom = frame.height - (layer.y + layer.height)
    const fullBleed = layer.x <= 2 && layer.x + layer.width >= frame.width - 2
    const x = fullBleed ? 0 : Math.round(offset + layer.x * ratio)
    const w = fullBleed ? width : Math.round(layer.width * ratio)
    const y = bottom <= 4 && layer.y > frame.height / 2 ? height - bottom - layer.height : layer.y + chrome
    return { ...layer, x, y, width: w }
  })
  return { ...frame, width, height, layers, chrome: browser ? { height: chrome, label: device.label } : null }
}

// The box around `layerIds` in `frame`, with room around it — what the
// "Changed element" view shows. Null when none of them is in the frame.
export function focusBox(frame, layerIds = [], pad = 16) {
  const hits = (frame?.layers ?? []).filter((layer) => layerIds.includes(layer.id))
  if (!hits.length) return null
  let left = Math.min(...hits.map((l) => l.x))
  let top = Math.min(...hits.map((l) => l.y))
  let right = Math.max(...hits.map((l) => l.x + l.width))
  let bottom = Math.max(...hits.map((l) => l.y + l.height))
  // (A neighbour right above or below that the pad would cut through — a label over a button — is taken in
  // whole: the cut never shows half a line of text. Not one beside it, and not the screen's own backdrops.)
  const area = (frame.width ?? 0) * (frame.height ?? 0)
  const hitLeft = left, hitRight = right
  for (const layer of frame.layers ?? []) {
    if (hits.includes(layer) || (area && layer.width * layer.height > area / 2)) continue
    const sharesColumns = layer.x < hitRight && layer.x + layer.width > hitLeft
    const cut = layer.y < bottom + pad && layer.y + layer.height > top - pad && !(layer.y >= top && layer.y + layer.height <= bottom)
    if (sharesColumns && cut) {
      top = Math.min(top, layer.y); bottom = Math.max(bottom, layer.y + layer.height)
      left = Math.min(left, layer.x); right = Math.max(right, layer.x + layer.width)
    }
  }
  const x0 = Math.max(0, left - pad)
  const y0 = Math.max(0, top - pad)
  const x1 = Math.min(frame.width, right + pad)
  const y1 = Math.min(frame.height, bottom + pad)
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
