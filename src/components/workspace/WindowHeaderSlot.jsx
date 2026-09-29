import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// Lets a floating window's content put its own toolbar (the code editor's
// file tabs, the canvas's page tabs) into the window's header row, right
// after the window's title — one header line instead of a title row with
// a second tab row under it. FloatingWindow provides the slot element;
// outside a floating window there's no slot and the toolbar renders in
// place as its own row.
export const WindowHeaderSlotContext = createContext(null)

// True inside a docked window, whose header draws every panel's own tabs
// (the editor's open files, the canvas's pages — see PanelTabs); those
// panels then skip rendering their tab row themselves.
export const WindowTabsContext = createContext(false)

export function WindowHeaderPortal({ children, fallbackClassName }) {
  const slot = useContext(WindowHeaderSlotContext)
  if (slot) return createPortal(children, slot)
  return <div className={fallbackClassName}>{children}</div>
}
