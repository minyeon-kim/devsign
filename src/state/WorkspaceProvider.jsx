import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  aiEditScenarios,
  canvasPages,
  conflictChecklist,
  conflictNotifications,
  designSystemUpdates,
  referenceDocs as staticReferenceDocs,
  comments as seedComments,
  consoleLogLines as seedConsoleLogLines,
  currentUser,
  findCanvasTarget,
  forProject,
  initialChatMessages,
  initialHistoryEntries,
  projectHistorySeeds,
  projectViewportSequences,
  mergeListItems as seedMergeListItems,
  registerMergeVariants,
  seedMergeNotifications,
  liveMergeNotification,
  openFiles,
  projectFileSets,
  teamMembers,
  terminalLogLines as seedTerminalLogLines,
} from '@/data/mockData'
import { allReviewersApproved, toConflictRecord } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'
import { docForUpdate, docIdFor, updateFromConflict } from '@/lib/designSystemUpdates'
import { importKind } from '@/lib/importFiles'
import {
  PROTOTYPE_FILES,
  lineForLayer,
  parsePrototype,
  prototypeFile,
  prototypeFileForPage,
  prototypeLines,
} from '@/lib/prototypeSync'

// How often each teammate's mock viewport advances to the next entry in
// their `viewportSequence` — simulates them navigating the file on their
// own, independent of whether anyone is following them.
// How long a teammate stays on one file/layer before moving on — long
// enough that their cursor settles instead of hopping between files.
const REMOTE_VIEWPORT_INTERVAL = 20000

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

// This project's design system updates, with the title of the Conflict
// Point each one came from (for its generated doc).
function seedDsUpdates(projectId) {
  return designSystemUpdates
    .filter((u) => u.projectId === projectId)
    .map((u) => ({ ...u, conflictTitle: conflictChecklist.find((c) => c.id === u.conflictId)?.token }))
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function WorkspaceProvider({ children, projectId }) {
  // Every project's file set shares the same file *ids* as the default
  // (`openFiles`) — see the comment on `projectFileSets` in mockData.js —
  // so this only needs to swap which file objects those ids resolve to,
  // nothing else in this provider needs to change per project.
  const baseFiles = projectFileSets[projectId] ?? openFiles
  // Code files brought in with Import (see importFiles) join the file tree
  // and editor like any other file; design files (Figma, Illustrator,
  // images) land in `importedAssets` instead.
  const [importedFiles, setImportedFiles] = useState([])
  const [importedAssets, setImportedAssets] = useState([])
  // The canvas pages' code files (src/prototype/*.jsx) are part of every
  // project's tree: generated from — and parsed back into — the canvas
  // (see lib/prototypeSync), so design and code stay in sync both ways.
  // This project's design pages (its own, or the shared ones — see
  // forProject) and, with them, which page code files it has.
  const projectPages = useMemo(() => forProject(canvasPages, projectId), [projectId])
  const projectPrototypeFiles = useMemo(
    () => PROTOTYPE_FILES.filter((f) => projectPages.some((p) => p.id === f.pageId)),
    [projectPages]
  )
  const files = useMemo(
    () => [...baseFiles, ...projectPrototypeFiles, ...importedFiles],
    [baseFiles, projectPrototypeFiles, importedFiles]
  )
  const [prototypeEdits, setPrototypeEdits] = useState({})
  // A line the editor should briefly highlight and scroll to — the code a
  // canvas edit or selection just touched: { fileId, line, nonce }.
  const [codeFlash, setCodeFlash] = useState(null)
  // Generated once per edit (not per call), so a prototype file's lines
  // keep a stable identity for consumers that react to them changing.
  const generatedPrototypeLines = useMemo(
    () => Object.fromEntries(PROTOTYPE_FILES.map((f) => [f.id, prototypeLines(f.id, prototypeEdits)])),
    [prototypeEdits]
  )
  const [activeFileId, setActiveFileIdState] = useState(files[0]?.id ?? null)
  // The code editor's open tabs (the file tree lists every file; the
  // editor header only the ones you've opened). Whatever becomes the active
  // file — from the tree, the canvas, an AI edit, a rollback — joins them.
  const [openFileIds, setOpenFileIds] = useState(() => files.slice(0, 2).map((f) => f.id))
  if (activeFileId && !openFileIds.includes(activeFileId)) setOpenFileIds([...openFileIds, activeFileId])
  const [fileOverrides, setFileOverrides] = useState({})
  const [fileNameOverrides, setFileNameOverrides] = useState({})
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [terminalEntries, setTerminalEntries] = useState(() =>
    seedTerminalLogLines.map((text) => ({ id: nextId('t'), text }))
  )
  const [consoleEntries] = useState(() =>
    seedConsoleLogLines.map((text) => ({ id: nextId('c'), text }))
  )
  // This project's conflicts — its slice of the app-level ConflictStore
  // (so the Dashboard sees every review / merge made here). `setConflicts`
  // takes a value or an updater over this project's list only.
  const conflictStore = useConflictStore()
  const { setProjectConflicts, logEvent } = conflictStore
  const conflicts = useMemo(
    () => conflictStore.conflicts.filter((c) => c.projectId === projectId),
    [conflictStore.conflicts, projectId]
  )
  const setConflicts = useCallback((updater) => setProjectConflicts(projectId, updater), [setProjectConflicts, projectId])
  // The conflict open in the review window (ConflictReviewHost). One per
  // workspace, so opening a conflict from the drawer or the terminal
  // always reuses the same window instead of stacking a second one.
  const [reviewConflictId, setReviewConflictId] = useState(null)
  // Design System Update → Documentation → History (see
  // lib/designSystemUpdates): the updates, and the Reference Docs the
  // documented ones generated (shown in the Archive beside the static docs).
  const [dsUpdates, setDsUpdates] = useState(() => seedDsUpdates(projectId))
  const [generatedDocs, setGeneratedDocs] = useState(() =>
    seedDsUpdates(projectId)
      .filter((u) => u.stage !== 'update')
      .map(docForUpdate)
  )
  // The docked bottom panel (Terminal / Console / Conflict Points): which
  // tab is showing, whether it's expanded or collapsed to its tab strip,
  // and its expanded height (dragged from its top edge).
  const [bottomPanel, setBottomPanelState] = useState({ tab: 'terminal', open: true, height: 240 })
  const setBottomPanel = useCallback((patch) => setBottomPanelState((prev) => ({ ...prev, ...patch })), [])
  // The navigator pane (Files / Layers / Assets — NavigatorPanel): open or
  // not, and which tab it shows. Open from the start, at the left: the
  // file tree is where files are opened.
  const [filesWindow, setFilesWindowState] = useState({ open: true, tab: 'files' })
  const setFilesWindow = useCallback((patch) => setFilesWindowState((prev) => ({ ...prev, ...patch })), [])
  // Assemble edits made from the navigator's Assets view (Block Deck's
  // Assemble, outside Merge Studio): { [layerId]: assembly }. Kept here so
  // they survive switching navigator tabs; `null` resets a layer.
  const [assetAssemblies, setAssetAssemblies] = useState({})
  const assembleAsset = useCallback(
    (layerId, patch) =>
      setAssetAssemblies((prev) => {
        const next = { ...prev }
        if (patch) next[layerId] = { ...prev[layerId], ...patch }
        else delete next[layerId]
        return next
      }),
    []
  )
  const [chatMessages, setChatMessages] = useState(initialChatMessages)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [previewProps, setPreviewProps] = useState(DEFAULT_PREVIEW_PROPS)
  const [comments, setComments] = useState(seedComments)
  const historySeed = projectHistorySeeds[projectId] ?? initialHistoryEntries
  const [historyEntries, setHistoryEntries] = useState(historySeed)
  const [activeHistoryId, setActiveHistoryId] = useState(historySeed[historySeed.length - 1]?.id ?? null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  // Which design "page"/file the Canvas file-tab bar has open — shared here
  // (not local to CanvasPanel) so the Layers panel's frame tree stays in
  // sync with whichever page is active.
  const [activePageId, setActivePageId] = useState(() => forProject(canvasPages, projectId)[0]?.id ?? null)
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
  const [mergeItems, setMergeItems] = useState(() => forProject(seedMergeListItems, projectId))
  const [selectedMergeItemId, setSelectedMergeItemId] = useState(null)
  // Merge Studio collaboration: which right-hand drawer is open, the inbox,
  // and a "pan the canvas to this" request (consumed by MergeStudioWorkspace).
  const [mergeDrawer, setMergeDrawer] = useState(null) // null | 'inbox' | 'history'
  // Merge Studio's feed plus this project's Conflict Points items.
  const [notifications, setNotifications] = useState(() => [
    ...conflictNotifications.filter((n) => n.projectId === projectId),
    ...seedMergeNotifications,
  ])
  // The AI chat's unsent draft and an explicitly picked request target,
  // kept here (not in the chat pane) so collapsing the pane or switching
  // tabs never loses them (see ChatConversation).
  const [chatDraft, setChatDraft] = useState('')
  const [chatTargetOverride, setChatTargetOverride] = useState(null)
  const [mergeFocus, setMergeFocus] = useState(null)
  // Merge Studio's unmerged per-item edits ({ [itemId]: draft }), kept
  // across item switches and trips out of Merge Studio (see
  // MergeStudioWorkspace). A ref: saving a draft never needs a re-render.
  const mergeDrafts = useRef({})
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false)
  // The header's "Merge Changes" CTA: registered by the Merge Studio
  // workspace ({ merged, count, open }) so the top bar can render it.
  const [mergeCta, setMergeCta] = useState(null)
  // Left Merge List sidebar collapse, toggled from the ActivityBar.
  const [mergeListCollapsed, setMergeListCollapsed] = useState(false)

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

  // Each teammate's simulated timeline for this project (its own when the
  // project has one, else their default).
  const sequenceFor = useCallback(
    (member) => projectViewportSequences[projectId]?.[member.id] ?? member.viewportSequence ?? [],
    [projectId]
  )
  const memberViewports = useMemo(
    () =>
      teamMembers.map((member) => {
        const sequence = sequenceFor(member)
        return { member, viewport: sequence[(remoteViewportIndex[member.id] ?? 0) % Math.max(1, sequence.length)] ?? null }
      }),
    [remoteViewportIndex, sequenceFor]
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
    // A monotonic counter, not Date.now() — two focus requests inside the
    // same millisecond (e.g. rapid drift-nav clicks) would otherwise get an
    // identical nonce, so the second one's "already handled" guard in
    // MergeStudioWorkspace would silently swallow it.
    setMergeFocus({ target, nonce: nextId('focus') })
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
    registerMergeVariants(id, activePageId)
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
    setConflicts((prev) =>
      prev.some((c) => c.id === conflict.id) ? prev : [...prev, toConflictRecord({ projectId, ...conflict })]
    )
  }, [projectId, setConflicts])

  // Review-workflow edits from the conflict modal (stage, reviewers,
  // diff inspected) — everything short of the final resolve.
  const updateConflict = useCallback((conflictId, patch) => {
    setConflicts((prev) => prev.map((c) => (c.id === conflictId ? { ...c, ...patch } : c)))
  }, [setConflicts])

  const setActiveFileId = useCallback((fileId) => {
    setActiveFileIdState(fileId)
  }, [])

  // Close an editor tab; closing the active one moves to its neighbor. The
  // last tab stays (the editor always shows a file).
  const closeFileTab = useCallback(
    (fileId) => {
      if (openFileIds.length < 2 || !openFileIds.includes(fileId)) return
      const i = openFileIds.indexOf(fileId)
      const next = openFileIds.filter((id) => id !== fileId)
      setOpenFileIds(next)
      if (fileId === activeFileId) setActiveFileIdState(next[Math.min(i, next.length - 1)])
    },
    [openFileIds, activeFileId]
  )

  const selectCanvasLayer = useCallback(
    (layerId, { conflict } = {}) => {
      setSelectedLayerId(layerId)
      if (!layerId) return
      // Selecting on the canvas opens the page's code file at that layer's
      // line — the other half of the design ↔ code link.
      const proto = prototypeFileForPage(findCanvasTarget(layerId)?.page.id)
      const file = proto ?? files[0]
      setActiveFileIdState(file.id)
      const line = proto && lineForLayer(proto.id, layerId, prototypeEdits)
      if (line) setCodeFlash({ fileId: proto.id, line, nonce: nextId('flash') })
      appendTerminalLines([`[HMR] ${file.name} updated (layer: ${layerId})`])
      setPreviewVersion((v) => v + 1)
      if (conflict) addConflict(conflict)
    },
    [appendTerminalLines, addConflict, files, prototypeEdits]
  )

  // Puts a change in view — a Conflict Point's, or an AI result's
  // ({ layerId?, fileId?, line? }): its element selected on its page, and
  // its file open at the changed line. Only links it has are followed.
  const focusChange = useCallback((conflict) => {
    if (!conflict) return
    if (conflict.layerId) {
      const target = findCanvasTarget(conflict.layerId)
      if (target) {
        setActivePageId(target.page.id)
        setSelectedLayerId(conflict.layerId)
      }
    }
    if (conflict.fileId) {
      setActiveFileIdState(conflict.fileId)
      if (conflict.line) setCodeFlash({ fileId: conflict.fileId, line: conflict.line, nonce: nextId('flash') })
    }
  }, [])

  // Canvas → code: an edit made on the canvas (text, fill, radius) updates
  // the model, which regenerates the page's file; the editor jumps to and
  // flashes the line that changed.
  const editPrototypeLayer = useCallback(
    (layerId, patch) => {
      const proto = prototypeFileForPage(findCanvasTarget(layerId)?.page.id)
      if (!proto) return
      setPrototypeEdits((prev) => {
        const current = prev[layerId] ?? {}
        return {
          ...prev,
          [layerId]: { ...current, ...patch, copy: { ...current.copy, ...patch.copy } },
        }
      })
      setActiveFileIdState(proto.id)
      const line = lineForLayer(proto.id, layerId, prototypeEdits)
      if (line) setCodeFlash({ fileId: proto.id, line, nonce: nextId('flash') })
      setPreviewVersion((v) => v + 1)
    },
    [prototypeEdits]
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
    const sequence = member && sequenceFor(member)
    if (!sequence?.length) return

    const index = (remoteViewportIndex[followedMemberId] ?? 0) % sequence.length
    const target = sequence[index]

    setActiveFileIdState(target.fileId)
    setSelectedLayerId(target.layerId ?? null)
  }, [followedMemberId, remoteViewportIndex, sequenceFor])

  // How long the agent conversation is right now — stored on each new
  // checkpoint so a rollback can also rewind the agent's memory to it.
  const chatLengthRef = useRef(initialChatMessages.length)
  useEffect(() => {
    chatLengthRef.current = chatMessages.length
  }, [chatMessages])

  const recordHistory = useCallback((entry) => {
    const id = nextId('h')
    const snapshot = { chatLength: chatLengthRef.current, ...entry.snapshot }
    setHistoryEntries((prev) => [...prev, { archived: false, id, ...entry, snapshot }])
    setActiveHistoryId(id)
    return id
  }, [])

  // The current workspace as a History snapshot (what rollback restores).
  const currentSnapshot = useCallback(
    () => ({
      activeFileId,
      fileId: activeFileId,
      lines: fileOverrides[activeFileId] ?? files.find((f) => f.id === activeFileId)?.lines ?? [],
      previewProps,
      conflicts,
      selectedLayerId,
    }),
    [activeFileId, fileOverrides, files, previewProps, conflicts, selectedLayerId]
  )

  // Merging — the review workflow's final step (the existing policy: only
  // an Approved conflict whose every required reviewer signed off can be
  // merged). Merging is when its fix (if Devsign has one for it) is finally
  // applied to the workspace — never on approval — and it's recorded as a
  // History checkpoint titled by the change, with who approved and merged.
  // Merged conflicts stay in the list (as Merged) for the audit trail.
  // Returns whether it merged.
  const resolveConflict = useCallback(
    (conflictId) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'approved' || !allReviewersApproved(conflict)) {
        toast("Can't merge yet", { description: 'Every required reviewer has to approve first.' })
        return false
      }
      const fix = aiEditScenarios.find((sc) => sc.resolvesConflictId === conflictId && (!sc.projectId || sc.projectId === projectId))
      const nextConflicts = conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, reviewStage: 'resolved', resolvedAtLabel: 'Just now', mergedBy: currentUser.id }
          : c
      )
      const nextPreviewProps = fix ? { ...previewProps, ...(fix.previewProps ?? {}) } : previewProps
      setConflicts(nextConflicts)
      if (fix) {
        setFileOverrides((prev) => ({ ...prev, [fix.fileId]: fix.lines }))
        setActiveFileIdState(fix.fileId)
        setPreviewProps(nextPreviewProps)
        setPreviewVersion((v) => v + 1)
      }
      const base = currentSnapshot()
      const approvedBy = conflict.reviewers.filter((r) => r.status === 'approved').map((r) => r.id)
      recordHistory({
        label: conflict.mergeTitle ?? `Merged ${conflict.title}`,
        kind: 'merge',
        actorId: currentUser.id,
        target: conflict.file,
        approvedBy,
        timestamp: timeLabel(),
        conflictId,
        snapshot: {
          ...base,
          ...(fix && { activeFileId: fix.fileId, fileId: fix.fileId, lines: fix.lines }),
          previewProps: nextPreviewProps,
          conflicts: nextConflicts,
        },
      })
      logEvent({ kind: 'merge', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
      appendTerminalLines([
        `$ devsign merge "${conflict.title}"`,
        ...(fix ? ['[HMR] approved change applied'] : []),
        '✓ merged · checkpoint saved to History',
      ])
      // A merged conflict is a design system change: it enters the
      // Design System Update → Documentation → History pipeline.
      const update = updateFromConflict(conflict, projectId)
      setDsUpdates((prev) => (prev.some((u) => u.id === update.id) ? prev : [update, ...prev]))
      return true
    },
    [appendTerminalLines, conflicts, currentSnapshot, logEvent, previewProps, projectId, recordHistory, setConflicts]
  )

  // Your own sign-off on a conflict in review (approving never changes
  // code). You approve as yourself only; it moves to Approved when every
  // required reviewer has approved — the same rule batch approval uses.
  const approveConflict = useCallback(
    (conflictId) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'in_review') return null
      if (!conflict.reviewers.some((r) => r.id === currentUser.id)) return null
      const reviewers = conflict.reviewers.map((r) => (r.id === currentUser.id ? { ...r, status: 'approved' } : r))
      const updated = { ...conflict, reviewers, diffInspected: true }
      const next = { ...updated, reviewStage: allReviewersApproved(updated) ? 'approved' : 'in_review' }
      setConflicts((prev) => prev.map((c) => (c.id === conflictId ? next : c)))
      logEvent({ kind: 'approve', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
      appendTerminalLines([`$ devsign review approve "${conflict.title}" --as ${currentUser.id}`])
      return next
    },
    [appendTerminalLines, conflicts, logEvent, projectId, setConflicts]
  )

  const requestChanges = useCallback(
    (conflictId) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'in_review') return
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId
            ? { ...c, reviewers: c.reviewers.map((r) => (r.id === currentUser.id ? { ...r, status: 'changes_requested' } : r)) }
            : c
        )
      )
      logEvent({ kind: 'changes', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    },
    [conflicts, logEvent, projectId, setConflicts]
  )

  // Batch approval (the Conflict Points list): your sign-off on several
  // low-risk, open conflicts at once — you only ever approve as yourself
  // (added as a reviewer where you weren't one). A conflict whose every
  // reviewer has now approved moves to Approved; the rest wait In Review on
  // their other reviewers. Resolving stays a separate, per-conflict step.
  // Returns { approved, waiting } counts.
  const batchApproveConflicts = useCallback(
    (conflictIds) => {
      const targets = conflicts.filter(
        (c) => conflictIds.includes(c.id) && c.severity === 'low' && c.reviewStage !== 'resolved'
      )
      if (targets.length === 0) return { approved: 0, waiting: 0 }
      const next = new Map(
        targets.map((c) => {
          const reviewers = c.reviewers.some((r) => r.id === currentUser.id)
            ? c.reviewers.map((r) => (r.id === currentUser.id ? { ...r, status: 'approved' } : r))
            : [...c.reviewers, { id: currentUser.id, status: 'approved' }]
          const updated = { ...c, reviewers, diffInspected: true }
          return [c.id, { ...updated, reviewStage: allReviewersApproved(updated) ? 'approved' : 'in_review' }]
        })
      )
      setConflicts((prev) => prev.map((c) => next.get(c.id) ?? c))
      for (const c of next.values()) logEvent({ kind: 'approve', projectId, conflictId: c.id, actorId: currentUser.id, title: c.title })
      const approved = [...next.values()].filter((c) => c.reviewStage === 'approved').length
      appendTerminalLines([
        `$ devsign review approve --as ${currentUser.id} --batch (${next.size})`,
        `✓ signed off on ${next.size} low-risk conflict${next.size === 1 ? '' : 's'}`,
      ])
      return { approved, waiting: next.size - approved }
    },
    [appendTerminalLines, conflicts, logEvent, projectId, setConflicts]
  )

  // Pipeline step 2: write the update up as a Reference Doc.
  const documentDsUpdate = useCallback(
    (updateId) => {
      const update = dsUpdates.find((u) => u.id === updateId)
      if (!update || update.stage !== 'update') return
      const documented = { ...update, stage: 'documented', documentedAtLabel: 'Just now' }
      setDsUpdates((prev) => prev.map((u) => (u.id === updateId ? documented : u)))
      setGeneratedDocs((prev) => [...prev.filter((d) => d.id !== docIdFor(update)), docForUpdate(documented)])
      appendTerminalLines([`$ devsign docs generate "${update.title}"`, '✓ reference doc created'])
    },
    [dsUpdates, appendTerminalLines]
  )

  // Pipeline step 3: record it in History as a version of the project.
  const archiveDsUpdate = useCallback(
    (updateId) => {
      const update = dsUpdates.find((u) => u.id === updateId)
      if (!update || update.stage !== 'documented') return
      const historyId = recordHistory({
        label: `Design system update · ${update.title}`,
        timestamp: timeLabel(),
        snapshot: currentSnapshot(),
      })
      setDsUpdates((prev) =>
        prev.map((u) => (u.id === updateId ? { ...u, stage: 'archived', archivedAtLabel: 'Just now', historyId } : u))
      )
      appendTerminalLines([`$ devsign history record "${update.title}"`, '✓ archived to history'])
    },
    [dsUpdates, recordHistory, currentSnapshot, appendTerminalLines]
  )

  // Import: code files are read as text and added to the project's file
  // tree (and opened); design files become entries in the Assets panel.
  const importFiles = useCallback(
    async (fileList) => {
      const code = []
      const design = []
      for (const file of Array.from(fileList)) {
        const kind = importKind(file.name)
        if (kind === 'code') {
          const text = await file.text()
          const ext = file.name.split('.').pop().toLowerCase()
          code.push({
            id: nextId('import'),
            name: file.name,
            path: `src/imports/${file.name}`,
            language: ext,
            iconName: 'FileCode',
            imported: true,
            lines: text.replace(/\r\n/g, '\n').split('\n'),
          })
        } else {
          design.push({ id: nextId('asset'), name: file.name, kind, size: file.size, source: 'upload' })
        }
      }
      if (code.length) {
        setImportedFiles((prev) => [...prev, ...code])
        setActiveFileIdState(code[0].id)
      }
      if (design.length) setImportedAssets((prev) => [...prev, ...design])
      appendTerminalLines([
        `$ devsign import ${Array.from(fileList).map((f) => f.name).join(' ')}`,
        `✓ ${code.length} code file${code.length === 1 ? '' : 's'}, ${design.length} design file${design.length === 1 ? '' : 's'} imported`,
      ])
      return { code: code.length, design: design.length }
    },
    [appendTerminalLines]
  )

  const importFigmaLink = useCallback(
    (url) => {
      const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '').replace(/-/g, ' ').trim() || 'Figma file'
      setImportedAssets((prev) => [...prev, { id: nextId('asset'), name, kind: 'figma', url, source: 'figma' }])
      appendTerminalLines([`$ devsign import --figma ${url}`, `✓ linked "${name}" from Figma`])
      return name
    },
    [appendTerminalLines]
  )

  const allReferenceDocs = useMemo(() => [...staticReferenceDocs, ...generatedDocs], [generatedDocs])

  // Archiving is a soft-delete: the entry drops out of the active rollback
  // timeline but its snapshot is kept, so `restoreHistoryEntry` can always
  // bring it back — nothing here is ever destructive. The entry currently
  // representing the live workspace can't be archived, since that would
  // hide the one entry that's actually in effect right now.
  const archiveHistoryEntry = useCallback(
    (entryId) => {
      if (entryId === activeHistoryId) {
        toast("Can't archive the entry you're currently on — roll back to a different one first.")
        return
      }
      setHistoryEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, archived: true } : entry))
      )
    },
    [activeHistoryId]
  )

  const restoreHistoryEntry = useCallback((entryId) => {
    setHistoryEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, archived: false } : entry))
    )
  }, [])

  // Roll back to a checkpoint. Files, preview and canvas selection always
  // go back; `conflicts` (the Conflict Points' review state) and
  // `agentMemory` (the agent conversation after the checkpoint) are the
  // rollback dialog's options, both on unless turned off.
  // Non-destructive (Replit style): nothing after the checkpoint is erased —
  // the restored state is appended as a brand-new "Restored" checkpoint on
  // top of the timeline, and that new one becomes current. Returns its id.
  const rollbackTo = useCallback(
    (entryId, { conflicts: restoreConflicts = true, agentMemory = false } = {}) => {
      const entry = historyEntries.find((h) => h.id === entryId)
      if (!entry) return null
      const { snapshot } = entry

      setFileOverrides((prev) => ({ ...prev, [snapshot.fileId]: snapshot.lines }))
      setActiveFileIdState(snapshot.activeFileId)
      setPreviewProps(snapshot.previewProps)
      setPreviewVersion((v) => v + 1)
      // Conflict points are review records, not code state: restore the
      // ones this project's list and the snapshot share (e.g. a conflict an
      // AI edit resolved reopens), but never drop or add others — an older
      // snapshot that predates them must not wipe the review trail.
      if (restoreConflicts) {
        const snapshotConflicts = new Map((snapshot.conflicts ?? []).map((c) => [c.id, c]))
        setConflicts((prev) => prev.map((c) => snapshotConflicts.get(c.id) ?? c))
      }
      // Agent memory: forget the conversation after the checkpoint (older
      // checkpoints without a recorded length go back to the opening one).
      const keep = snapshot.chatLength ?? initialChatMessages.length
      if (agentMemory) setChatMessages((prev) => prev.slice(0, keep))
      setSelectedLayerId(snapshot.selectedLayerId ?? null)

      const restoredId = recordHistory({
        label: `Restored: ${entry.label.replace(/^Restored: /, '')}`,
        timestamp: timeLabel(),
        restoredFrom: entry.id,
        snapshot: { ...snapshot, chatLength: agentMemory ? keep : chatLengthRef.current },
      })

      appendTerminalLines([
        `$ devsign rollback --to "${entry.label}"${agentMemory ? ' --agent-memory' : ''}`,
        '[HMR] workspace restored',
        '✓ rollback complete · saved as a new checkpoint',
      ])
      return restoredId
    },
    [historyEntries, appendTerminalLines, recordHistory, setConflicts]
  )

  // Does a scenario's change fall inside the request's target? The target
  // is what the user picked before sending (an element, a page or a file);
  // an AI change is only applied when it lands inside it, so the chat's
  // target and what actually gets edited can't drift apart.
  function scenarioFitsTarget(scenario, target) {
    if (!target) return true
    const layers = scenario.elements ?? []
    const filesTouched = (scenario.changes ?? []).map((c) => c.fileId)
    if (target.kind === 'element') return scenario.target?.layerId === target.layerId || layers.includes(target.layerId)
    if (target.kind === 'page') {
      const page = canvasPages.find((p) => p.id === target.pageId)
      const onPage = (id) => page?.frames.some((f) => f.id === id || f.layers.some((l) => l.id === id))
      return layers.some(onPage) || filesTouched.includes(target.fileId)
    }
    if (target.kind === 'file') return filesTouched.includes(target.fileId) || scenario.fileId === target.fileId
    return true
  }

  // `target` is captured when the message is sent (see ChatConversation)
  // and stored on it, so changing the selection afterwards never rewrites
  // what an earlier request was about. The reply carries a structured
  // `result`: done / partial / no change, what changed where, and which
  // Conflict Points now need review. Only an actual change writes files and
  // becomes a History checkpoint — titled by the change, not the reply.
  const sendChatMessage = useCallback(
    (text, target = null) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setChatMessages((prev) => [...prev, { id: nextId('m'), role: 'user', text: trimmed, target }])
      setIsAiTyping(true)

      const lower = trimmed.toLowerCase()
      const scenario = forProject(aiEditScenarios, projectId).find((s) => s.keywords.some((k) => lower.includes(k))) ?? null
      const fits = scenario && scenarioFitsTarget(scenario, target)

      window.setTimeout(() => {
        setIsAiTyping(false)

        if (!scenario || !fits) {
          const where = target?.label ?? 'the current target'
          const reason = !scenario
            ? `I couldn’t turn that into a specific change in ${where}. Nothing was changed.`
            : `That change would edit ${scenario.target?.layerId ? findCanvasTarget(scenario.target.layerId)?.layer?.name ?? 'another element' : getFileNameRef.current(scenario.fileId)}, which is outside your target (${where}). Nothing was changed — change the target or rephrase.`
          setChatMessages((prev) => [
            ...prev,
            { id: nextId('m'), role: 'assistant', text: reason, result: { status: 'no_change', target } },
          ])
          return
        }

        const nextFileOverrides = { ...fileOverrides, [scenario.fileId]: scenario.lines }
        const nextPreviewProps = { ...previewProps, ...(scenario.previewProps ?? {}) }
        // A fix for a conflict point doesn't close it: the conflict goes
        // (back) into review, and only its reviewers' sign-off merges it.
        const reopened = scenario.resolvesConflictId
          ? conflicts.find((c) => c.id === scenario.resolvesConflictId && c.reviewStage !== 'resolved')
          : null
        const nextConflicts = reopened
          ? conflicts.map((c) =>
              c.id === reopened.id
                ? {
                    ...c,
                    reviewStage: c.reviewers.length ? 'in_review' : c.reviewStage,
                    reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending' })),
                    // The change under review is now the AI's.
                    changedBy: { type: 'ai', what: `${scenario.title} (requested by ${currentUser.name} in AI chat)` },
                  }
                : c
            )
          : conflicts

        setFileOverrides(nextFileOverrides)
        setActiveFileIdState(scenario.fileId)
        setPreviewProps(nextPreviewProps)
        setPreviewVersion((v) => v + 1)
        setConflicts(nextConflicts)
        appendTerminalLines(scenario.terminalLines)

        const changes = (scenario.changes ?? [{ fileId: scenario.fileId, summary: scenario.title }]).map((c) => ({
          ...c,
          fileName: getFileNameRef.current(c.fileId),
        }))
        const result = {
          status: scenario.partialNote ? 'partial' : 'done',
          title: scenario.title,
          target,
          changes,
          fileCount: new Set(changes.map((c) => c.fileId)).size,
          elementCount: scenario.elements?.length ?? 0,
          reviewItems: reopened ? [{ conflictId: reopened.id, title: reopened.title }] : [],
          note: scenario.partialNote ?? null,
        }

        // The edit is a checkpoint; the reply carries its id so the chat can
        // offer "Rollback here" right under it. The checkpoint's agent
        // memory includes this reply (+1 on the conversation so far).
        const historyId = recordHistory({
          label: scenario.title,
          kind: 'ai-edit',
          actorId: currentUser.id,
          actorLabel: 'Devsign AI',
          target: target?.label ?? changes.map((c) => c.fileName).join(', '),
          prompt: trimmed,
          timestamp: timeLabel(),
          snapshot: {
            activeFileId: scenario.fileId,
            fileId: scenario.fileId,
            lines: scenario.lines,
            previewProps: nextPreviewProps,
            conflicts: nextConflicts,
            selectedLayerId,
            chatLength: chatLengthRef.current + 1,
          },
        })
        setChatMessages((prev) => [...prev, { id: nextId('m'), role: 'assistant', text: scenario.reply, historyId, result }])
      }, 900)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendTerminalLines, conflicts, fileOverrides, previewProps, projectId, recordHistory, selectedLayerId, setConflicts]
  )

  const getFileLines = useCallback(
    (fileId) => {
      if (prototypeFile(fileId)) return generatedPrototypeLines[fileId]
      const file = files.find((f) => f.id === fileId)
      return fileOverrides[fileId] ?? file?.lines ?? []
    },
    [fileOverrides, files, generatedPrototypeLines]
  )

  const getFileName = useCallback(
    (fileId) => {
      const file = files.find((f) => f.id === fileId)
      return fileNameOverrides[fileId] ?? file?.name ?? fileId
    },
    [fileNameOverrides, files]
  )

  // For callbacks defined above getFileName (e.g. the chat's result
  // summary) — always the latest file names, renames included.
  const getFileNameRef = useRef(getFileName)
  getFileNameRef.current = getFileName

  const renameFile = useCallback(
    (fileId, newName) => {
      const trimmed = newName.trim()
      if (!trimmed || trimmed === getFileName(fileId)) return
      setFileNameOverrides((prev) => ({ ...prev, [fileId]: trimmed }))
      appendTerminalLines([`$ mv "${getFileName(fileId)}" "${trimmed}"`])
    },
    [appendTerminalLines, getFileName]
  )

  // Committed from the editor's edit mode (see EditorPanel) — a plain
  // content overwrite, same storage as the AI-driven edits already use
  // (`fileOverrides`), so rollback/history keep working on hand-edited
  // content exactly like they do on AI-generated content.
  const updateFileContent = useCallback(
    (fileId, lines, { live = false } = {}) => {
      // Code → canvas: a prototype file is parsed back into the canvas
      // model rather than stored as text.
      if (prototypeFile(fileId)) {
        const parsed = parsePrototype(fileId, lines)
        setPrototypeEdits((prev) => ({ ...prev, ...parsed }))
      } else {
        if (live) return
        setFileOverrides((prev) => ({ ...prev, [fileId]: lines }))
      }
      setPreviewVersion((v) => v + 1)
      if (!live) appendTerminalLines([`[HMR] ${getFileName(fileId)} updated`])
    },
    [appendTerminalLines, getFileName]
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
    projectId,
    workspaceFiles: files,
    prototypeEdits,
    editPrototypeLayer,
    codeFlash,
    importedAssets,
    importFiles,
    importFigmaLink,
    activeFileId,
    setActiveFileId,
    openFileIds,
    closeFileTab,
    getFileLines,
    getFileName,
    renameFile,
    updateFileContent,
    selectedLayerId,
    selectCanvasLayer,
    terminalEntries,
    consoleEntries,
    conflicts,
    resolveConflict,
    approveConflict,
    requestChanges,
    batchApproveConflicts,
    projectPages,
    memberViewports,
    updateConflict,
    reviewConflictId,
    bottomPanel,
    dsUpdates,
    documentDsUpdate,
    archiveDsUpdate,
    referenceDocs: allReferenceDocs,
    setBottomPanel,
    filesWindow,
    setFilesWindow,
    assetAssemblies,
    assembleAsset,
    openConflictReview: setReviewConflictId,
    focusChange,
    chatDraft,
    setChatDraft,
    chatTargetOverride,
    setChatTargetOverride,
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
    archiveHistoryEntry,
    restoreHistoryEntry,
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
    mergeDrafts,
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
    mergePreviewOpen,
    setMergePreviewOpen,
    mergeCta,
    setMergeCta,
    mergeListCollapsed,
    setMergeListCollapsed,
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

// For components mounted outside any project's workspace (e.g. the global
// cursor overlay, which also needs to render on the dashboard/projects/team
// pages) — returns null instead of throwing when there's no provider.
export function useWorkspaceOptional() {
  return useContext(WorkspaceContext)
}
