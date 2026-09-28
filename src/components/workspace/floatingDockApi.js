import { useReducer, useRef } from 'react'

// A dockview-shaped facade over a much simpler floating-window model:
// panels live in "groups" (a group is a floating window; when a group has
// more than one panel, they're its tabs) with a free x/y/w/h/z instead of a
// docked split-pane tree. Implementing the same shape dockview-react
// exposed — getPanel/panels/addPanel/addGroup, panel.api.{setActive,close,
// maximize,exitMaximized,isMaximized}, group.api.setSize, onDidLayoutChange
// — means DockLayout.jsx's buildInitialLayout/addDockPanel/addSidebarPanel/
// openOrFocusPanel, and every consumer of `dockApi` (LayoutMenu,
// CanvasPanel's layer-inspect tabs, WorkspacePage's Preview
// toggle), all keep working completely unchanged — only the rendering
// layer (this + FloatingCanvas, instead of DockviewReact) is new.
const GAP = 12
const DEFAULT_GROUP_W = 420
// Used for the editor's 'above'-the-terminal split specifically (its only
// caller with no explicit initialHeight) — tall enough that the sidebar
// column carved out of it (explorer + gap + layers, ~450px) fits inside
// its row instead of poking down into the terminal strip below.
const DEFAULT_GROUP_H = 550
// The very first group added (with no reference — dockview's real
// equivalent temporarily fills the whole view) needs a footprint generous
// enough that the sidebar/canvas splits carved out of it later still leave
// the editor itself comfortably wide, not squeezed to a sliver.
const ROOT_GROUP_W = 1300
const ROOT_GROUP_H = 680
export const CANVAS_W = 1850
export const CANVAS_H = 900
const CANVAS_MARGIN = 16

export function useFloatingDockApi() {
  const store = useRef({ panels: {}, groups: {} }).current
  const [, bump] = useReducer((c) => c + 1, 0)
  const listeners = useRef(new Set()).current
  const zCounter = useRef(1)
  let groupSeq = useRef(0).current

  function notify() {
    bump()
    listeners.forEach((cb) => cb())
  }

  function nextZ() {
    return zCounter.current++
  }

  function bringGroupToFront(groupId) {
    const g = store.groups[groupId]
    if (g) g.z = nextZ()
  }

  function findGroupByPanel(panelId) {
    const p = store.panels[panelId]
    return p ? store.groups[p.groupId] : undefined
  }

  function makeGroupHandle(groupId) {
    if (!store.groups[groupId]) return undefined
    return {
      id: groupId,
      api: {
        setSize({ width, height } = {}) {
          const g = store.groups[groupId]
          if (!g) return
          if (width != null) g.w = width
          if (height != null) g.h = height
          notify()
        },
      },
    }
  }

  function makePanelHandle(panelId) {
    const p = store.panels[panelId]
    if (!p) return undefined
    return {
      id: panelId,
      get group() {
        return makeGroupHandle(p.groupId)
      },
      api: {
        setActive() {
          const g = store.groups[p.groupId]
          if (!g) return
          g.activeId = panelId
          g.open = true
          bringGroupToFront(p.groupId)
          notify()
        },
        close() {
          const g = store.groups[p.groupId]
          if (!g) return
          if (g.hideHeader) {
            // Headerless groups (Explorer, Layers+Assets) are one atomic
            // unit from the Layout pop-up's point of view — closing either
            // tab tears down the whole group rather than leaving its
            // sibling stranded with no way back to it, matching
            // addSidebarPanel's "reopening always mints a fresh group"
            // comment (there's nothing worth keeping around to reuse).
            g.panelIds.forEach((id) => delete store.panels[id])
            g.panelIds = []
            g.activeId = null
            g.open = false
            notify()
            return
          }
          g.panelIds = g.panelIds.filter((id) => id !== panelId)
          delete store.panels[panelId]
          if (g.activeId === panelId) g.activeId = g.panelIds[g.panelIds.length - 1] ?? null
          if (g.panelIds.length === 0) g.open = false
          notify()
        },
        maximize() {
          const g = store.groups[p.groupId]
          if (!g) return
          if (!g.maximized) g.prevGeom = { x: g.x, y: g.y, w: g.w, h: g.h }
          g.maximized = true
          bringGroupToFront(p.groupId)
          notify()
        },
        exitMaximized() {
          const g = store.groups[p.groupId]
          if (!g?.maximized) return
          g.maximized = false
          if (g.prevGeom) Object.assign(g, g.prevGeom)
          notify()
        },
        isMaximized() {
          return !!store.groups[p.groupId]?.maximized
        },
      },
    }
  }

  function getPanel(id) {
    return store.panels[id] ? makePanelHandle(id) : undefined
  }

  function getPanelsArray() {
    return Object.keys(store.panels).map(makePanelHandle)
  }

  function resolveRefGroup(options) {
    if (options.referenceGroup) {
      const id = options.referenceGroup.id ?? options.referenceGroup
      return store.groups[id]
    }
    if (options.referencePanel) {
      const id = options.referencePanel.id ?? options.referencePanel
      return findGroupByPanel(id)
    }
    return undefined
  }

  function addGroup(options = {}) {
    const id = options.id || `group-${++groupSeq}`
    let x
    let y
    let w = options.initialWidth ?? DEFAULT_GROUP_W
    let h = options.initialHeight ?? DEFAULT_GROUP_H
    const ref = resolveRefGroup(options)

    if (ref) {
      switch (options.direction) {
        case 'left':
          x = ref.x
          y = ref.y
          h = options.initialHeight ?? ref.h
          ref.x += w + GAP
          ref.w = Math.max(160, ref.w - w - GAP)
          break
        case 'right':
          x = ref.x + ref.w + GAP
          y = ref.y
          h = options.initialHeight ?? ref.h
          break
        case 'above':
          x = ref.x
          y = ref.y
          w = ref.w
          ref.y += h + GAP
          ref.h = Math.max(100, ref.h - h - GAP)
          break
        case 'below':
        default:
          x = ref.x
          y = ref.y + ref.h + GAP
          w = ref.w
          h = options.initialHeight ?? ref.h
          break
      }
    } else {
      // No reference — either the very first group (the "root" everything
      // else eventually splits off of, so it gets a generous footprint
      // regardless of any initialWidth/initialHeight hint — dockview's
      // real first panel behaves the same way, temporarily filling the
      // whole view before later splits shrink it down) or a standalone
      // one dropped near the top-left.
      const isFirst = Object.keys(store.groups).length === 0
      x = CANVAS_MARGIN
      y = CANVAS_MARGIN
      if (isFirst) {
        w = ROOT_GROUP_W
        h = ROOT_GROUP_H
      }
    }

    store.groups[id] = {
      id,
      x,
      y,
      w,
      h,
      z: nextZ(),
      hideHeader: !!options.hideHeader,
      panelIds: [],
      activeId: null,
      open: true,
      maximized: false,
      prevGeom: null,
    }
    notify()
    return makeGroupHandle(id)
  }

  function addPanel({ id, component, title, params, position = {}, initialWidth, initialHeight }) {
    let groupId
    if (position.referenceGroup) {
      groupId = position.referenceGroup.id ?? position.referenceGroup
    } else if (position.direction === 'within' && position.referencePanel) {
      groupId = findGroupByPanel(position.referencePanel)?.id
    }
    if (!groupId) {
      const isRelative = position.direction && position.direction !== 'within'
      const group = addGroup({
        direction: isRelative ? position.direction : undefined,
        referencePanel: isRelative ? position.referencePanel : undefined,
        initialWidth,
        initialHeight,
      })
      groupId = group.id
    }

    store.panels[id] = { id, component, title, params, groupId }
    const g = store.groups[groupId]
    g.panelIds.push(id)
    g.activeId = id
    g.open = true
    notify()
    return makePanelHandle(id)
  }

  // Extra methods beyond dockview's own shape — user drag/resize on a
  // floating window, which dockview handled internally and none of the
  // reused consumers (LayoutMenu/CanvasPanel) need to touch.
  function moveGroup(groupId, x, y) {
    const g = store.groups[groupId]
    if (!g || g.maximized) return
    g.x = x
    g.y = y
    notify()
  }

  function resizeGroup(groupId, w, h) {
    const g = store.groups[groupId]
    if (!g || g.maximized) return
    g.w = Math.max(220, w)
    g.h = Math.max(140, h)
    notify()
  }

  function focusGroup(groupId) {
    bringGroupToFront(groupId)
    notify()
  }

  function setActiveTab(groupId, panelId) {
    const g = store.groups[groupId]
    if (!g || !g.panelIds.includes(panelId)) return
    g.activeId = panelId
    notify()
  }

  const dockApi = useRef({
    get panels() {
      return getPanelsArray()
    },
    get height() {
      return CANVAS_H
    },
    getPanel,
    addPanel,
    addGroup,
    onDidLayoutChange(cb) {
      listeners.add(cb)
      return { dispose: () => listeners.delete(cb) }
    },
    moveGroup,
    resizeGroup,
    focusGroup,
    setActiveTab,
  }).current

  return { dockApi, store }
}
