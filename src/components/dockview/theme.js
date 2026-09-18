// Dockview theme shell — the actual CSS custom properties are defined in
// src/index.css under `.dockview-theme-devsign` so they can reference our
// shadcn design tokens (var(--primary), var(--border), ...).
export const devsignTheme = {
  name: 'devsign',
  className: 'dockview-theme-devsign',
  gap: 1,
  dndPanelOverlay: 'content',
  dndTabIndicator: 'line',
}
