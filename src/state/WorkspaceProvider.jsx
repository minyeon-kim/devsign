import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  aiEditScenarios,
  canvasPages,
  comments as seedComments,
  conflictPoints as seedConflicts,
  consoleLogLines as seedConsoleLogLines,
  currentUser,
  findCanvasTarget,
  initialChatMessages,
  initialHistoryEntries,
  mergeListItems as seedMergeListItems,
  seedMergeNotifications,
  liveMergeNotification,
  openFiles,
  teamMembers,
  terminalLogLines as seedTerminalLogLines,
} from '@/data/mockData'

// How often each teammate's mock viewport advances to the next entry in
// their `viewportSequence` — simulates them navigating the file on their
// own, independent of whether anyone is following them.
const REMOTE_VIEWPORT_INTERVAL = 6000

const WorkspaceContext = createContext(null)

let uid = 0
function nextId(prefix) {
  uid += 1
  return `${prefix}-${uid}`
}

const DEFAULT_PREVIEW_PROPS = {
  buttonPadding: '8px 16px',
  buttonColor: 'primary',
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function WorkspaceProvider({ children }) {
  const [activeFileId, setActiveFileIdState] = useState(openFiles[0]?.id ?? null)
  const [fileOverrides, setFileOverrides] = useState({})
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [terminalEntries, setTerminalEntries] = useState(() =>
    seedTerminalLogLines.map((text) => ({ id: nextId('t'), text }))
  )
  const [consoleEntries] = useState(() =>
    seedConsoleLogLines.map((text) => ({ id: nextId('c'), text }))
  )
  const [conflicts, setConflicts] = useState(seedConflicts)
  const [chatMessages, setChatMessages] = useState(initialChatMessages)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [previewProps, setPreviewProps] = useState(DEFAULT_PREVIEW_PROPS)
  const [comments, setComments] = useState(seedComments)
  const [historyEntries, setHistoryEntries] = useState(initialHistoryEntries)
  const [activeHistoryId, setActiveHistoryId] = useState(
    initialHistoryEntries[initialHistoryEntries.length - 1]?.id ?? null
  )
  const [inspectorOpen, setInspectorOpen] = useState(false)
  // Which design "page"/file the Canvas file-tab bar has open — shared here
  // (not local to CanvasPanel) so the Layers panel's frame tree stays in
  // sync with whichever page is active.
  const [activePageId, setActivePageId] = useState(canvasPages[0]?.id ?? null)
  // The dockview API, handed up once DockLayout's onReady fires — stored
  // here (rather than only as App-local state) so any panel deep in the
  // tree (Canvas, Editor) can open/focus dockview panels itself, e.g. to
  // open a layer's inspection tab, without prop-drilling dockApi through
  // every intermediate component.
  const [dockApi, setDockApi] = useState(null)
  // Active Canvas toolbar tool (move/hand/frame/text/shape/comment) — kept
  // here rather than local to CanvasPanel so the global cursor overlay can
  // read it and swap its glyph while hovering the canvas surface.
  const [canvasTool, setCanvasTool] = useState('move')

  // --- View routing (workspace vs. Merge Studio) ----------------------
  // Switches the whole app body below TopBar, rather than living inside
  // dockview — Merge Studio's "Merge List" sidebar + workspace is its own
  // screen, not another dockable panel.
  const [activeView, setActiveView] = useState('workspace')
  const [mergeItems, setMergeItems] = useState(seedMergeListItems)
  const [selectedMergeItemId, setSelectedMergeItemId] = useState(null)
  // Merge Studio collaboration: which right-hand drawer is open, the inbox,
  // and a "pan the canvas to this" request (consumed by MergeStudioWorkspace).
  const [mergeDrawer, setMergeDrawer] = useState(null) // null | 'inbox' | 'history'
  const [notifications, setNotifications] = useState(seedMergeNotifications)
  const [mergeFocus, setMergeFocus] = useState(null)

  // --- Follow Me -----------------------------------------------------
  // `followingMe`: I'm broadcasting my view for others to follow.
  // `followedMemberId`: I'm watching a teammate's view — their mock
  // viewport (see `remoteViewportIndex`) is mirrored onto my own
  // activeFileId/selectedLayerId below.
  const [followingMe, setFollowingMe] = useState(false)
  const [followedMemberId, setFollowedMemberId] = useState(null)
  const [remoteViewportIndex, setRemoteViewportIndex] = useState(() =>
    Object.fromEntries(teamMembers.map((m) => [m.id, 0]))
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemoteViewportIndex((prev) => {
        const next = { ...prev }
        teamMembers.forEach((member) => {
          if (member.viewportSequence?.length > 1) {
            next[member.id] = (prev[member.id] + 1) % member.viewportSequence.length
          }
        })
        return next
      })
    }, REMOTE_VIEWPORT_INTERVAL)
    return () => window.clearInterval(interval)
  }, [])

  // Each teammate's mock "current viewport" — same rotating entry that
  // drives Follow Me — is what file-scoped multiplayer cursors are checked
  // against: a teammate's cursor only ever renders inside the Editor tab or
  // Canvas page it says they're looking at, never floating across an
  // unrelated file/page. `layerId` doubles as "which canvas layer" — its
  // page is looked up live via `findCanvasTarget` rather than storing a
  // separate pageId, since layer ids are already unique across pages.
  // A live notification lands shortly after entering Merge Studio.
  useEffect(() => {
    if (activeView !== 'mergeStudio') return
    const timer = setTimeout(() => {
      setNotifications((prev) => (prev.some((n) => n.id === liveMergeNotification.id) ? prev : [liveMergeNotification, ...prev]))
    }, 9000)
    return () => clearTimeout(timer)
  }, [activeView])

  const memberViewports = useMemo(
    () =>
      teamMembers.map((member) => ({
        member,
        viewport: member.viewportSequence?.[remoteViewportIndex[member.id] ?? 0] ?? null,
      })),
    [remoteViewportIndex]
  )

  const getViewersForFile = useCallback(
    (fileId) =>
      memberViewports
        .filter(({ viewport }) => viewport?.fileId === fileId)
        .map(({ member }) => member),
    [memberViewports]
  )

  const getViewersForCanvasPage = useCallback(
    (pageId) =>
      memberViewports
        .filter(({ viewport }) => {
          if (!viewport?.layerId) return false
          return findCanvasTarget(viewport.layerId)?.page.id === pageId
        })
        .map(({ member }) => member),
    [memberViewports]
  )

  const openMergeStudio = useCallback(() => {
    setActiveView('mergeStudio')
  }, [])

  const exitMergeStudio = useCallback(() => {
    setActiveView('workspace')
  }, [])

  const updateMergeItem = useCallback((id, patch) => {
    setMergeItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const requestMergeFocus = useCallback((target) => {
    setSelectedMergeItemId(target.itemId)
    setMergeFocus({ target, nonce: Date.now() })
  }, [])

  const markNotificationRead = useCallback((id, unread = false) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread } : n)))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }, [])

  const replyToNotification = useCallback(
    (id, text) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, replies: [...(n.replies ?? []), { id: `r-${Date.now()}`, authorId: currentUser.id, text }] }
            : n
        )
      )
    },
    []
  )

  // Finalizes a merge item: marks it Merged and clears its conflict level.
  const completeMerge = useCallback((id) => {
    setMergeItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, tag: 'Merged', conflictLevel: 'None', updatedLabel: 'Just now' } : item
      )
    )
  }, [])

  // "Start New with Current Work" — snapshots whatever's open in the editor
  // right now into a fresh Merge List entry, selects it, and enters Merge
  // Studio already looking at it.
  const startMergeFromOpenFiles = useCallback(() => {
    const id = nextId('merge')
    const fileNames = openFiles.map((f) => f.name)
    setMergeItems((prev) => [
      {
        id,
        title: 'New Merge — Current Work',
        subtitle: `${fileNames.length} file${fileNames.length === 1 ? '' : 's'} · ${fileNames.join(', ')}`,
        tag: 'Draft',
        updatedLabel: 'Just now',
        fileIds: openFiles.map((f) => f.id),
        hasDesign: true,
        designPageId: activePageId,
        category: 'Workspace',
        conflictLevel: 'None',
        dueLabel: 'No due date',
        dueBucket: 'none',
        assigneeId: currentUser.id,
      },
      ...prev,
    ])
    setSelectedMergeItemId(id)
    setActiveView('mergeStudio')
  }, [activePageId])

  const appendTerminalLines = useCallback((lines, stagger = 140) => {
    lines.forEach((text, i) => {
      window.setTimeout(() => {
        setTerminalEntries((prev) => [...prev, { id: nextId('t'), text }])
      }, i * stagger)
    })
  }, [])

  const addConflict = useCallback((conflict) => {
    setConflicts((prev) => (prev.some((c) => c.id === conflict.id) ? prev : [...prev, conflict]))
  }, [])

  const resolveConflict = useCallback(
    (conflictId) => {
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId))
      appendTerminalLines(['$ devsign resolve-conflict', '✓ conflict marked resolved'])
    },
    [appendTerminalLines]
  )

  const setActiveFileId = useCallback((fileId) => {
    setActiveFileIdState(fileId)
  }, [])

  const selectCanvasLayer = useCallback(
    (layerId, { conflict } = {}) => {
      setSelectedLayerId(layerId)
      if (!layerId) return
      setActiveFileIdState(openFiles[0].id)
      appendTerminalLines([`[HMR] DesignCanvas.jsx updated (layer: ${layerId})`])
      setPreviewVersion((v) => v + 1)
      if (conflict) addConflict(conflict)
    },
    [appendTerminalLines, addConflict]
  )

  const startFollowMe = useCallback(() => {
    setFollowedMemberId(null)
    setFollowingMe(true)
  }, [])

  const cancelFollowMe = useCallback(() => {
    setFollowingMe(false)
  }, [])

  const followMember = useCallback((memberId) => {
    setFollowingMe(false)
    setFollowedMemberId((current) => (current === memberId ? null : memberId))
  }, [])

  const stopFollowingMember = useCallback(() => {
    setFollowedMemberId(null)
  }, [])

  // Mirror the followed teammate's mock viewport onto my own workspace
  // whenever it changes — this is the "follow" in Follow Me. (The
  // FollowMeBanner already surfaces "Following X — label" persistently at
  // the top of the screen, so this doesn't also need a transient toast.)
  useEffect(() => {
    if (!followedMemberId) return
    const member = teamMembers.find((m) => m.id === followedMemberId)
    const sequence = member?.viewportSequence
    if (!sequence?.length) return

    const index = remoteViewportIndex[followedMemberId] ?? 0
    const target = sequence[index]

    setActiveFileIdState(target.fileId)
    setSelectedLayerId(target.layerId ?? null)
  }, [followedMemberId, remoteViewportIndex])

  const recordHistory = useCallback((entry) => {
    const id = nextId('h')
    setHistoryEntries((prev) => [...prev, { id, ...entry }])
    setActiveHistoryId(id)
    return id
  }, [])

  const rollbackTo = useCallback(
    (entryId) => {
      const entry = historyEntries.find((h) => h.id === entryId)
      if (!entry) return
      const { snapshot } = entry

      setFileOverrides((prev) => ({ ...prev, [snapshot.fileId]: snapshot.lines }))
      setActiveFileIdState(snapshot.activeFileId)
      setPreviewProps(snapshot.previewProps)
      setPreviewVersion((v) => v + 1)
      setConflicts(snapshot.conflicts)
      setSelectedLayerId(snapshot.selectedLayerId ?? null)
      setActiveHistoryId(entryId)

      appendTerminalLines([
        `$ devsign rollback --to "${entry.label}"`,
        '[HMR] workspace restored',
        '✓ rollback complete',
      ])
    },
    [historyEntries, appendTerminalLines]
  )

  const sendChatMessage = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setChatMessages((prev) => [...prev, { id: nextId('m'), role: 'user', text: trimmed }])
      setIsAiTyping(true)

      const lower = trimmed.toLowerCase()
      const scenario =
        aiEditScenarios.find((s) => s.keywords.some((k) => lower.includes(k))) ??
        aiEditScenarios.find((s) => s.id === 'default')

      window.setTimeout(() => {
        setIsAiTyping(false)
        setChatMessages((prev) => [
          ...prev,
          { id: nextId('m'), role: 'assistant', text: scenario.reply },
        ])

        const nextFileOverrides = { ...fileOverrides, [scenario.fileId]: scenario.lines }
        const nextPreviewProps = { ...previewProps, ...(scenario.previewProps ?? {}) }
        const nextConflicts = scenario.resolvesConflictId
          ? conflicts.filter((c) => c.id !== scenario.resolvesConflictId)
          : conflicts

        setFileOverrides(nextFileOverrides)
        setActiveFileIdState(scenario.fileId)
        setPreviewProps(nextPreviewProps)
        setPreviewVersion((v) => v + 1)
        setConflicts(nextConflicts)
        appendTerminalLines(scenario.terminalLines)

        recordHistory({
          label: scenario.reply,
          prompt: trimmed,
          timestamp: timeLabel(),
          snapshot: {
            activeFileId: scenario.fileId,
            fileId: scenario.fileId,
            lines: scenario.lines,
            previewProps: nextPreviewProps,
            conflicts: nextConflicts,
            selectedLayerId,
          },
        })
      }, 900)
    },
    [appendTerminalLines, conflicts, fileOverrides, previewProps, recordHistory, selectedLayerId]
  )

  const getFileLines = useCallback(
    (fileId) => {
      const file = openFiles.find((f) => f.id === fileId)
      return fileOverrides[fileId] ?? file?.lines ?? []
    },
    [fileOverrides]
  )

  const setCommentStatus = useCallback((commentId, status) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, status } : c)))
  }, [])

  const toggleCommentLike = useCallback((commentId) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) }
          : c
      )
    )
  }, [])

  // `target` is optional and identifies a *pinned* comment's anchor —
  // `{ type: 'canvas', pageId, x, y }` or `{ type: 'editor', fileId, line }`.
  // Plain comments (from the Comments panel composer) omit it entirely and
  // just show up in the flat comment list as before.
  const addComment = useCallback((text, target) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setComments((prev) => [
      ...prev,
      {
        id: nextId('comment'),
        authorId: currentUser.id,
        timeLabel: 'Just now',
        text: trimmed,
        status: 'open',
        likes: 0,
        replies: 0,
        ...(target ? { target } : {}),
      },
    ])
  }, [])

  const value = {
    activeFileId,
    setActiveFileId,
    getFileLines,
    selectedLayerId,
    selectCanvasLayer,
    terminalEntries,
    consoleEntries,
    conflicts,
    resolveConflict,
    chatMessages,
    isAiTyping,
    sendChatMessage,
    previewVersion,
    previewProps,
    comments,
    setCommentStatus,
    toggleCommentLike,
    addComment,
    historyEntries,
    activeHistoryId,
    rollbackTo,
    inspectorOpen,
    setInspectorOpen,
    activePageId,
    setActivePageId,
    dockApi,
    setDockApi,
    canvasTool,
    setCanvasTool,
    getViewersForFile,
    getViewersForCanvasPage,
    activeView,
    mergeItems,
    selectedMergeItemId,
    setSelectedMergeItemId,
    openMergeStudio,
    exitMergeStudio,
    startMergeFromOpenFiles,
    completeMerge,
    updateMergeItem,
    mergeDrawer,
    setMergeDrawer,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    replyToNotification,
    mergeFocus,
    requestMergeFocus,
    followingMe,
    followedMemberId,
    remoteViewportIndex,
    startFollowMe,
    cancelFollowMe,
    followMember,
    stopFollowingMember,
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return ctx
}
