// The design system's scales — the one list a value is picked from (the
// 해결 방법 card's scale, lib/changeAdapters). Smallest first.
export const SPACE_TOKENS = [
  { token: 'space.1', px: 4 },
  { token: 'space.2', px: 8 },
  { token: 'space.3', px: 12 },
  { token: 'space.4', px: 16 },
  { token: 'space.5', px: 20 },
  { token: 'space.6', px: 24 },
]
export const SIZE_TOKENS = [16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 144].map((px) => ({ token: `size.${px}`, px }))
export const WEIGHT_TOKENS = [
  { token: 'regular', weight: 400 },
  { token: 'medium', weight: 500 },
  { token: 'semibold', weight: 600 },
  { token: 'bold', weight: 700 },
  { token: 'extrabold', weight: 800 },
  { token: 'black', weight: 900 },
]
export const BREAKPOINT_TOKENS = [
  { token: 'breakpoint.mobile', px: 640 },
  { token: 'breakpoint.tablet', px: 768 },
  { token: 'breakpoint.desktop', px: 1024 },
  { token: 'breakpoint.wide', px: 1280 },
]
export const COLOR_TOKENS = [
  { token: 'color.cta', hex: '#2563EB' },
  { token: 'color.ctaDark', hex: '#0F172A' },
  { token: 'color.accent', hex: '#7C3AED' },
  { token: 'color.primary', hex: '#6366F1' },
]
