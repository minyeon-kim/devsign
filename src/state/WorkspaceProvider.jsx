import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  aiEditScenarios,
  canvasPages,
  comments as seedComments,
  conflictPoints as seedConflicts,
  consoleLogLines as seedConsoleLogLines,
  currentUser,
  initialChatMessages,
  initialHistoryEntries,
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
