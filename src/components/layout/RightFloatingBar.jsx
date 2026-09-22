import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Copy,
  History,
  MessageSquare,
  ScanEye,
  Share2,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { teamMembers } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import CommentsPanel from '@/components/dockview/panels/CommentsPanel'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'

const EDGE_MARGIN = 12
// TopBar is h-11 (44px) — the toolbar's positioning container sits below it,
// so vertical space math needs to subtract it from window.innerHeight.
const TOPBAR_HEIGHT = 44
// Thickened to match the bottom-right Changes Log widget's own weight
// (that pill is `h-11`/44px tall) instead of reading as a thin sliver next
// to it.
const COLLAPSED_WIDTH = 48
// 4 icon buttons (36 each) + 3 gaps (6 each) + padding (12)
const COLLAPSED_HEIGHT_GUESS = 4 * 36 + 3 * 6 + 12
// Pointer travel (px) before a press on the toolbar counts as a drag rather
// than a click — the whole toolbar is the drag surface now, so this is what
// keeps ordinary icon clicks working.
const DRAG_THRESHOLD = 4
const EXPANDED_WIDTH = 380
// How much room to reserve below the toolbar when a panel first opens.
const EXPANDED_PREFERRED_HEIGHT = 420
const HEADER_HEIGHT = 48
const COLLAPSED_RADIUS = COLLAPSED_WIDTH / 2
const EXPANDED_RADIUS = 26

const flyoutTriggerClass =
  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

const panelSwitcher = [
  { id: 'comments', Icon: MessageSquare, label: 'Comment' },
  { id: 'history', Icon: History, label: 'History' },
  { id: 'share', Icon: Share2, label: 'Share' },
]

function ShareSettingsContent() {
  const [copied, setCopied] = useState(false)
  const [roles, setRoles] = useState(() =>
    Object.fromEntries(teamMembers.map((m) => [m.id, 'Can edit']))
  )
  const [linkAccess, setLinkAccess] = useState('Restricted')

  function copyLink() {
    navigator.clipboard?.writeText('https://devsign.app/share/design-canvas')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="h-full min-h-0 flex-1 space-y-3 overflow-auto p-3 text-xs">
      <div className="space-y-1.5">
        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback className={`text-[10px] font-medium text-white ${member.colorClass}`}>
                {member.initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{member.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
                {roles[member.id]}
                <ChevronDown className="size-2.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={roles[member.id]}
                  onValueChange={(value) =>
                    setRoles((prev) => ({ ...prev, [member.id]: value }))
                  }
                >
                  <DropdownMenuRadioItem value="Can edit">Can edit</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Can view">Can view</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">General access</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-foreground hover:bg-muted">
            {linkAccess}
            <ChevronDown className="size-2.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={linkAccess} onValueChange={setLinkAccess}>
              <DropdownMenuRadioItem value="Restricted">Restricted</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="Anyone with the link">
                Anyone with the link
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={copyLink} className="w-full gap-1.5">
        <Copy className="size-3.5" />
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </div>
  )
}

function RightFloatingBar() {
  const { inspectorOpen, setInspectorOpen, activeView, mergeDrawer, setMergeDrawer } = useWorkspace()
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const boxRef = useRef(null)
  // Default position: pinned to the right edge, vertically centered — window
  // dimensions are known synchronously on the client, so this is correct
  // from the very first render (no null-sentinel/visibility flash needed).
  const [top, setTop] = useState(
    () => (window.innerHeight - TOPBAR_HEIGHT - COLLAPSED_HEIGHT_GUESS) / 2
  )
  const [left, setLeft] = useState(() => window.innerWidth - COLLAPSED_WIDTH - EDGE_MARGIN)
  const [windowSize, setWindowSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [expandedPanel, setExpandedPanel] = useState(null)
  // Once the user has manually dragged the toolbar, its position is theirs
  // to keep (only clamped to stay on-screen). Until then, the default
  // position stays pinned to the right edge — including across window
  // resizes — rather than drifting wherever it happened to land on mount.
  const [userMoved, setUserMoved] = useState(false)
  // Tracks the box's *actual* rendered height (which is content-driven, see
  // the maxHeight/flex-1 setup below) purely so drag/position clamping knows
  // how tall the box currently is — it never feeds back into the box's own
  // size, so there's no feedback loop.
  const [renderedHeight, setRenderedHeight] = useState(COLLAPSED_HEIGHT_GUESS)

  const boxWidth = expandedPanel ? EXPANDED_WIDTH : COLLAPSED_WIDTH
  const boxRadius = expandedPanel ? EXPANDED_RADIUS : COLLAPSED_RADIUS

  useEffect(() => {
    function onResize() {
      const width = window.innerWidth
      const height = window.innerHeight
      setWindowSize({ width, height })
      if (!userMoved) {
        setLeft(width - boxWidth - EDGE_MARGIN)
        setTop((height - TOPBAR_HEIGHT - COLLAPSED_HEIGHT_GUESS) / 2)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [userMoved, boxWidth])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h) setRenderedHeight(h)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // `top`/`left` are CSS offsets inside the layout row *below* the top nav
  // bar, not the raw browser viewport — so the vertical room actually
  // available to this toolbar is the window height minus that bar, not
  // window.innerHeight itself (the row spans the full width, so no
  // horizontal correction is needed). Using the raw window height here
  // previously let expanded panels run past the real bottom edge by ~44px.
  const containerHeight = windowSize.height - TOPBAR_HEIGHT
  const containerWidth = windowSize.width

  const clampedTop = Math.min(
    Math.max(top, EDGE_MARGIN),
    Math.max(EDGE_MARGIN, containerHeight - renderedHeight - EDGE_MARGIN)
  )
  const clampedLeft = Math.min(
    Math.max(left, EDGE_MARGIN),
    Math.max(EDGE_MARGIN, containerWidth - boxWidth - EDGE_MARGIN)
  )

  // The box's own height is never set directly — it grows to fit whatever
  // panel is open (comments list, history, share settings). This max-height
  // is what stops it from pushing past the viewport: it's the room actually
  // left *below the box's current top*, not just "the window is tall
  // enough" — a budget based on total window height alone would still let a
  // box anchored halfway down the screen grow straight through the bottom
  // edge. Each panel's own internal list scrolls (keeping its bottom
  // input/button row pinned) once content exceeds this cap.
  const expandedMaxHeight = containerHeight - clampedTop - EDGE_MARGIN

  // Press-and-move anywhere on the toolbar to reposition it. The drag only
  // arms once the pointer travels past DRAG_THRESHOLD, so a plain press on
  // an icon button still reaches its onClick; after a real drag, the click
  // that follows pointerup is swallowed (see onClickCapture below) so
  // dropping the toolbar doesn't also toggle whatever icon was grabbed.
  function handleDragStart(event) {
    if (event.button !== 0) return
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: clampedLeft,
      startTop: clampedTop,
      dragging: false,
    }

    function onMove(moveEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = moveEvent.clientX - drag.startX
      const dy = moveEvent.clientY - drag.startY
      if (!drag.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        drag.dragging = true
        setUserMoved(true)
        document.body.style.cursor = 'grabbing'
      }
      moveEvent.preventDefault()
      setLeft(drag.startLeft + dx)
      setTop(drag.startTop + dy)
    }
    function onUp() {
      suppressClickRef.current = Boolean(dragRef.current?.dragging)
      dragRef.current = null
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function togglePanel(id) {
    // In Merge Studio, Comment and History open the Inbox / Version History
    // drawers instead of the workspace's own flyout panels.
    if (activeView === 'mergeStudio' && (id === 'comments' || id === 'history')) {
      const drawer = id === 'comments' ? 'inbox' : 'history'
      setMergeDrawer(mergeDrawer === drawer ? null : drawer)
      return
    }
    setExpandedPanel((current) => {
      const next = current === id ? null : id
      // Opening from fully collapsed: if the toolbar is currently anchored
      // low on screen, hop it up first so the panel actually has room to
      // grow into, instead of expanding into a sliver at the bottom edge.
      if (next && !current) {
        setTop((base) => {
          const desired = Math.min(EXPANDED_PREFERRED_HEIGHT, containerHeight - EDGE_MARGIN * 2)
          const maxAllowedTop = containerHeight - desired - EDGE_MARGIN
          return base > maxAllowedTop ? Math.max(EDGE_MARGIN, maxAllowedTop) : base
        })
      }
      return next
    })
  }

  function handleClickCapture(event) {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.stopPropagation()
    event.preventDefault()
  }

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ top: clampedTop, left: clampedLeft }}
    >
      {/* The toolbar container itself grows into the detail panel — no
          detached popover/window. Width and corner radius animate on a CSS
          transition; height is intentionally *not* an animated inline
          number — the box is left at `height: auto` so it hugs whatever
          content is inside (short content = a small box, long content grows
          it, see the maxHeight cap below), which is what keeps a panel's
          composer/button row pinned at its true bottom instead of being
          clipped by a guessed fixed height. */}
      <div
        ref={boxRef}
        style={{
          width: boxWidth,
          maxHeight: expandedPanel ? expandedMaxHeight : undefined,
          borderRadius: boxRadius,
        }}
        className="pointer-events-auto flex flex-col overflow-hidden border bg-card/90 shadow-lg backdrop-blur-md transition-[width,border-radius] duration-300 ease-in-out"
      >
        {expandedPanel ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              onPointerDown={handleDragStart}
              onClickCapture={handleClickCapture}
              title="Drag to reposition"
              className="flex shrink-0 cursor-grab items-center gap-1.5 border-b px-2.5"
              style={{ height: HEADER_HEIGHT }}
            >
              {panelSwitcher.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => togglePanel(id)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    expandedPanel === id && 'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
              <div className="flex-1" />
              <button
                type="button"
                title="Collapse"
                onClick={() => setExpandedPanel(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              key={expandedPanel}
              className="flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-200"
            >
              {expandedPanel === 'comments' && <CommentsPanel />}
              {expandedPanel === 'history' && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3">
                  <div className="mb-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                    <History className="size-3.5 text-primary" />
                    Rollback History
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto pr-1">
                    <RollbackHistoryList />
                  </div>
                </div>
              )}
              {expandedPanel === 'share' && <ShareSettingsContent />}
            </div>
          </div>
        ) : (
          <div
            onPointerDown={handleDragStart}
            onClickCapture={handleClickCapture}
            className="flex cursor-grab flex-col gap-1.5 p-1.5 animate-in fade-in-0 duration-200"
          >
            {panelSwitcher.map(({ id, Icon, label }) => (
              <Tooltip key={id}>
                <TooltipTrigger onClick={() => togglePanel(id)} className={flyoutTriggerClass}>
                  <Icon className="size-4.5" />
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
              </Tooltip>
            ))}

            <Tooltip>
              <TooltipTrigger
                onClick={() => setInspectorOpen((v) => !v)}
                className={cn(flyoutTriggerClass, inspectorOpen && 'bg-primary/10 text-primary')}
              >
                <ScanEye className="size-4.5" />
              </TooltipTrigger>
              <TooltipContent side="left">Inspect</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

export default RightFloatingBar
