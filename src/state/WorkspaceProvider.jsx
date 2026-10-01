import { answerDocumentQuestion } from '@/lib/workspaceDocuments'
import { moveTab } from '@/lib/tabOrder'
import { mergeBlockReason } from '@/lib/mergePolicy'
import { buildOverrides } from '@/components/mergestudio/mergeSummary'
import { codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { reviewAlerts } from '@/lib/inboxNotifications'
import { useDemoState } from '@/state/useDemoState'
import { readDemo, writeDemo, signature } from '@/lib/demoStorage'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/i18n/toast'
import { translateText } from '@/i18n/translate'
import {
  aiEditScenarios,
  chatSuggestions,
  canvasPages,
  conflictChecklist,
  conflictNotifications,
  designSystemUpdates,
  referenceDocs as staticReferenceDocs,
  comments as seedComments,
  consoleLogLines as seedConsoleLogLines,
  currentUserFor,
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
  liveMergeNotificationsByProject,
  openFiles,
  projectFileSets,
  teamMembers,
  terminalLogLines as seedTerminalLogLines,
} from '@/data/mockData'
import { allReviewersApproved, toConflictRecord } from '@/lib/conflicts'
import { useConflictStore } from '@/state/ConflictStore'
import { docForUpdate, docIdFor, updateFromConflict } from '@/lib/designSystemUpdates'
import { affectedDocuments, canProcessDocumentChange, mergeDocumentUpdate } from '@/lib/documentChanges'
import { suggestedDocumentCategory, validDocumentCategory } from '@/lib/docCategories'
import { importKind } from '@/lib/importFiles'
import {
  PROTOTYPE_FILES,
  deriveComponentOverride,
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

function nextId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
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
    .map((u) => ({ ...u, source: 'conflict', conflictTitle: conflictChecklist.find((c) => c.id === u.conflictId)?.token }))
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function WorkspaceProvider({ children, projectId }) {
  // Who "you" are on this project (Jane on the designer track, James on
  // the developer track) — every reviewer/approval/"(you)" surface in this
  // provider keys off this instead of the global default. `otherMembers` is
  // the roster minus the viewer: the simulated teammates whose presence,
  // cursors and Follow Me timelines actually render as *other* people.
  const currentUser = currentUserFor(projectId)
  const otherMembers = useMemo(() => teamMembers.filter((m) => m.id !== currentUser.id), [currentUser.id])
  // Every project's file set shares the same file *ids* as the default
  // (`openFiles`) — see the comment on `projectFileSets` in mockData.js —
  // so this only needs to swap which file objects those ids resolve to,
  // nothing else in this provider needs to change per project.
  const baseFiles = projectFileSets[projectId] ?? openFiles
  // Code files brought in with Import (see importFiles) join the file tree
  // and editor like any other file; design files (Figma, Illustrator,
  // images) land in `importedAssets` instead.
  const [importedFiles, setImportedFiles] = useDemoState(`project:${projectId}:importedFiles`, [])
  const [importedAssets, setImportedAssets] = useDemoState(`project:${projectId}:importedAssets`, [])
  // Folders created from the Explorer's "New Folder" action before any file
  // lives in them — buildFileTree otherwise only derives folders from file
  // paths, so an empty one needs to be tracked explicitly to still show up.
  const [emptyFolders, setEmptyFolders] = useDemoState(`project:${projectId}:emptyFolders`, [])
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
  // `app`'s starting lines (PlaceOrderButton.jsx's hard-coded violet,
  // Button.jsx's h-9) already describe the two scripted conflicts' buggy
  // *current* state — derive the canvas override that matches, so the
  // canvas doesn't open already showing the fixed design regardless.
  const [prototypeEdits, setPrototypeEdits] = useDemoState(
    `project:${projectId}:prototypeEdits`,
    () => deriveComponentOverride(projectId, 'app', baseFiles.find((f) => f.id === 'app')?.lines) ?? {}
  )
  // A line the editor should briefly highlight and scroll to — the code a
  // canvas edit or selection just touched: { fileId, line, nonce }.
  const [codeFlash, setCodeFlash] = useState(null)
  // The canvas layer an AI chat edit just changed — CanvasPanel pulses it
  // for a couple of seconds: { layerId, nonce }.
  const [aiEditPulse, setAiEditPulse] = useState(null)
  // Set while an AI edit is "being written" — before the change actually
  // lands, so CanvasPanel/EditorPanel can show it being worked on (a
  // generating glow) instead of the result just appearing outright:
  // { layerId, fileId, line, nonce }.
  const [aiGenerating, setAiGenerating] = useState(null)
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
  const [tabOrders, setTabOrders] = useState({})
  const reorderWorkspaceTab = useCallback((kind, source, target, after, ids) => {
    if (kind === 'editor') setOpenFileIds((prev) => moveTab(prev, source, target, after))
    else setTabOrders((prev) => ({ ...prev, [kind]: moveTab(ids, source, target, after) }))
  }, [])
  const [fileOverrides, setFileOverrides] = useDemoState(`project:${projectId}:fileOverrides`, {})
  const [fileNameOverrides, setFileNameOverrides] = useDemoState(`project:${projectId}:fileNameOverrides`, {})
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
  const [dsUpdates, setDsUpdates] = useDemoState(`project:${projectId}:dsUpdates`, () => seedDsUpdates(projectId))
  const [generatedDocs, setGeneratedDocs] = useDemoState(`project:${projectId}:generatedDocs`, () =>
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
  // History's kind/target filter — shared by the sidebar drawer (which sets
  // it) and the History page's playback timeline (which reads it too), so
  // narrowing to one file's checkpoints does the same thing in both.
  const [historyFilter, setHistoryFilterState] = useState({ kind: 'all', target: 'all' })
  const setHistoryFilter = useCallback((patch) => setHistoryFilterState((prev) => ({ ...prev, ...patch })), [])
  // Assemble edits made from the navigator's Assets view (Block Deck's
  // Assemble, outside Merge Studio): { [layerId]: assembly }. Kept here so
  // they survive switching navigator tabs; `null` resets a layer.
  const [assetAssemblies, setAssetAssemblies] = useDemoState(`project:${projectId}:assetAssemblies`, {})
  const assembleAsset = useCallback(
    (layerId, patch) =>
      setAssetAssemblies((prev) => {
        const next = { ...prev }
        if (patch) next[layerId] = { ...prev[layerId], ...patch }
        else delete next[layerId]
        return next
      }),
    [setAssetAssemblies]
  )
  const [chatMessages, setChatMessages] = useDemoState(`project:${projectId}:chatMessages`, initialChatMessages)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [previewProps, setPreviewProps] = useDemoState(`project:${projectId}:previewProps`, DEFAULT_PREVIEW_PROPS)
  const [comments, setComments] = useState(() => forProject(seedComments, projectId))
  const historySeed = projectHistorySeeds[projectId] ?? initialHistoryEntries
  const [historyEntries, setHistoryEntries] = useDemoState(`project:${projectId}:historyEntries`, historySeed)
  const [activeHistoryId, setActiveHistoryId] = useDemoState(`project:${projectId}:activeHistoryId`, historySeed[historySeed.length - 1]?.id ?? null)
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
  // The Assets navigator's sub-tab ('assemble' | 'library') — kept here
  // rather than local to AssetsPanel so selecting an element on the canvas
  // can switch it to Assemble (see CanvasPanel's handleSelect), the same
  // way it already opens the Inspect tab.
  const [assetsTab, setAssetsTab] = useState('library')

  // --- View routing (workspace vs. Merge Studio) ----------------------
  // Switches the whole app body below TopBar, rather than living inside
  // dockview — Merge Studio's "Merge List" sidebar + workspace is its own
  // screen, not another dockable panel.
  const [activeView, setActiveView] = useState('workspace')
  const [mergeItems, setMergeItems] = useDemoState(`project:${projectId}:mergeItems`, () => forProject(seedMergeListItems, projectId))
  // Recreate only dynamically registered demo variants after reload.
  useMemo(() => {
    for (const item of mergeItems) if (item.category === 'Workspace') registerMergeVariants(item.id, item.designPageId)
  }, [mergeItems])
  const [selectedMergeItemId, setSelectedMergeItemId] = useDemoState(`project:${projectId}:selectedMergeItemId`, null)
  // Merge Studio collaboration: which right-hand drawer is open, the inbox,
  // and a "pan the canvas to this" request (consumed by MergeStudioWorkspace).
  const [mergeDrawer, setMergeDrawer] = useState(null) // null | 'inbox' | 'history'
  // Merge Studio's feed plus this project's Conflict Points items.
  const [storedNotifications, setNotifications] = useDemoState(`project:${projectId}:notifications`, () => [
    ...conflictNotifications.filter((n) => n.projectId === projectId),
    ...seedMergeNotifications,
  ])
  const notificationDay = new Date().toLocaleDateString('en-CA')
  const notifications = useMemo(() => {
    const alerts = reviewAlerts(conflicts, currentUser.id, notificationDay).map((alert) => ({
      ...alert, unread: storedNotifications.find((n) => n.id === alert.id)?.unread ?? true,
    }))
    const pendingIds = new Set(alerts.flatMap(alert => alert.reviewConflictIds))
    return [...alerts, ...storedNotifications.filter((n) => n.notificationType !== 'review_request'
      && !(n.kind === 'approval' && pendingIds.has(n.target?.conflictId))) ]
  }, [conflicts, storedNotifications, notificationDay, currentUser.id])
  // The AI chat's unsent draft and an explicitly picked request target,
  // kept here (not in the chat pane) so collapsing the pane or switching
  // tabs never loses them (see ChatConversation).
  const [chatDraft, setChatDraft] = useState('')
  const [chatTargetOverride, setChatTargetOverride] = useState(null)
  const [mergeFocus, setMergeFocus] = useState(null)
  // A request to open the Activity Bar's History drawer from somewhere
  // deep in the tree (Merge Studio's "Version history" link) — observed by
  // AppShell, which owns the drawer itself. See `requestHistoryDrawer`.
  const [historyDrawerRequest, setHistoryDrawerRequest] = useState(null)
  // Merge Studio's unmerged per-item edits ({ [itemId]: draft }), kept
  // across item switches and trips out of Merge Studio (see
  // MergeStudioWorkspace). A ref: saving a draft never needs a re-render.
  const mergeDrafts = useRef(readDemo(`project:${projectId}:mergeDrafts`, {}))
  const saveMergeDraft = useCallback((id, draft) => {
    const content = (d = {}) => ({ resolutions: d.resolutions ?? {}, assemblies: d.assemblies ?? {},
      assemblySources: d.assemblySources ?? {}, addedLayers: d.addedLayers ?? [], manualCode: d.manualCode ?? {},
      annotations: (d.annotations ?? []).filter((a) => a.status === 'done').map(({ effect, targets, fileId, line, summary }) => ({ effect, targets, fileId, line, summary })),
      preset: d.appliedPreset ?? null })
    if (signature(content(mergeDrafts.current[id])) !== signature(content(draft))) {
      setConflicts((prev) => prev.map((c) => c.mergeItemId === id ? {
        ...c, reviewStage: c.reviewers.length ? 'in_review' : 'detected',
        reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending' })),
      } : c))
      setMergeItems((prev) => prev.map((m) => m.id === id ? { ...m, tag: 'In Review', reviewers: m.reviewers?.map((r) => ({ ...r, status: 'pending' })) } : m))
    }
    mergeDrafts.current[id] = draft
    writeDemo(`project:${projectId}:mergeDrafts`, mergeDrafts.current)
  }, [projectId, setConflicts, setMergeItems])
  // Baseline moves only in the shared final merge operation, never on AI edits.
  const [mergedBaseline, setMergedBaseline] = useDemoState(`project:${projectId}:mergedBaseline`, {})
  const [draftChanges, setDraftChanges] = useDemoState(`project:${projectId}:draftChanges`, {})
  const [editorDirtyFiles, setEditorDirtyFiles] = useState({})
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
    Object.fromEntries(otherMembers.map((m) => [m.id, 0]))
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemoteViewportIndex((prev) => {
        const next = { ...prev }
        otherMembers.forEach((member) => {
          if (member.viewportSequence?.length > 1) {
            next[member.id] = (prev[member.id] + 1) % member.viewportSequence.length
          }
        })
        return next
      })
    }, REMOTE_VIEWPORT_INTERVAL)
    return () => window.clearInterval(interval)
  }, [otherMembers])

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
    const liveNotification = liveMergeNotificationsByProject[projectId] ?? liveMergeNotification
    const timer = setTimeout(() => {
      setNotifications((prev) => (prev.some((n) => n.id === liveNotification.id) ? prev : [liveNotification, ...prev]))
    }, 9000)
    return () => clearTimeout(timer)
  }, [activeView, projectId, setNotifications])

  // Each teammate's simulated timeline for this project (its own when the
  // project has one, else their default).
  const sequenceFor = useCallback(
    (member) => projectViewportSequences[projectId]?.[member.id] ?? member.viewportSequence ?? [],
    [projectId]
  )
  const memberViewports = useMemo(
    () =>
      otherMembers.map((member) => {
        const sequence = sequenceFor(member)
        return { member, viewport: sequence[(remoteViewportIndex[member.id] ?? 0) % Math.max(1, sequence.length)] ?? null }
      }),
    [otherMembers, remoteViewportIndex, sequenceFor]
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
  }, [setMergeItems])

  const requestMergeFocus = useCallback((target) => {
    setSelectedMergeItemId(target.itemId)
    // A monotonic counter, not Date.now() — two focus requests inside the
    // same millisecond (e.g. rapid drift-nav clicks) would otherwise get an
    // identical nonce, so the second one's "already handled" guard in
    // MergeStudioWorkspace would silently swallow it.
    setMergeFocus({ target, nonce: nextId('focus') })
  }, [setSelectedMergeItemId])

  // Same request/observe pattern as `requestMergeFocus`, for the one
  // History UI (the Activity Bar's) rather than a second, separate one
  // inside Merge Studio.
  const requestHistoryDrawer = useCallback(() => {
    setHistoryDrawerRequest({ nonce: nextId('history-drawer') })
  }, [])

  const markNotificationRead = useCallback((id, unread = false) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === id)) return prev.map((n) => n.id === id ? { ...n, unread } : n)
      const alert = notifications.find((n) => n.id === id)
      return alert ? [...prev, { ...alert, unread }] : prev
    })
  }, [setNotifications, notifications])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => [...prev.map((n) => ({ ...n, unread: false })), ...notifications.filter(n => !prev.some(saved => saved.id === n.id)).map(n => ({ ...n, unread: false }))])
  }, [setNotifications, notifications])

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
    [setNotifications, currentUser.id]
  )

  // Shared by `startMergeFromOpenFiles` (the Merge Studio menu's one-click
  // "Start New with Current Work") and `startMergeFromFiles` (the Merge
  // List's "Add files" picker, see AddFilesMenu) — builds a fresh Merge
  // List entry from a set of files, selects it, and enters Merge Studio
  // already looking at it.
  const startMergeFromFileIds = useCallback(
    (fileIds, fileLabels) => {
      if (!fileIds.length) return
      const id = nextId('merge')
      registerMergeVariants(id, activePageId)
      setMergeItems((prev) => [
        {
          id,
          title: 'New Merge — Current Work',
          subtitle: `${fileLabels.length} file${fileLabels.length === 1 ? '' : 's'} · ${fileLabels.join(', ')}`,
          tag: 'Draft',
          updatedLabel: 'Just now',
          fileIds,
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
    },
    [activePageId, setSelectedMergeItemId, setMergeItems, currentUser.id]
  )

  // "Start New with Current Work" — snapshots whatever's open in the editor
  // right now into a fresh Merge List entry.
  const startMergeFromOpenFiles = useCallback(() => {
    startMergeFromFileIds(openFiles.map((f) => f.id), openFiles.map((f) => f.name))
  }, [startMergeFromFileIds])

  // "Add files" — the same, but from a hand-picked set of this project's
  // files rather than only ever whatever's currently open.
  const startMergeFromFiles = useCallback(
    (fileIds) => {
      startMergeFromFileIds(fileIds, fileIds.map((fid) => files.find((f) => f.id === fid)?.name ?? fid))
    },
    [startMergeFromFileIds, files]
  )

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
    [prototypeEdits, setPrototypeEdits]
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
    const member = otherMembers.find((m) => m.id === followedMemberId)
    const sequence = member && sequenceFor(member)
    if (!sequence?.length) return

    const index = (remoteViewportIndex[followedMemberId] ?? 0) % sequence.length
    const target = sequence[index]

    setActiveFileIdState(target.fileId)
    setSelectedLayerId(target.layerId ?? null)
  }, [followedMemberId, otherMembers, remoteViewportIndex, sequenceFor])

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
  }, [setHistoryEntries, setActiveHistoryId])

  // The current workspace as a History snapshot (what rollback restores).
  const currentSnapshot = useCallback(
    () => ({
      activeFileId,
      fileId: activeFileId,
      lines: fileOverrides[activeFileId] ?? files.find((f) => f.id === activeFileId)?.lines ?? [],
      activePageId,
      prototypeEdits,
      previewProps,
      conflicts,
      selectedLayerId,
    }),
    [activeFileId, fileOverrides, files, activePageId, prototypeEdits, previewProps, conflicts, selectedLayerId]
  )

  // One final commit operation for both UI entry points. Approval never calls it.
  const commitMerge = useCallback(({ conflictId, itemId }) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    const item = mergeItems.find((m) => m.id === (itemId ?? conflict?.mergeItemId))
    const related = item ? conflicts.filter((c) => c.mergeItemId === item.id || c.id === item.conflictId) : conflict ? [conflict] : []
    if (!item && !conflict) return false
    const draft = mergeDrafts.current[item?.id] ?? {}
    const finalFiles = {}
    const fix = conflict && aiEditScenarios.find((sc) => sc.resolvesConflictId === conflict.id && (!sc.projectId || sc.projectId === projectId))
    if (item) {
      for (const fileId of item.fileIds ?? []) {
        const incoming = new Map((codeMergeVariants[item.id]?.[fileId] ?? []).map((d) => [d.line, d.incoming]))
        const ai = new Map((draft.annotations ?? []).filter((a) => a.status === 'done' && a.fileId === fileId).map((a) => [a.line, a.summary]))
        const base = fileOverrides[fileId] ?? files.find((f) => f.id === fileId)?.lines ?? []
        finalFiles[fileId] = base.map((line, i) => draft.manualCode?.[`${fileId}:${i + 1}`] ?? (incoming.get(i + 1) ?? line) + (ai.has(i + 1) ? `  // AI: ${ai.get(i + 1)}` : ''))
      }
    } else if (fix) {
      finalFiles[fix.fileId] = draftChanges[fix.fileId] ? fileOverrides[fix.fileId] : fix.lines
    }
    const reason = mergeBlockReason({ conflicts: related, item, lines: Object.values(finalFiles).flat() })
    if (reason) { toast("Can't merge yet", { description: reason }); return false }
    const mergedIds = new Set(related.map((c) => c.id))
    const nextConflicts = conflicts.map((c) => mergedIds.has(c.id)
      ? { ...c, reviewStage: 'resolved', resolvedAtLabel: 'Just now', mergedBy: currentUser.id } : c)
    const preset = draft.appliedPreset ?? null
    const design = item ? buildOverrides(item, draft.resolutions, draft.annotations, preset, draft.assemblies, draft.addedLayers, draft.manualCode,
      (id) => fileOverrides[id] ?? files.find((f) => f.id === id)?.lines ?? []) : null
    const nextPreviewProps = !item && fix ? { ...previewProps, ...fix.previewProps } : previewProps
    const output = { savedAt: Date.now(), files: finalFiles, design, sources: draft.assemblySources ?? {}, previewProps: nextPreviewProps }
    setMergedBaseline((prev) => ({ ...prev, [item?.id ?? conflictId]: output }))
    setFileOverrides((prev) => ({ ...prev, ...finalFiles }))
    const nextPrototypeEdits = design
      ? { ...prototypeEdits, ...Object.fromEntries(Object.entries(design.overrides).map(([layerId, override]) => [layerId, { merged: override }])) }
      : prototypeEdits
    if (design) setPrototypeEdits(nextPrototypeEdits)
    setPreviewProps(nextPreviewProps)
    setPreviewVersion((v) => v + 1)
    setConflicts(nextConflicts)
    if (item) updateMergeItem(item.id, { tag: 'Merged', conflictLevel: 'None', updatedLabel: 'Just now' })
    setDraftChanges((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !Object.hasOwn(finalFiles, id))))
    const title = conflict?.mergeTitle ?? `Merged ${item?.title ?? conflict?.title}`
    recordHistory({ label: title, kind: 'merge', actorId: currentUser.id, target: conflict?.file ?? item?.title,
      timestamp: timeLabel(), approvedBy: [...new Set((related.length ? related.flatMap((c) => c.reviewers) : item.reviewers).map((r) => r.id))],
      snapshot: { ...currentSnapshot(), files: finalFiles, mergeOutput: output, conflicts: nextConflicts, previewProps: nextPreviewProps, prototypeEdits: nextPrototypeEdits, activePageId } })
    for (const c of related) {
      logEvent({ kind: 'merge', projectId, conflictId: c.id, actorId: currentUser.id, title: c.title })
      const update = updateFromConflict(c, projectId)
      setDsUpdates((prev) => prev.some((u) => u.id === update.id) ? prev : [...prev, update])
    }
    if (!related.length) {
      logEvent({ kind: 'merge', projectId, actorId: currentUser.id, title: item.title })
      const update = mergeDocumentUpdate(item, projectId, {
        files: finalFiles,
        previousFiles: Object.fromEntries(files.map((file) => [file.id, fileOverrides[file.id] ?? file.lines])),
        fileNames: Object.fromEntries(files.map((file) => [file.id, file.name])), draft,
        layerDiffs: designMergeVariants[item.id]?.layerDiffs ?? {},
      })
      if (update) setDsUpdates((prev) => prev.some((u) => u.id === update.id) ? prev : [...prev, update])
    }
    appendTerminalLines([`$ devsign merge "${item?.title ?? conflict.title}"`, '✓ merged · local checkpoint saved to History'])
    return true
  }, [conflicts, mergeItems, projectId, fileOverrides, files, draftChanges, previewProps, prototypeEdits, activePageId, setMergedBaseline, setConflicts, updateMergeItem, recordHistory, currentSnapshot, logEvent, appendTerminalLines, setFileOverrides, setDraftChanges, setDsUpdates, setPreviewProps, setPrototypeEdits, currentUser.id])
  const resolveConflict = useCallback((conflictId) => commitMerge({ conflictId }), [commitMerge])
  const completeMerge = useCallback((itemId) => commitMerge({ itemId }), [commitMerge])

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
    [appendTerminalLines, conflicts, logEvent, projectId, setConflicts, currentUser.id]
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
    [conflicts, logEvent, projectId, setConflicts, currentUser.id]
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
    [appendTerminalLines, conflicts, logEvent, projectId, setConflicts, currentUser.id]
  )

  const setDocumentUpdateCategory = useCallback((updateId, categoryId) => {
    if (!validDocumentCategory(categoryId)) return
    setDsUpdates((prev) => prev.map((update) => update.id === updateId && update.stage === 'update' ? { ...update, categoryId } : update))
  }, [setDsUpdates])

  // Approval creates a new Reference Doc at the reviewed destination.
  const documentDsUpdate = useCallback(
    (updateId) => {
      const update = dsUpdates.find((u) => u.id === updateId)
      if (!update || !canProcessDocumentChange(dsUpdates, updateId, 'update')) return
      const affectedDocs = affectedDocuments(update, [...staticReferenceDocs, ...generatedDocs])
      const documented = { ...update, categoryId: suggestedDocumentCategory(update, affectedDocs), stage: 'documented', approvedBy: currentUser.id, documentedAtLabel: 'Just now', affectedDocIds: affectedDocs.map((doc) => doc.id) }
      setDsUpdates((prev) => prev.map((u) => (u.id === updateId ? documented : u)))
      setGeneratedDocs((prev) => [...prev.filter((d) => d.id !== docIdFor(update)), docForUpdate(documented)])
      appendTerminalLines([`$ devsign docs generate "${update.title}"`, '✓ reference doc created'])
    },
    [dsUpdates, generatedDocs, appendTerminalLines, setDsUpdates, setGeneratedDocs, currentUser.id]
  )

  // Pipeline step 3: record it in History as a version of the project.
  const archiveDsUpdate = useCallback(
    (updateId) => {
      const update = dsUpdates.find((u) => u.id === updateId)
      if (!update || !canProcessDocumentChange(dsUpdates, updateId, 'documented')) return
      const historyId = recordHistory({
        label: `Document update · ${update.title}`,
        kind: 'edit',
        actorId: currentUser.id,
        target: update.title,
        timestamp: timeLabel(),
        snapshot: currentSnapshot(),
      })
      setDsUpdates((prev) =>
        prev.map((u) => (u.id === updateId ? { ...u, stage: 'archived', archivedAtLabel: 'Just now', historyId } : u))
      )
      appendTerminalLines([`$ devsign history record "${update.title}"`, '✓ archived to history'])
    },
    [dsUpdates, recordHistory, currentSnapshot, appendTerminalLines, setDsUpdates, currentUser.id]
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
            path: file.webkitRelativePath || file.name,
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
    [appendTerminalLines, setImportedAssets, setImportedFiles]
  )

  // The Explorer's "New File" hover action — an empty file dropped straight
  // into `parentPath` (root when empty), opened immediately like an import.
  const createFile = useCallback(
    (parentPath, name) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const path = parentPath ? `${parentPath}/${trimmed}` : trimmed
      const ext = trimmed.includes('.') ? trimmed.split('.').pop().toLowerCase() : ''
      const id = nextId('new')
      setImportedFiles((prev) => [...prev, { id, name: trimmed, path, language: ext, iconName: 'FileCode', imported: true, lines: [''] }])
      setActiveFileIdState(id)
      appendTerminalLines([`$ touch "${path}"`])
      return id
    },
    [appendTerminalLines, setImportedFiles]
  )

  // The Explorer's "New Folder" hover action. Folders otherwise only exist
  // as a byproduct of a file's path, so an empty one needs its own tracked
  // list to show up in the tree at all (see buildFileTree).
  const createFolder = useCallback(
    (parentPath, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const path = parentPath ? `${parentPath}/${trimmed}` : trimmed
      setEmptyFolders((prev) => (prev.includes(path) ? prev : [...prev, path]))
      appendTerminalLines([`$ mkdir "${path}"`])
    },
    [appendTerminalLines, setEmptyFolders]
  )

  const importFigmaLink = useCallback(
    (url) => {
      const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '').replace(/-/g, ' ').trim() || 'Figma file'
      setImportedAssets((prev) => [...prev, { id: nextId('asset'), name, kind: 'figma', url, source: 'figma' }])
      appendTerminalLines([`$ devsign import --figma ${url}`, `✓ linked "${name}" from Figma`])
      return name
    },
    [appendTerminalLines, setImportedAssets]
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
    [activeHistoryId, setHistoryEntries]
  )

  const restoreHistoryEntry = useCallback((entryId) => {
    setHistoryEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, archived: false } : entry))
    )
  }, [setHistoryEntries])

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
      if (snapshot.prototypeEdits) setPrototypeEdits(snapshot.prototypeEdits)
      if (snapshot.activePageId) setActivePageId(snapshot.activePageId)
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
        kind: 'rollback',
        actorId: currentUser.id,
        target: entry.target,
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
    [historyEntries, appendTerminalLines, recordHistory, setConflicts, setFileOverrides, setPreviewProps, setPrototypeEdits, setActivePageId, setChatMessages, currentUser.id]
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
  const aiStateRef = useRef(null)
  aiStateRef.current = { fileOverrides, previewProps, conflicts }

  function scenarioChangesOf(scenario) {
    return (scenario.changes ?? [{ fileId: scenario.fileId, summary: scenario.title }]).map((c) => ({
      ...c,
      fileName: getFileNameRef.current(c.fileId),
    }))
  }

  // Writes an AI scenario's files/canvas/preview and records its History
  // checkpoint — the one place that actually lands a change, called either
  // right away (Auto mode) or later from `applyPendingAiEdit`, once the
  // person approves the proposal sitting in chat.
  const commitAiScenario = useCallback(
    (scenario, target, trimmed) => {
      const changedLayerId = scenario.target?.layerId
      const layerHit = changedLayerId && findCanvasTarget(changedLayerId)
      const firstChange = scenario.changes?.[0]

      const live = aiStateRef.current
      const { fileOverrides, previewProps, conflicts } = live
      const nextFileOverrides = { ...fileOverrides, [scenario.fileId]: scenario.lines }
      const nextPreviewProps = { ...previewProps, ...(scenario.previewProps ?? {}) }
      // A fix for a conflict point doesn't close it: the conflict goes
      // (back) into review, and only its reviewers' sign-off merges it.
      const reopened = scenario.resolvesConflictId
        ? conflicts.find((c) => c.id === scenario.resolvesConflictId)
        : null
      const nextConflicts = reopened
        ? conflicts.map((c) =>
            c.id === reopened.id
              ? {
                  ...c,
                  reviewStage: c.reviewers.length ? 'in_review' : 'detected',
                  reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending' })),
                  // The change under review is now the AI's.
                  changedBy: { type: 'ai', what: `${scenario.title} (requested by ${currentUser.name} in AI chat)` },
                }
              : c
          )
        : conflicts

      setDraftChanges((prev) => ({ ...prev, [scenario.fileId]: { conflictId: reopened?.id, title: scenario.title } }))
      if (reopened?.mergeItemId) updateMergeItem(reopened.mergeItemId, { tag: 'In Review', updatedLabel: 'Just now' })
      // Jump to the change as it lands — not before: a pending proposal
      // shouldn't move the canvas or select anything until it's actually
      // approved, so nothing on screen reacts ahead of that decision.
      if (layerHit) {
        setActivePageId(layerHit.page.id)
        setSelectedLayerId(changedLayerId)
      }
      // Include the just-applied result even if a second request finishes before React renders.
      aiStateRef.current = { fileOverrides: nextFileOverrides, previewProps: nextPreviewProps, conflicts: nextConflicts }
      setFileOverrides(nextFileOverrides)
      setActiveFileIdState(scenario.fileId)
      setPreviewProps(nextPreviewProps)
      // The code text changed (nextFileOverrides, above) but the canvas
      // doesn't re-parse arbitrary JSX on its own — without this, a
      // scenario that edits one of the two real component files
      // deriveComponentOverride knows (not an auto-generated prototype
      // file) changes the code pane and nothing else, which is exactly
      // "code changed, preview didn't" (see lib/prototypeSync).
      const derivedOverride = deriveComponentOverride(projectId, scenario.fileId, scenario.lines)
      if (derivedOverride) setPrototypeEdits((prev) => ({ ...prev, ...derivedOverride }))
      setPreviewVersion((v) => v + 1)
      setConflicts(nextConflicts)
      appendTerminalLines(scenario.terminalLines)

      // The glow settles into the real, finished result: the same
      // canvas pulse + code flash as before, now timed to the reveal
      // rather than firing the instant the message was sent.
      if (layerHit) setAiEditPulse({ layerId: changedLayerId, nonce: nextId('pulse') })
      if (firstChange?.line) setCodeFlash({ fileId: firstChange.fileId ?? scenario.fileId, line: firstChange.line, nonce: nextId('flash') })

      const changes = scenarioChangesOf(scenario)
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
          activePageId,
          prototypeEdits,
          previewProps: nextPreviewProps,
          conflicts: nextConflicts,
          selectedLayerId,
          chatLength: chatLengthRef.current + 1,
        },
      })

      return { result, historyId, reply: scenario.reply }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendTerminalLines, activePageId, prototypeEdits, projectId, recordHistory, selectedLayerId]
  )

  const sendChatMessage = useCallback(
    (text, target = null, options = {}) => {
      const trimmed = text.trim()
      if (!trimmed) return

      if (options.includeUser !== false) setChatMessages((prev) => [...prev, { id: nextId('m'), role: 'user', text: trimmed, target }])
      const appendAssistant = (message) => setChatMessages((prev) => {
        if (options.replaceMessageId) {
          const index = prev.findIndex((entry) => entry.id === options.replaceMessageId)
          if (index >= 0) return prev.map((entry, i) => i === index ? { ...message, id: entry.id } : entry)
        }
        return [...prev, message]
      })
      setIsAiTyping(true)

      const documentReply = target?.kind === 'document' ? answerDocumentQuestion(allReferenceDocs.find((doc) => doc.id === target.docId), trimmed) : null
      const answer = forProject(chatSuggestions, projectId).find((q) => q.reply && [q.prompt, translateText(q.prompt, 'ko')].some((prompt) => prompt.toLowerCase() === trimmed.toLowerCase()))
      const lower = trimmed.toLowerCase()
      const scenario = forProject(aiEditScenarios, projectId).find((s) => s.keywords.some((k) => lower.includes(k))) ?? null
      const fits = scenario && scenarioFitsTarget(scenario, target)

      window.setTimeout(() => {
        if (documentReply) {
          setIsAiTyping(false)
          appendAssistant({ id: nextId('m'), role: 'assistant', text: documentReply, target })
          return
        }
        if (answer) {
          setIsAiTyping(false)
          appendAssistant({ id: nextId('m'), role: 'assistant', text: answer.reply, summary: answer.summary })
          return
        }
        if (!scenario || !fits) {
          setIsAiTyping(false)
          const where = target?.label ?? 'the current target'
          const reason = !scenario
            ? `I couldn’t turn that into a specific change in ${where}. Nothing was changed.`
            : `That change would edit ${scenario.target?.layerId ? findCanvasTarget(scenario.target.layerId)?.layer?.name ?? 'another element' : getFileNameRef.current(scenario.fileId)}, which is outside your target (${where}). Nothing was changed — change the target or rephrase.`
          appendAssistant({ id: nextId('m'), role: 'assistant', text: reason, result: { status: 'no_change', target } })
          return
        }

        const live = aiStateRef.current
        const currentLines = live.fileOverrides[scenario.fileId] ?? files.find((f) => f.id === scenario.fileId)?.lines ?? []
        if (!Array.isArray(scenario.lines) || scenario.lines.some((line) => typeof line !== 'string')) {
          setIsAiTyping(false)
          appendAssistant({ id: nextId('m'), role: 'assistant', text: 'I couldn’t apply this change. Try rephrasing the request, or edit the target directly in Assemble.', result: { status: 'failed', target } })
          return
        }
        if (signature(currentLines) === signature(scenario.lines) && Object.entries(scenario.previewProps ?? {}).every(([key, value]) => signature(live.previewProps[key]) === signature(value))) {
          setIsAiTyping(false)
          appendAssistant({ id: nextId('m'), role: 'assistant', text: 'The target already matches this result. No files or approvals were changed.', result: { status: 'no_change', target } })
          return
        }

        // Auto mode (opt-in, off by default): a real change is about to
        // land, so jump to it and show it being worked on — canvas glow +
        // editor shimmer (see `aiGenerating`, consumed by
        // CanvasPanel/EditorPanel) — instead of the typing bubble just
        // silently swapping for the finished result. Outside Auto mode
        // nothing lands without approval, so nothing jumps or glows yet
        // either — the canvas only reacts once the person clicks Apply
        // (see `commitAiScenario`, shared by both paths).
        const autoApply = options.autoApply === true
        if (autoApply) {
          const changedLayerId = scenario.target?.layerId
          const layerHit = changedLayerId && findCanvasTarget(changedLayerId)
          const firstChange = scenario.changes?.[0]
          setAiGenerating({
            layerId: layerHit ? changedLayerId : null,
            fileId: firstChange?.fileId ?? scenario.fileId,
            line: firstChange?.line ?? null,
            nonce: nextId('gen'),
          })
        }

        window.setTimeout(() => {
          setIsAiTyping(false)
          setAiGenerating(null)

          // The proposal sits in chat as a draft otherwise — files, canvas
          // and the History checkpoint only happen once the person clicks
          // Apply (see `applyPendingAiEdit`), so the AI never edits
          // anything on its own say-so.
          if (autoApply) {
            const { result, historyId, reply } = commitAiScenario(scenario, target, trimmed)
            appendAssistant({ id: nextId('m'), role: 'assistant', text: reply, historyId, result })
            return
          }

          const changes = scenarioChangesOf(scenario)
          const result = {
            status: 'pending',
            title: scenario.title,
            target,
            changes,
            fileCount: new Set(changes.map((c) => c.fileId)).size,
            elementCount: scenario.elements?.length ?? 0,
            reviewItems: [],
            note: scenario.partialNote ?? null,
          }
          appendAssistant({
            id: nextId('m'),
            role: 'assistant',
            text: scenario.reply,
            result,
            pendingEdit: { scenario, target, trimmed },
          })
        }, 1100)
      }, 900)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReferenceDocs, commitAiScenario, conflicts, fileOverrides, previewProps, projectId]
  )

  // Commits a proposal the person approved: same write path as Auto mode's
  // immediate apply, just deferred until now. Updates the message in place
  // (status pending → done) rather than appending a new one.
  const applyPendingAiEdit = useCallback(
    (messageId) => {
      const message = chatMessages.find((m) => m.id === messageId)
      if (!message?.pendingEdit) return
      const { scenario, target, trimmed } = message.pendingEdit
      const { result, historyId, reply } = commitAiScenario(scenario, target, trimmed)
      setChatMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: reply, result, historyId, pendingEdit: null } : m)))
    },
    [chatMessages, commitAiScenario, setChatMessages]
  )

  // Declines a proposal: nothing was ever written (files/canvas/History all
  // untouched), so this only has to relabel the message.
  const discardPendingAiEdit = useCallback((messageId) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, result: { ...m.result, status: 'discarded' }, pendingEdit: null } : m))
    )
  }, [setChatMessages])

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
    [appendTerminalLines, getFileName, setFileNameOverrides]
  )

  // Committed from the editor's edit mode (see EditorPanel) — a plain
  // content overwrite, same storage as the AI-driven edits already use
  // (`fileOverrides`), so rollback/history keep working on hand-edited
  // content exactly like they do on AI-generated content.
  const updateFileContent = useCallback(
    (fileId, lines, { live = false } = {}) => {
      const before = fileOverrides[fileId] ?? files.find((f) => f.id === fileId)?.lines ?? []
      if (!live && signature(before) === signature(lines)) return
      if (!live) {
        const changedLines = new Set(Array.from({ length: Math.max(before.length, lines.length) }, (_, i) => i + 1).filter((n) => before[n - 1] !== lines[n - 1]))
        const affected = conflicts.filter((c) => {
          const span = designMergeVariants[c.mergeItemId]?.layerCodeMap?.[c.layerId]
          const start = span?.line ?? c.line
          return (span?.fileId ?? c.fileId) === fileId && (!start || Array.from({ length: span?.span ?? 1 }, (_, i) => start + i).some((n) => changedLines.has(n)))
        })
        const ids = new Set(affected.map((c) => c.id))
        setConflicts((prev) => prev.map((c) => ids.has(c.id) ? { ...c, reviewStage: c.reviewers.length ? 'in_review' : 'detected', reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending' })) } : c))
        for (const c of affected) if (c.mergeItemId) updateMergeItem(c.mergeItemId, { tag: 'In Review' })
        setDraftChanges((prev) => ({ ...prev, [fileId]: { title: 'Code edited' } }))
      }
      // Code → canvas: a prototype file is parsed back into the canvas
      // model rather than stored as text.
      if (prototypeFile(fileId)) {
        const parsed = parsePrototype(fileId, lines)
        setPrototypeEdits((prev) => ({ ...prev, ...parsed }))
      } else {
        if (live) return
        setFileOverrides((prev) => ({ ...prev, [fileId]: lines }))
        // Same reasoning as sendChatMessage's AI edits: a hand-edited real
        // component file (not a generated prototype file) has no other
        // path back to the canvas at all otherwise.
        const derivedOverride = deriveComponentOverride(projectId, fileId, lines)
        if (derivedOverride) setPrototypeEdits((prev) => ({ ...prev, ...derivedOverride }))
      }
      setPreviewVersion((v) => v + 1)
      if (!live) appendTerminalLines([`[HMR] ${getFileName(fileId)} updated`])
    },
    [appendTerminalLines, getFileName, setPrototypeEdits, setFileOverrides, fileOverrides, files, conflicts, setConflicts, updateMergeItem, setDraftChanges, projectId]
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
  }, [currentUser.id])

  const value = {
    projectId,
    currentUser,
    otherMembers,
    workspaceFiles: files,
    prototypeEdits,
    editPrototypeLayer,
    codeFlash,
    aiEditPulse,
    aiGenerating,
    importedAssets,
    importFiles,
    importFigmaLink,
    emptyFolders,
    createFile,
    createFolder,
    activeFileId,
    setActiveFileId,
    openFileIds,
    tabOrders,
    reorderWorkspaceTab,
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
    setDocumentUpdateCategory,
    archiveDsUpdate,
    referenceDocs: allReferenceDocs,
    setBottomPanel,
    filesWindow,
    setFilesWindow,
    historyFilter,
    setHistoryFilter,
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
    applyPendingAiEdit,
    discardPendingAiEdit,
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
    activePageId,
    setActivePageId,
    dockApi,
    setDockApi,
    canvasTool,
    setCanvasTool,
    assetsTab,
    setAssetsTab,
    getViewersForFile,
    getViewersForCanvasPage,
    activeView,
    mergeItems,
    selectedMergeItemId,
    mergeDrafts,
    saveMergeDraft,
    draftChanges,
    editorDirtyFiles,
    setEditorDirtyFiles,
    mergedBaseline,
    setSelectedMergeItemId,
    openMergeStudio,
    exitMergeStudio,
    startMergeFromOpenFiles,
    startMergeFromFiles,
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
    historyDrawerRequest,
    requestHistoryDrawer,
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
