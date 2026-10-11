// The screens a code render is looked at on — one place for the device
// presets and the breakpoints, so a device is added or a size corrected here
// and nowhere else.
//
// Sizes are CSS px, portrait (width × height). Each category has a
// `reference`: the device a change about that category starts on (the
// tablet breakpoint's own 768px for a tablet change).

// Where each range starts. A width is a tablet's from 768 up to (not
// including) 1024 — what `useBreakpoint() === "tablet"` is taken to mean.
// The sample project imports that hook without its source, so the range is
// this file's: the usual 768 / 1024 pair.
export const BREAKPOINTS = { tablet: 768, desktop: 1024 }
export const breakpointOf = (width) => (width >= BREAKPOINTS.desktop ? 'desktop' : width >= BREAKPOINTS.tablet ? 'tablet' : 'mobile')
export const BREAKPOINT_LABEL = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' }

export const DEVICE_PRESETS = {
  mobile: {
    label: 'Mobile',
    reference: 'iphone-15',
    devices: [
      { id: 'galaxy-s24', label: 'Galaxy S24', width: 360, height: 780 },
      { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
      { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852 },
      { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915 },
      { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
    ],
  },
  tablet: {
    label: 'Tablet',
    reference: 'ipad-classic',
    devices: [
      { id: 'ipad-mini', label: 'iPad mini', width: 744, height: 1133 },
      { id: 'ipad-classic', label: 'iPad (classic)', width: 768, height: 1024 },
      { id: 'galaxy-tab', label: 'Galaxy Tab', width: 800, height: 1280 },
      { id: 'ipad-air', label: 'iPad Air / iPad 10th gen', width: 820, height: 1180 },
      { id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, height: 1194 },
      { id: 'ipad-pro-12-9', label: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    ],
  },
  desktop: {
    label: 'Desktop',
    reference: 'desktop-1280',
    devices: [
      { id: 'desktop-1280', label: 'Laptop', width: 1280, height: 720 },
      { id: 'desktop-1440', label: 'Desktop', width: 1440, height: 900 },
      { id: 'desktop-1920', label: 'Full HD', width: 1920, height: 1080 },
    ],
  },
}
export const CATEGORIES = Object.keys(DEVICE_PRESETS)
export const ALL_DEVICES = CATEGORIES.flatMap((category) => DEVICE_PRESETS[category].devices.map((device) => ({ ...device, category })))
export const CUSTOM_DEVICE = 'custom'
const CUSTOM_HEIGHT = 1024

// The screen a pick stands for: `{ deviceId, orientation, customWidth }` →
// its size as held (landscape swaps the two), and the breakpoint its width
// falls in — which can leave its category's (an iPad on its side is 1024
// wide: a desktop's layout).
export function screenOf(pick = {}, category = 'tablet') {
  const landscape = pick.orientation === 'landscape'
  if (pick.deviceId === CUSTOM_DEVICE) {
    const width = Math.max(240, Math.min(2560, Math.round(Number(pick.customWidth) || BREAKPOINTS.tablet)))
    return { id: CUSTOM_DEVICE, label: 'Custom width', category, custom: true, orientation: 'portrait', width, height: CUSTOM_HEIGHT, breakpoint: breakpointOf(width) }
  }
  const device = ALL_DEVICES.find((entry) => entry.id === pick.deviceId) ?? ALL_DEVICES.find((entry) => entry.id === DEVICE_PRESETS[category].reference)
  const width = landscape ? device.height : device.width
  const height = landscape ? device.width : device.height
  return { ...device, orientation: landscape ? 'landscape' : 'portrait', width, height, breakpoint: breakpointOf(width), reference: device.id === DEVICE_PRESETS[device.category].reference }
}
// Where a change about `category` starts: its reference device, upright.
export const referencePick = (category = 'tablet') => ({ deviceId: DEVICE_PRESETS[category]?.reference ?? DEVICE_PRESETS.tablet.reference, orientation: 'portrait', customWidth: null })
