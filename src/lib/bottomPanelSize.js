// How tall the workspace's bottom panel is. Never a fixed default: open, it is
// as tall as what it holds, up to MAX_SHARE of the window (what's past that
// scrolls inside it). Only a height the user dragged to is kept.
export const MAX_SHARE = 0.4
export const STRIP_HEIGHT = 40

// The panel's inline style.
export function panelSizeStyle({ open, maximized, userHeight, dragHeight, availableHeight, fullHeight }) {
  if (dragHeight != null) return { height: dragHeight }
  if (!open) return { height: STRIP_HEIGHT }
  if (maximized) return { height: fullHeight }
  if (userHeight != null) return { height: Math.min(userHeight, availableHeight) }
  return { maxHeight: `${MAX_SHARE * 100}vh` }
}
