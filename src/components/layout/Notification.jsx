import { X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'

// The one notification: every card that announces something is this, with
// only its `type` changed — success, warning, error or info (none: no
// accent). Its look is the notification tokens' (index.css), laid out as the
// system's own: a dark frosted card (no icon — the title says what it is),
// the title and body, the action at the right of that row (under
// it when the card lists something) and a round × on the top-left corner,
// shown on hover. Toasts (Sonner) and the bell's
// dropdown read the same tokens, so they match without sharing markup.
const text = (value) => (typeof value === 'string' ? <LocalizedText text={value} /> : value)

// A card that can be dismissed (`onDismiss`) is dismissed by pressing it anywhere that isn't a
// control of its own — its buttons and links do their own thing, and a press that ends a text
// selection isn't one. From the keyboard: focus it, then Enter, Space or Esc (focus moves on to
// a card beside it). Dismissing only puts it away: it stays in the Inbox.
const OWN_CONTROLS = 'button, a, input, textarea, select, summary, [role="button"], [role="menuitem"]'

// `icon`: kept for callers, not drawn — the card has no icon.
// `actions`: [{ label, onClick, quiet?, ...buttonProps }] — at most one filled.
// `children`: anything between the text and the actions (a list of rows).
export function Notification({ type, icon: _icon, title, body, bodyClassName, children, actions = [], onDismiss, dismissLabel = '알림 닫기', dismissHint = '누르면 알림이 닫혀요', as: Tag = 'section', className, ...rest }) {
  const dismissible = typeof onDismiss === 'function'
  function onPress(event) {
    if (!dismissible || event.defaultPrevented || event.target.closest?.(OWN_CONTROLS)) return
    if (window.getSelection?.()?.toString()) return
    onDismiss()
  }
  function onKeyDown(event) {
    if (!dismissible || event.target !== event.currentTarget || !['Enter', ' ', 'Escape'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const card = event.currentTarget
    const beside = [card.nextElementSibling, card.previousElementSibling].find((el) => el?.matches?.('[data-notification][tabindex]'))
    onDismiss()
    queueMicrotask(() => beside?.isConnected && beside.focus())
  }
  // (A dismissible card is put away by pressing it or its ×: its quiet "Later" would say it a third time.)
  const shown = dismissible ? actions.filter((action) => !action.quiet) : actions
  const inline = !children
  const actionRow = shown.length > 0 && (
    <div className={cn('ds-notification-actions', inline && 'ds-notification-actions-inline')}>
      {shown.map(({ label, quiet, ...button }, index) => (
        <button key={index} type="button" {...button} className={cn('ds-intrinsic', quiet ? 'ds-notification-action-quiet' : 'ds-notification-action')}>
          {text(label)}
        </button>
      ))}
    </div>
  )
  return (
    <Tag
      data-notification
      data-type={type}
      data-dismissible={dismissible ? '' : undefined}
      tabIndex={dismissible ? 0 : undefined}
      aria-description={dismissible ? dismissHint : undefined}
      onClick={onPress}
      onKeyDown={onKeyDown}
      className={cn('ds-notification ds-notification-enter', className)}
      {...rest}
    >
      {onDismiss && (
        <button type="button" data-notice-dismiss aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss} className="ds-intrinsic ds-notification-close">
          <X aria-hidden />
        </button>
      )}
      <div data-inline={inline && shown.length > 0 ? '' : undefined} className="ds-notification-head flex items-center gap-3">
        {/* (No icon: the title says what it is; the card gives its room to the text.) */}
        <div className="min-w-0 flex-1">
          <p className="ds-notification-title">{text(title)}</p>
          {body && <p className={cn('ds-notification-body', bodyClassName)}>{text(body)}</p>}
        </div>
        {inline && actionRow}
      </div>
      {children}
      {!inline && actionRow}
    </Tag>
  )
}

// A row inside a notification — the whole row is the way in.
export function NotificationRow({ className, ...props }) {
  return <button type="button" {...props} className={cn('ds-intrinsic ds-notification-row', className)} />
}

export default Notification
