import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripHorizontal, History, PanelRight, Sparkles, X } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PANEL } from '@/components/mergestudio/floatingStyles'
import { Button } from '@/components/ui/button'
import ChatConversation from '@/components/chat/ChatConversation'
import { openPanelInSplit, panelById } from '@/components/dockview/DockLayout'
import { useWorkspace } from '@/state/WorkspaceProvider'

const ICON_SIZE = 48
const MODAL_WIDTH = 400
const MODAL_HEIGHT = 560
// 18px so the 48px bubble's center lines up with the bottom row's 44px
// pills on their bottom-5 baseline (20px + 22px = 18px + 24px).
const MARGIN = 18
const ICON_RADIUS = ICON_SIZE / 2
const MODAL_RADIUS = 28

// The floating "Ask Devsign" entry point and its expanded conversation
// window are the *same element* — clicking the icon morphs it (via a CSS
// transition on left/top/width/height/border-radius, all explicit pixel
// values so the browser can smoothly interpolate) into a freely draggable
// window, and the close button reverses the animation back down into the
// icon at its fixed corner. The conversation inside is ChatConversation,
// shared with the AI Chat pane; "Dock as pane" moves it into the workspace
// as a split pane, and while that pane is open the widget steps aside.
function ChatMorphWidget() {
  const { bottomPanel, projectId, dockApi } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [docked, setDocked] = useState(false)
  const [pos, setPos] = useState(null)
  const [windowSize, setWindowSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const navigate = useNavigate()
  const dragRef = useRef(null)

  // Is the AI Chat pane open in the workspace?
  useEffect(() => {
    if (!dockApi) return
    const sync = () => setDocked(!!dockApi.getPanel(panelById.chat.id))
    sync()
    const disposable = dockApi.onDidLayoutChange(sync)
    return () => disposable.dispose()
  }, [dockApi])

  useEffect(() => {
    function onResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const iconLeft = windowSize.width - MARGIN - ICON_SIZE
  // Sits above the workspace's docked bottom panel (expanded or just its
  // 40px tab strip), not on top of it.
  const bottomInset = bottomPanel.open ? bottomPanel.height : 40
  const iconTop = windowSize.height - MARGIN - ICON_SIZE - bottomInset

  function clamp(value, size, max) {
    return Math.min(Math.max(value, MARGIN), Math.max(MARGIN, max - size - MARGIN))
  }

  function openWidget() {
    setPos((prev) => {
      if (prev) return prev
      // First open: land the window so its bottom-right corner lines up
      // with the icon's, so the morph reads as the icon growing in place.
      return {
        left: clamp(iconLeft + ICON_SIZE - MODAL_WIDTH, MODAL_WIDTH, windowSize.width),
        top: clamp(iconTop + ICON_SIZE - MODAL_HEIGHT, MODAL_HEIGHT, windowSize.height),
      }
    })
    setOpen(true)
  }

  function closeWidget() {
    setOpen(false)
  }

  function handleDragStart(event) {
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: pos?.left ?? iconLeft,
      startTop: pos?.top ?? iconTop,
    }
    function onMove(moveEvent) {
      const { startX, startY, startLeft, startTop } = dragRef.current
      setPos({
        left: clamp(startLeft + (moveEvent.clientX - startX), MODAL_WIDTH, windowSize.width),
        top: clamp(startTop + (moveEvent.clientY - startY), MODAL_HEIGHT, windowSize.height),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function dockAsPane() {
    setOpen(false)
    openPanelInSplit(dockApi, panelById.chat)
  }

  const rect = open
    ? {
        left: pos?.left ?? iconLeft,
        top: pos?.top ?? iconTop,
        width: MODAL_WIDTH,
        height: MODAL_HEIGHT,
        radius: MODAL_RADIUS,
      }
    : { left: iconLeft, top: iconTop, width: ICON_SIZE, height: ICON_SIZE, radius: ICON_RADIUS }

  if (docked) return null

  return (
    <>
      <div
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
        }}
        className={cn(
          'fixed z-30 flex flex-col overflow-hidden transition-[left,top,width,height,border-radius] duration-300 ease-in-out',
          // Open, it's a Merge Studio panel (FLOATING_PANEL); collapsed,
          // the primary-filled launcher bubble.
          open ? FLOATING_PANEL : 'bg-primary text-primary-foreground shadow-xl shadow-primary/30'
        )}
      >
        {open ? (
          <>
            <div
              onPointerDown={handleDragStart}
              title="Drag to reposition"
              className="flex shrink-0 cursor-grab items-center gap-1.5 px-3 py-2 active:cursor-grabbing"
            >
              <GripHorizontal className="size-3.5 text-muted-foreground/50" />
              <Sparkles className="size-4 text-primary" />
              <span className="flex-1 text-sm font-semibold">Ask Devsign</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Agent checkpoints (History)"
                // The agent's checkpoints are in the project's History menu.
                onClick={() => navigate(`/projects/${projectId}/history`)}
              >
                <History className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" title="Dock as pane" aria-label="Dock as pane" onClick={dockAsPane}>
                <PanelRight className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" title="Close" onClick={closeWidget}>
                <X className="size-3.5" />
              </Button>
            </div>

            <ChatConversation />
          </>
        ) : (
          <button
            type="button"
            onClick={openWidget}
            className="flex size-full items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <Sparkles className="size-5 animate-pulse" />
          </button>
        )}
      </div>
    </>
  )
}

export default ChatMorphWidget
