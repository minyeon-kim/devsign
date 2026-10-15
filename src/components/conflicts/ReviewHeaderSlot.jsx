import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// Lets something inside a change's detail put its view controls (원안 보기,
// 전체 화면으로 보기) into the detail's header, beside Close — so the
// sections themselves carry only what's decided in them. The header provides
// the slot; without one (the bottom panel's review) the controls stay in place.
export const ReviewHeaderSlotContext = createContext(null)
// Whether the detail is the full page (the overlay) — where there's room for code side by side.
export const FullPageReviewContext = createContext(false)

export function ReviewHeaderPortal({ children, fallbackClassName }) {
  const slot = useContext(ReviewHeaderSlotContext)
  if (slot) return createPortal(children, slot)
  return <div className={fallbackClassName}>{children}</div>
}
