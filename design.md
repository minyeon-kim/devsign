# Devsign Design Tokens

This file is the source of truth for page styling. Reuse the CSS variables and shared component classes below instead of adding one-off colors, spacing, or primary action styles. These tokens apply to Dashboard, project overview, Workspace, Docs, History, Activity, Team, import, and Merge Studio.

## Dark palette

| Token | Value | Use |
| --- | --- | --- |
| `--ds-bg-base` | `#0A0A0A` | App canvas and page background |
| `--ds-surface-card` | `#121212` | Panels, cards, sidebars, and raised surfaces |
| `--ds-surface-raised` | `#1B1B1D` | Hover, selected, and secondary control fills |
| `--ds-border-subtle` | `rgba(255, 255, 255, 0.08)` | Quiet dividers and outlines |
| `--ds-primary` | `#5EEAB5` | Global primary action and focus accent |
| `--ds-primary-foreground` | `#0A0A0A` | Text/icons on the solid mint primary fill |
| `--ds-primary-violet` | `#8B5CF6` | Decorative design-canvas gradient only; never a UI primary button |
| `--ds-chat-action-bg` | `#0E201C` | User chat bubble surface |
| `--ds-chat-action-fg` | `#D1FAE5` | User chat bubble text/icons |
| `--ds-review-action-bg` | `#5EEAB5` | Request review action surface |
| `--ds-review-action-fg` | `#0A0A0A` | Request review action text/icons |
| `--ds-fg` | `#FAFAFA` | Main text |
| `--ds-fg-muted` | `#A1A1AA` | Secondary text |

Status colors remain semantic: green for success/resolved, amber for warning/in-progress, and red for destructive/error states. Violet is reserved for design-canvas content and never overrides the mint UI primary.

## Spacing and shape

| Token | Value | Use |
| --- | --- | --- |
| `--ds-gutter-layout` | `12px` | Consistent gaps between app regions and panels |
| `--ds-padding-card` | `16px` | Standard card/panel content inset |
| `--ds-padding-row-compact` | `12px` | Dense rows and compact controls |
| `--ds-control-height` | `32px` | Workspace buttons, tabs, pills, inputs and bottom actions |
| `--ds-chat-submit-radius` | `50%` | Circular 32 × 32px AI submit button |
| `--ds-radius-md` | `8px` | Primary CTA and compact controls |
| `--ds-radius-card` | `12px` | Standard cards |
| `--ds-radius-pill` | `9999px` | Status and count pills |

## Components

- Global primary buttons: use `.ds-primary-cta` or theme `bg-primary text-primary-foreground`; solid `#5EEAB5` fill, `#0A0A0A` text/icons, no border, and full-round `border-radius: 9999px !important`. Do not use purple, gradient, or outline styling for a primary action.
- Workspace controls have a strict `height: 32px`, including compact size variants, top pills, tabs and bottom actions. Icon controls are 32 × 32px. Content rows, noninteractive badges, canvas artwork, switches and multiline editors retain their intrinsic sizing.
- Secondary/ghost action: use the card surface and subtle border; hover to a solid raised surface without a gradient.
- Badge/count pill: use `.ds-badge-pill`; fully rounded, 2–3px vertical and 6–8px horizontal padding, 11–12px medium text, and a high-contrast solid tint.
- User chat bubbles retain `.ds-chat-user-bubble` in dark green for role distinction; AI submit buttons use `.ds-chat-submit`: a 32 × 32px circle, `border-radius: 50% !important`, no border, solid mint `#5EEAB5` fill and contrasting `#0A0A0A` icon. Other primary chat actions use solid mint.
- **Immutable action rule:** `Request review` uses `.ds-review-cta` and the `--ds-review-action-*` tokens with the exact rule `background-color: #5EEAB5; color: #0A0A0A; border: none;`. It is visually mint like every primary button and remains component-bound so future global changes cannot override it. Do not apply gradients or outline styling.
- Tooltips, popovers, and step guides use a solid `#121212` surface, subtle `--ds-border-subtle` edge, and high-contrast text. Guide copy stays short and action-oriented.
- Layout spacing and standard inset: use `var(--ds-gutter-layout)` and `var(--ds-padding-card)` rather than page-specific approximations.

## Implementation

The dark theme variables live in `src/index.css`. Shared action classes live beside them there and are referenced by `src/components/mergestudio/floatingStyles.js` so primary actions stay consistent across pages. When adding or restyling a page, prefer theme utilities (`bg-background`, `bg-card`, `border-border`, `text-primary`) or the shared token classes over hard-coded color values.

## Canvas, history and review corrections

- Canvas floating toolbar and every internal selection tool use `.ds-pill` with `border-radius: 9999px !important`. The toolbar container and its button descendants are explicitly targeted. This enforced shape overrides the shared primary CTA radius, including active mint tools. Icon tools remain 32 × 32px.
- AI submit uses `.ds-chat-submit` in workspace chat and Merge Studio: `width: 32px !important; height: 32px !important; border-radius: 50% !important; background-color: #5EEAB5 !important; color: #0A0A0A !important;`. Minimum and maximum dimensions are also fixed to 32px with `!important`, with zero padding, no border/gradient and no flex shrinking. User chat bubbles keep their dark mint tokens.
- History playback toolbar has a transparent background, no bounding border/ring and no container shadow in both full and compact views. Individual controls and the slider retain their own fills.
- History Current/Restore controls use `.ds-pill` with `border-radius: 9999px`, including disabled Current states.
- The review sidebar's Status, Reviewers and Comments boxes share `.ds-review-context`: 12px padding on every side, 12px gaps between boxes, and 8px between headings/progress and content. Section headings share a 32px height and zero top margin. Scrolling and content-driven heights remain intact.
