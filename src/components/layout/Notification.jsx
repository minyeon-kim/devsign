import { CircleCheck, Info, OctagonX, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'

// The one notification: every card that announces something is this, with
// only its `type` changed — success, warning, error or info (none: no
// accent). Its look is the notification tokens' (index.css): the surface,
// the type's accent on the icon and the left line, the title and body
// type, the dismiss button and the actions. Toasts (Sonner) and the bell's
// dropdown read the same tokens, so they match without sharing markup.
const TYPE_ICON = { success: CircleCheck, warning: TriangleAlert, error: OctagonX, info: Info }
const text = (value) => (typeof value === 'string' ? <LocalizedText text={value} /> : value)

// `icon`: a component to use in place of the type's own.
// `actions`: [{ label, onClick, quiet?, ...buttonProps }] — at most one filled.
// `children`: anything between the text and the actions (a list of rows).
export function Notification({ type, icon, title, body, bodyClassName, children, actions = [], onDismiss, dismissLabel = '알림 닫기', as: Tag = 'section', className, ...rest }) {
  const Icon = icon ?? TYPE_ICON[type] ?? Info
  return (
    <Tag data-notification data-type={type} className={cn('ds-notification pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none', className)} {...rest}>
      {onDismiss && (
        <button type="button" data-notice-dismiss aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss} className="ds-intrinsic ds-notification-close">
          <X aria-hidden />
        </button>
      )}
      <div className={cn('flex items-start gap-3', onDismiss && 'pr-8')}>
        <span className="ds-notification-icon"><Icon aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="ds-notification-title">{text(title)}</p>
          {body && <p className={cn('ds-notification-body', bodyClassName)}>{text(body)}</p>}
        </div>
      </div>
      {children}
      {actions.length > 0 && (
        <div className="ds-notification-actions">
          {actions.map(({ label, quiet, ...button }, index) => (
            <button key={index} type="button" {...button} className={cn('ds-intrinsic', quiet ? 'ds-notification-action-quiet' : 'ds-notification-action')}>
              {text(label)}
            </button>
          ))}
        </div>
      )}
    </Tag>
  )
}

// A row inside a notification — the whole row is the way in.
export function NotificationRow({ className, ...props }) {
  return <button type="button" {...props} className={cn('ds-intrinsic ds-notification-row', className)} />
}

export default Notification
