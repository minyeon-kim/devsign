import { scheduleDemoReview, applyDueDemoReviews } from '@/lib/demoReview'
import { checksFor } from '@/components/mergestudio/mergeChecks'
import { driftRowsFor } from '@/lib/driftDecisions'
import { composeDraftFrame, draftScreens, regionLayout, regionPicks } from '@/data/draftScreens'
import { authorOf, requiredReviewers, reviewTabFor } from '@/lib/conflicts'
import { DECISION_LABEL, DECISION_REPLY_MS, PROPOSAL_LABEL, TIMING_LABEL } from '@/lib/designDecisions'
import { itemConflicts, mergeChatAnswer, mergeChatIntro } from '@/lib/mergeChat'
import { placeChange } from '@/lib/placeChange'
import { answerDocumentQuestion } from '@/lib/workspaceDocuments'
import { moveTab } from '@/lib/tabOrder'
import { mergeBlockReason } from '@/lib/mergePolicy'
import { rollbackChanges, rollbackImpact } from '@/lib/rollbackImpact'
import { seedMergeDrafts } from '@/lib/sizeAdjustment'
import { diffLines } from '@/lib/lineDiff'
import { buildOverrides } from '@/components/mergestudio/mergeSummary'
import { assemblyToOverride, frameWithLayers } from '@/components/mergestudio/mergeEffects'
import { codeMergeVariants, designMergeVariants } from '@/data/mockData'
import { reviewAlerts } from '@/lib/inboxNotifications'
import { useDemoState } from '@/state/useDemoState'
import { readDemo, writeDemo, signature } from '@/lib/demoStorage'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/i18n/toast'
import { translateText } from '@/i18n/translate'
import {
  aiEditScenarios,
  allPeople,
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
  // Who "you" are on this project (Taylor on the designer track, Jordan on
  // the developer track) — every reviewer/approval/"(you)" surface in this
  // provider keys off this instead of the global default. `otherMembers` is
  // the roster minus the viewer: the simulated teammates whose presence,
  // cursors and Follow Me timelines actually render as *other* people.
  const currentUser = currentUserFor(projectId)
  const otherMembers = useMemo(() => teamMembers.filter((m) => m.id !== currentUser.id), [currentUser.id])
  // (The developer track plays the other side of design decisions.)
  const isDeveloperViewer = currentUser.jobRole === 'Developer'
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
  // Merged layouts: a draft mix (draftScreens) replaces a frame's layers
  // when it merges — the screen as composed, region by region.
  const [mergedFrames, setMergedFrames] = useDemoState(`project:${projectId}:mergedFrames`, {})
  const projectPages = useMemo(
    () => forProject(canvasPages, projectId).map((page) => ({ ...page, frames: page.frames.map((frame) => mergedFrames[frame.id] ?? frame) })),
    [projectId, mergedFrames]
  )
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
  // …and where its detail shows: 'panel' (in the bottom panel, beside the
  // canvas) or 'overlay' (the full-screen viewer over the work area — what
  // a row of either list, the bottom panel's or the sidebar's, opens).
  // Kept here, with the id, so every way in drives the one viewer.
  const [reviewView, setReviewView] = useState('panel')
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
  // Start on Conflict Points; keep each project's last panel selection.
  // Entering a project starts with it folded to its strip (the tab and the
  // height dragged to are kept; only whether it's open isn't) — the work
  // area comes first. Anything that opens it on arrival (a review asked for
  // by a link or a notification) does so after this.
  const bottomPanelKey = `project:${projectId}:bottomPanel`
  const [bottomPanel, setBottomPanelState] = useState(() => ({ ...readDemo(bottomPanelKey, { tab: 'conflict', height: 320 }), open: false, maximized: false }))
  useEffect(() => { writeDemo(bottomPanelKey, bottomPanel) }, [bottomPanelKey, bottomPanel])
  const setBottomPanel = useCallback((patch) => setBottomPanelState((prev) => ({ ...prev, ...patch })), [])
  const openConflictReview = useCallback((id, { view = 'panel' } = {}) => {
    setReviewConflictId(id)
    if (!id) return
    setReviewView(view)
    // (Full-screen, the bottom panel is left as it is — the viewer covers it.)
    if (view === 'overlay') return
    const record = conflicts.find(candidate => candidate.id === id) ?? { id }
    setBottomPanel({ tab: reviewTabFor(record), open: true, ...(reviewTabFor(record) === 'design-compare' && record.mergeItemId ? { designCompareItemId: record.mergeItemId } : {}) })
  }, [conflicts, setBottomPanel])
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
  // The Workspace's conversation. Merge Studio keeps one per merge item
  // (`mergeChats`, below) — see `chatThread`.
  const [workspaceChat, setWorkspaceChat] = useDemoState(`project:${projectId}:chatMessages`, initialChatMessages)
  const [mergeChats, setMergeChats] = useDemoState(`project:${projectId}:mergeChats`, {})
  const [isAiTyping, setIsAiTyping] = useState(false)
  const chatGeneration = useRef(null)
  const stopChatGeneration = useCallback(() => {
    if (chatGeneration.current) window.clearTimeout(chatGeneration.current.timer)
    chatGeneration.current = null
    setIsAiTyping(false)
    setAiGenerating(null)
  }, [])
  useEffect(() => () => {
    if (chatGeneration.current) window.clearTimeout(chatGeneration.current.timer)
    chatGeneration.current = null
  }, [])

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

  // Which conversation AI Chat shows: the Workspace's, or — in Merge Studio
  // with an item open — that item's own, opening on the item it's about
  // (see lib/mergeChat). `setChatMessagesFor(thread)` writes to one thread
  // regardless of which is on screen, so a reply that lands after you've
  // switched items still goes to the conversation it answers.
  // The item Merge Studio has open: the selection, or else the next
  // unmerged item (what the studio opens by default). One answer for the
  // canvas (MergeStudioView) and the chat thread, so they never disagree.
  const openMergeItem = mergeItems.find((item) => item.id === selectedMergeItemId)
    ?? mergeItems.find((item) => item.tag !== 'Merged')
    ?? mergeItems[0]
    ?? null
  const chatThread = activeView === 'mergeStudio' && openMergeItem ? openMergeItem.id : null
  const chatThreadItem = chatThread ? openMergeItem : null
  const threadStart = useCallback((itemId) => {
    const item = mergeItems.find((candidate) => candidate.id === itemId)
    return item ? mergeChatIntro(item, itemConflicts(item, conflicts)) : initialChatMessages
  }, [mergeItems, conflicts])
  const chatMessages = chatThread ? mergeChats[chatThread] ?? threadStart(chatThread) : workspaceChat
  const setChatMessagesFor = useCallback((thread) => (update) => {
    if (!thread) return setWorkspaceChat(update)
    setMergeChats((prev) => {
      const current = prev[thread] ?? threadStart(thread)
      return { ...prev, [thread]: typeof update === 'function' ? update(current) : update }
    })
  }, [setWorkspaceChat, setMergeChats, threadStart])
  const setChatMessages = useMemo(() => setChatMessagesFor(chatThread), [setChatMessagesFor, chatThread])
  // Merge Studio collaboration: which right-hand drawer is open, the inbox,
  // and a "pan the canvas to this" request (consumed by MergeStudioWorkspace).
  const [mergeDrawer, setMergeDrawer] = useState(null) // null | 'inbox' | 'history'
  // Design Compare asked for on an item that isn't open yet: Merge Studio
  // switches to it, then picks this up on load ({ itemId, keys }).
  const [designCompareRequest, setDesignCompareRequest] = useState(null)
  // Merge Studio's feed plus this project's Conflict Points items.
  const [storedNotifications, setNotifications] = useDemoState(`project:${projectId}:notifications`, () => [
    ...conflictNotifications.filter((n) => n.projectId === projectId),
    // (Merge Studio's sample feed is the other projects' — Dashboard
    // Redesign's Inbox is its own walkthrough's.)
    ...(projectId === 'dashboard-redesign' ? [] : seedMergeNotifications),
  ])
  const notificationDay = new Date().toLocaleDateString('en-CA')
  const notifications = useMemo(() => {
    const alerts = reviewAlerts(conflicts, currentUser.id, notificationDay).map((alert) => ({
      ...alert, unread: storedNotifications.find((n) => n.id === alert.id)?.unread ?? true,
    }))
    const pendingIds = new Set(alerts.flatMap(alert => alert.reviewConflictIds))
    return [...alerts, ...storedNotifications.filter((n) => n.notificationType !== 'review_request'
      // Addressed to someone else (e.g. a review decision sent to its author).
      && (!n.recipientId || n.recipientId === currentUser.id)
      && !(n.kind === 'approval' && pendingIds.has(n.target?.conflictId))) ]
  }, [conflicts, storedNotifications, notificationDay, currentUser.id])
  // The AI chat's unsent draft and an explicitly picked request target,
  // kept here (not in the chat pane) so collapsing the pane or switching
  // tabs never loses them (see ChatConversation).
  const [chatDraft, setChatDraft] = useState('')
  const [chatTargetOverride, setChatTargetOverride] = useState(null)
  const [mergeFocus, setMergeFocus] = useState(null)
  // The failing check someone chose to fix (`{ conflictId, check }`): the
  // review marks where to change it, and Merge Studio keeps the same note
  // and a highlight on the element until it's fixed or dismissed.
  const [checkGuide, setCheckGuide] = useState(null)
  // A request to open the Activity Bar's History drawer from somewhere
  // deep in the tree (Merge Studio's "Version history" link) — observed by
  // AppShell, which owns the drawer itself. See `requestHistoryDrawer`.
  const [historyDrawerRequest, setHistoryDrawerRequest] = useState(null)
  // The same for the Activity Bar's Conflicts drawer: a notification about a
  // conflict (a review request, an Inbox item) opens it there — the list in
  // the left sidebar with the review over the work area — never the bottom
  // panel's list. See `openConflictFromNotification`.
  const [conflictDrawerRequest, setConflictDrawerRequest] = useState(null)
  // Merge Studio's unmerged per-item edits ({ [itemId]: draft }), kept
  // across item switches and trips out of Merge Studio (see
  // MergeStudioWorkspace). A ref: saving a draft never needs a re-render.
  // (Seeded samples reach a saved demo too: an item it has no draft for
  // yet takes the seed's.)
  const mergeDrafts = useRef({ ...seedMergeDrafts(projectId), ...readDemo(`project:${projectId}:mergeDrafts`, {}) })
  // A conflict's checks, from its merge item and that item's draft (the
  // choices made in Merge Studio) — run fresh wherever they're shown.
  const linesOfFile = useCallback((fileId) => fileOverrides[fileId] ?? files.find((f) => f.id === fileId)?.lines ?? [], [fileOverrides, files])
  // Every Conflict Point gets a durable History checkpoint when it first
  // appears, even if nobody has reviewed or merged it yet. This makes the
  // issue timeline and replay available for seeded and newly detected issues.
  useEffect(() => {
    const recorded = new Set(historyEntries.flatMap((entry) => [entry.conflictId, ...(entry.conflictIds ?? [])]).filter(Boolean))
    // (A rollback agreement isn't a design ↔ code difference — no checkpoint.)
    const missing = conflicts.filter((conflict) => !recorded.has(conflict.id) && !conflict.rollback)
    if (!missing.length) return
    setHistoryEntries((previous) => {
      const known = new Set(previous.flatMap((entry) => [entry.conflictId, ...(entry.conflictIds ?? [])]).filter(Boolean))
      const additions = missing.filter((conflict) => !known.has(conflict.id)).map((conflict) => {
        const fileId = conflict.fileId ?? activeFileId
        const currentLines = linesOfFile(fileId)
        const beforeLines = conflict.line && conflict.diff?.before?.length && conflict.diff?.after?.length
          ? placeChange(currentLines, conflict.line, conflict.diff.after, conflict.diff.before) ?? currentLines
          : currentLines
        return {
          id: `history-conflict-${conflict.id}`,
          label: `Conflict detected: ${conflict.title}`,
          kind: 'conflict',
          conflictId: conflict.id,
          actorLabel: conflict.detectedBy ?? 'Devsign',
          target: conflict.file ?? conflict.title,
          timestamp: conflict.timestamp ?? conflict.detectedAt ?? timeLabel(),
          archived: false,
          snapshot: {
            activeFileId: fileId,
            fileId,
            lines: beforeLines,
            files: { [fileId]: beforeLines },
            previewProps,
            activePageId,
            conflicts,
            selectedLayerId: conflict.layerId ?? null,
            conflictPreview: conflict.preview,
            previewSide: 'before',
          },
        }
      })
      return additions.length ? [...previous, ...additions] : previous
    })
  }, [conflicts, historyEntries, activeFileId, activePageId, linesOfFile, previewProps, setHistoryEntries])
  const conflictChecks = useCallback((conflict) => {
    if (!conflict) return null
    const item = mergeItems.find((m) => m.id === conflict.mergeItemId || m.conflictId === conflict.id)
    const raw = item ? checksFor(item, mergeDrafts.current[item.id], (id) => id === conflict.fileId && conflict.workingFile ? conflict.workingFile : linesOfFile(id)) : null
    if (!raw) return null
    // "Options undecided" isn't listed as a check here: the review shows it
    // as the choice still to make, once.
    const listed = (check) => check.id !== 'decided'
    const result = { ...raw, failing: raw.failing.filter(listed), blocking: raw.blocking.filter(listed) }
    // A failing check stops counting once it's settled another way:
    //   · a suggestion someone chose to ship as it is ("Apply as is");
    //   · a required one with an exception requested — but only after the
    //     reviewers have approved the change with that exception on it.
    // Both stay listed apart (`accepted`, `exceptions`) so the decision is
    // visible and can be undone.
    const exceptionIds = conflict.exceptionChecks ?? []
    const granted = conflict.reviewStage === 'approved' || conflict.reviewStage === 'resolved'
    const settledIds = [...(conflict.acceptedChecks ?? []), ...(granted ? exceptionIds : [])]
    const isSettled = (check) => settledIds.includes(check.id)
    return {
      ...result,
      failing: result.failing.filter((check) => !isSettled(check)),
      blocking: result.blocking.filter((check) => !isSettled(check)),
      accepted: result.failing.filter((check) => (conflict.acceptedChecks ?? []).includes(check.id)),
      exceptions: result.failing.filter((check) => exceptionIds.includes(check.id)),
      exceptionsGranted: granted,
    }
  }, [mergeItems, linesOfFile])
  const saveMergeDraft = useCallback((id, draft) => {
    const content = (d = {}) => ({ resolutions: d.resolutions ?? {}, assemblies: d.assemblies ?? {},
      assemblySources: d.assemblySources ?? {}, addedLayers: d.addedLayers ?? [], manualCode: d.manualCode ?? {},
      annotations: (d.annotations ?? []).filter((a) => a.status === 'done').map(({ effect, targets, fileId, line, summary }) => ({ effect, targets, fileId, line, summary })),
      preset: d.appliedPreset ?? null })
    if (signature(content(mergeDrafts.current[id])) !== signature(content(draft))) {
      // A change to the work resets its approvals; one nobody's been asked
      // to review yet stays that way — editing never requests a review.
      setConflicts((prev) => prev.map((c) => c.mergeItemId === id && c.reviewStage !== 'resolved' ? {
        ...c, reviewStage: c.reviewStage === 'detected' || !c.reviewers.length ? 'detected' : 'in_review',
        reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending', demoApproveAt: undefined })),
      } : c))
      setMergeItems((prev) => prev.map((m) => m.id === id ? { ...m, tag: 'In Review', reviewers: m.reviewers?.map((r) => ({ ...r, status: 'pending', demoApproveAt: undefined })) } : m))
    }
    mergeDrafts.current[id] = draft
    writeDemo(`project:${projectId}:mergeDrafts`, mergeDrafts.current)
    setDraftVersion((v) => v + 1)
  }, [projectId, setConflicts, setMergeItems])
  // Drift decisions (which value each drifted property ships with), shared
  // by the conflict's review and Merge Studio. While Merge Studio has the
  // item open its live choices are the source (it registers them here as
  // `studioDecisions`); otherwise the item's saved draft is.
  const [draftVersion, setDraftVersion] = useState(0)
  const [studioDecisions, setStudioDecisions] = useState(null)
  const decisionsFor = useCallback((itemId) => (
    studioDecisions?.itemId === itemId ? studioDecisions.resolutions : mergeDrafts.current[itemId]?.resolutions ?? {}
  ), [studioDecisions, draftVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const decideDrift = useCallback((itemId, key, decision) => {
    if (studioDecisions?.itemId === itemId) return studioDecisions.resolve(key, decision)
    const draft = mergeDrafts.current[itemId] ?? {}
    const resolutions = { ...(draft.resolutions ?? {}) }
    if (decision == null) delete resolutions[key]
    else resolutions[key] = decision
    saveMergeDraft(itemId, { ...draft, resolutions })
  }, [studioDecisions, saveMergeDraft])
  // Replace everything set by hand in Merge Studio on an item's elements
  // (`{}` takes it all back — the review's "Undo adjustment" — and the
  // previous set puts it back). While the studio has the item open the
  // values live in its own state — it does it; otherwise the saved draft
  // is edited.
  const setLayerAdjustments = useCallback((itemId, assemblies) => {
    if (studioDecisions?.itemId === itemId && studioDecisions.setAssemblies) return studioDecisions.setAssemblies(assemblies)
    const draft = mergeDrafts.current[itemId] ?? {}
    saveMergeDraft(itemId, { ...draft, assemblies })
  }, [studioDecisions, saveMergeDraft])
  // The same for code written by hand (`fileId:line` → text) — what Merge
  // Studio's code view edits, and what the review's direct adjustment
  // writes a value into.
  const setManualCode = useCallback((itemId, manualCode) => {
    if (studioDecisions?.itemId === itemId && studioDecisions.setManualCode) return studioDecisions.setManualCode(manualCode)
    const draft = mergeDrafts.current[itemId] ?? {}
    saveMergeDraft(itemId, { ...draft, manualCode })
  }, [studioDecisions, saveMergeDraft])
  // Baseline moves only in the shared final merge operation, never on AI edits.
  const [mergedBaseline, setMergedBaseline] = useDemoState(`project:${projectId}:mergedBaseline`, {})
  const [draftChanges, setDraftChanges] = useDemoState(`project:${projectId}:draftChanges`, {})
  const [editorDirtyFiles, setEditorDirtyFiles] = useState({})
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false)
  // The header's "Merge Changes" CTA: registered by the Merge Studio
  // workspace ({ merged, count, open }) so the top bar can render it.

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
  // Arriving in Merge Studio — from anywhere — starts with the canvas
  // clear: the bottom panel folds to its strip (opening it from there
  // brings it back at half the window). Runs after whatever opened the
  // studio, so a review left open behind it folds too.
  useEffect(() => {
    if (activeView === 'mergeStudio') setBottomPanel({ open: false, maximized: false })
  }, [activeView, setBottomPanel])

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
  // Every notification's way into a conflict: the sidebar's Conflicts
  // drawer (AppShell opens it, folding the bottom panel's list) and the
  // conflict's review in the full-screen viewer, as a row of that drawer
  // opens it.
  const openConflictFromNotification = useCallback((id) => {
    if (!id) return
    setConflictDrawerRequest({ nonce: nextId('conflict-drawer'), conflictId: id })
    openConflictReview(id, { view: 'overlay' })
  }, [openConflictReview])

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

  // Timers belong to the workspace and survive closing the review panel.
  // Replacing review content clears scheduled approvals in saveMergeDraft.
  useEffect(() => {
    const times = conflicts.filter(c => c.reviewStage === 'in_review').flatMap(c => c.reviewers
      .filter(r => r.status === 'pending' && r.demoApproveAt && r.id !== currentUser.id && r.id !== authorOf(c))
      .map(r => r.demoApproveAt))
    if (!times.length) return
    const timer = window.setTimeout(() => {
      const now = Date.now()
      for (const conflict of conflicts) {
        const next = applyDueDemoReviews(conflict, currentUser.id, now)
        if (next === conflict) continue
        next.reviewers.forEach((reviewer, i) => {
          if (reviewer.status === 'approved' && conflict.reviewers[i].status !== 'approved') {
            logEvent({ kind: 'approve', projectId, conflictId: conflict.id, actorId: reviewer.id, title: conflict.title, detail: 'UT 시뮬레이션 · 검토 요청에 승인으로 응답했습니다.' })
          }
        })
      }
      setConflicts(prev => prev.map(c => applyDueDemoReviews(c, currentUser.id, now)))
    }, Math.max(0, Math.min(...times) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [conflicts, currentUser.id, logEvent, projectId, setConflicts])

  // Design reviews use the shared approval model and remain in Design Compare.
  const createMergeRequest = useCallback((item) => {
    const record = toConflictRecord({
      id: `mr-${item.id}`,
      kind: 'design-review',
      title: item.title,
      file: files.find((f) => f.id === item.fileIds?.[0])?.path ?? item.title,
      fileId: item.fileIds?.[0],
      projectId,
      mergeItemId: item.id,
      severity: (item.conflictLevel ?? 'Low').toLowerCase() === 'none' ? 'low' : (item.conflictLevel ?? 'Low').toLowerCase(),
      message: 'A mix of the drafts, submitted for review and merge.',
      changedBy: { type: 'person', id: currentUser.id, what: 'Mixed the drafts' },
      detectedBy: 'Merge Studio',
      reviewStage: 'detected',
      reviewers: otherMembers.slice(0, 2).map((member) => ({ id: member.id, status: 'pending' })),
      submittedForMergeAt: Date.now(),
      timestamp: 'Just now',
      detectedAt: timeLabel(),
    })
    setConflicts((prev) => (prev.some((c) => c.id === record.id) ? prev : [...prev, record]))
    return record
  }, [files, projectId, currentUser.id, otherMembers, setConflicts])

  // Review-workflow edits from the conflict modal (stage, reviewers,
  // diff inspected) — everything short of the final resolve.
  const updateConflict = useCallback((conflictId, patch) => {
    const conflict = conflicts.find((candidate) => candidate.id === conflictId)
    const startsAnotherReviewRound = conflict
      && patch.reviewStage === 'in_review'
      && conflict.reviewStage === 'in_review'
      && conflict.reviewers.some((reviewer) => reviewer.status === 'changes_requested')
      && patch.reviewers?.some((reviewer) => reviewer.status === 'pending')
    if (conflict && ((patch.reviewStage && patch.reviewStage !== conflict.reviewStage) || startsAnotherReviewRound)) {
      const kind = patch.reviewStage === 'in_review'
        ? 'review_requested'
        : patch.reviewStage === 'detected' && conflict.reviewStage === 'resolved'
          ? 'reopened'
          : null
      if (kind) logEvent({ kind, projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    }
    setConflicts(prev => prev.map(c => {
      if (c.id !== conflictId) return c
      let next = { ...c, ...patch }
      if ('workingFile' in patch) next = { ...next, reviewers: next.reviewers.map(r => ({ ...r, demoApproveAt: undefined })) }
      const reminded = patch.reviewers?.filter(r => r.reminderRequestedAt && r.reminderRequestedAt !== c.reviewers.find(old => old.id === r.id)?.reminderRequestedAt).map(r => r.id)
      if (patch.reviewStage === 'in_review' || reminded?.length) next = scheduleDemoReview(next, currentUser.id, patch.reviewStage === 'in_review' ? null : reminded)
      return next
    }))
  }, [conflicts, currentUser.id, logEvent, projectId, setConflicts])

  // A walkthrough begins before the review: entering one (its notification)
  // puts its conflict back there — nothing chosen, no reason, nobody asked —
  // whatever an earlier run left. Everything that shows the conflict (its
  // review, the list, the reviewers) reads this one record, so they all
  // follow. A conflict that was already merged stays merged: that's code
  // in the file, not review state.
  const restartConflict = useCallback((conflictId) => {
    const conflict = conflicts.find((candidate) => candidate.id === conflictId)
    if (!conflict || conflict.reviewStage === 'resolved') return false
    // A design-decision walkthrough starts where its persona's does: the
    // designer with the developer's request in, the developer before asking
    // — unless the other side was actually played (a request the developer
    // sent, a decision the designer made): that's kept, to carry on from.
    if (conflict.decisionFlow) {
      const playedByOther = isDeveloperViewer ? conflict.designDecision && !conflict.designDecision.scripted : conflict.decisionRequest?.sentAt
      if (playedByOther) return false
      const designer = !isDeveloperViewer && conflict.scriptedRequest
      setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
        ...c,
        reviewStage: designer ? 'in_review' : 'detected',
        requestedBy: designer ? conflict.scriptedRequest.by : null,
        decisionRequest: designer ? { ...conflict.scriptedRequest, round: 1 } : null,
        designDecision: null,
        decisionFix: null,
        dsProposal: null,
        reviewers: c.reviewers.map((reviewer) => ({ id: reviewer.id, status: 'pending' })),
      })))
      return true
    }
    // What was picked or set by hand for it (its merge draft) goes first:
    // changing a draft touches the review's stage, set last below.
    const draft = conflict.mergeItemId ? mergeDrafts.current[conflict.mergeItemId] : null
    if (draft) saveMergeDraft(conflict.mergeItemId, { ...draft, resolutions: {}, assemblies: {}, manualCode: {} })
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
      ...c,
      reviewStage: 'detected',
      diffInspected: false,
      requestedBy: null,
      reviewers: c.reviewers.map((reviewer) => ({ id: reviewer.id, status: 'pending' })),
      // The choice, and what was said for it.
      pickedSide: null,
      decidedSide: null,
      decidedBy: null,
      customChosen: false,
      stashedAssemblies: null,
      stashedCode: null,
      handValues: null,
      deviation: null,
      adjustmentReason: null,
      exceptionChecks: [],
      acceptedChecks: [],
    })))
    return true
  }, [conflicts, isDeveloperViewer, saveMergeDraft, setConflicts])

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
    chatLengthRef.current = workspaceChat.length
  }, [workspaceChat])

  const recordHistory = useCallback((entry) => {
    const id = nextId('h')
    const snapshot = { chatLength: chatLengthRef.current, ...entry.snapshot }
    setHistoryEntries((prev) => {
      const parentIds = prev.length ? [prev[prev.length - 1].id] : []
      const conflictIds = new Set(entry.conflictIds ?? [])
      const mergedFromIds = entry.kind === 'merge'
        ? [...conflictIds].map((conflictId) => [...prev].reverse().find((checkpoint) =>
            checkpoint.kind !== 'merge' && (checkpoint.conflictId === conflictId || checkpoint.conflictIds?.includes(conflictId)))?.id).filter(Boolean)
        : []
      return [...prev, { archived: false, id, parentIds, mergedFromIds: [...new Set(mergedFromIds)], ...entry, snapshot }]
    })
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
    const item = mergeItems.find((m) => m.id === (itemId ?? conflict?.mergeItemId) || m.conflictId === conflict?.id)
    const related = item ? conflicts.filter((c) => c.mergeItemId === item.id || c.id === item.conflictId) : conflict ? [conflict] : []
    if (!item && !conflict) return false
    const draft = mergeDrafts.current[item?.id] ?? {}
    const mergedResolutions = { ...(draft.resolutions ?? {}) }
    if (item) {
      for (const relatedConflict of related) {
        for (const row of driftRowsFor(relatedConflict, item)) {
          if (mergedResolutions[row.key] != null) continue
          mergedResolutions[row.key] = row.region
            ? { custom: item.authorAId ?? item.variants?.[0]?.key }
            : 'B'
        }
      }
    }
    const mergedSideForConflict = (candidate) => {
      if (!candidate.preview) return null
      const rows = item ? driftRowsFor(candidate, item).filter((row) => row.diff) : []
      if (!rows.length) return draftScreens[item?.id] ? null : 'after'
      const sides = new Set(rows.map((row) => mergedResolutions[row.key] === 'A' ? 'after' : 'before'))
      return sides.size === 1 ? [...sides][0] : null
    }
    const finalFiles = {}
    const fix = conflict && aiEditScenarios.find((sc) => sc.resolvesConflictId === conflict.id && (!sc.projectId || sc.projectId === projectId))
    if (conflict?.revertOf && conflict.fileId && conflict.line) {
      // A revert's own diff (not the item's codeMergeVariants, which still
      // only knows the forward change) is the source of truth for what it
      // actually applies — just this conflict's line(s), back to its
      // pre-merge content.
      const base = fileOverrides[conflict.fileId] ?? files.find((f) => f.id === conflict.fileId)?.lines ?? []
      const revertLines = conflict.diff?.after ?? []
      finalFiles[conflict.fileId] = base.map((line, i) => {
        const offset = i + 1 - conflict.line
        return offset >= 0 && offset < revertLines.length ? revertLines[offset] : line
      })
    } else if (item) {
      for (const fileId of item.fileIds ?? []) {
        const codeChanges = codeMergeVariants[item.id]?.[fileId] ?? []
        const layerCodeMap = designMergeVariants[item.id]?.layerCodeMap ?? {}
        const resolutionFor = (change) => {
          // Code hunk IDs are linked to a decision by the layer's file/line span.
          const layer = Object.entries(layerCodeMap).find(([, span]) => span.fileId === fileId
            && change.line >= span.line && change.line < span.line + (span.span ?? 1))
          if (!layer) return null
          const [layerId] = layer
          const row = related.flatMap((candidate) => driftRowsFor(candidate, item))
            .find((entry) => entry.key.startsWith(`${layerId}:`)
              && entry.diff && ([entry.diff.id, `${layerId}-${entry.diff.id}`, `${layerId}:${entry.diff.id}`].includes(change.id)
                || change.id.endsWith(`-${entry.diff.id}`)))
          return row ? mergedResolutions[row.key] : null
        }
        const incoming = new Map(codeChanges
          .filter((change) => {
            const resolution = resolutionFor(change)
            return resolution == null || resolution === 'A'
          })
          .map((change) => [change.line, change.incoming]))
        const ai = new Map((draft.annotations ?? []).filter((a) => a.status === 'done' && a.fileId === fileId).map((a) => [a.line, a.summary]))
        const base = fileOverrides[fileId] ?? files.find((f) => f.id === fileId)?.lines ?? []
        finalFiles[fileId] = base.map((line, i) => draft.manualCode?.[`${fileId}:${i + 1}`] ?? (incoming.get(i + 1) ?? line) + (ai.has(i + 1) ? `  // AI: ${ai.get(i + 1)}` : ''))
      }
    } else if (fix) {
      finalFiles[fix.fileId] = draftChanges[fix.fileId] ? fileOverrides[fix.fileId] : fix.lines
    }
    // Code edited in the conflict's own review (its `workingFile` — the
    // whole file as the reviewer left it; see ConflictReviewPanel) wins over
    // the generated change. Only the stretch that differs from the AI's
    // version is spliced in, so whatever else this merge wrote into the same
    // file (an item's other changes) stays.
    for (const c of related) {
      if (!c.workingFile || c.revertOf || !c.fileId || !c.line || !c.diff) continue
      const original = fileOverrides[c.fileId] ?? files.find((f) => f.id === c.fileId)?.lines ?? []
      const generated = placeChange(original, c.line, c.diff.before, c.diff.after) ?? original
      const working = c.workingFile
      let head = 0
      while (head < generated.length && head < working.length && generated[head] === working[head]) head++
      let tail = 0
      while (tail < generated.length - head && tail < working.length - head
        && generated[generated.length - 1 - tail] === working[working.length - 1 - tail]) tail++
      const target = finalFiles[c.fileId] ?? generated
      finalFiles[c.fileId] = [...target.slice(0, head), ...working.slice(head, working.length - tail), ...target.slice(target.length - tail)]
    }
    // Checks gate the merge (not the review request): failing design-system
    // or accessibility checks, or a merge conflict, keep it from landing.
    // …except the ones the review chose to apply as they are.
    const acceptedChecks = new Set(related.flatMap((c) => [...(c.acceptedChecks ?? []), ...(c.reviewStage === 'approved' ? c.exceptionChecks ?? [] : [])]))
    const blocking = item ? checksFor(item, draft, (id) => finalFiles[id] ?? fileOverrides[id] ?? files.find((f) => f.id === id)?.lines ?? []).blocking.filter((check) => !acceptedChecks.has(check.id)) : []
    const reason = mergeBlockReason({ conflicts: related, item, lines: Object.values(finalFiles).flat() })
      ?? (blocking.length ? `${blocking.length} check${blocking.length === 1 ? '' : 's'} failing: ${blocking.map((c) => c.title).join(' · ')}` : null)
    if (reason) { toast("Can't merge yet", { description: reason }); return false }
    const mergedIds = new Set(related.map((c) => c.id))
    const nextConflicts = conflicts.map((c) => mergedIds.has(c.id)
      ? { ...c, reviewStage: 'resolved', resolvedAtLabel: 'Just now', mergedBy: currentUser.id,
        // (The decisions the merge shipped with — the review of a merged
        // change reads them back as `mergedDecisions`.)
        mergedDecisions: mergedResolutions, mergedFileLines: c.fileId ? finalFiles[c.fileId] : undefined,
        mergedPreview: c.preview, mergedPreviewSide: mergedSideForConflict(c), mergedFrame: null } : c)
    const preset = draft.appliedPreset ?? null
    const design = item ? buildOverrides(item, mergedResolutions, draft.annotations, preset, draft.assemblies, draft.addedLayers, draft.manualCode,
      (id) => fileOverrides[id] ?? files.find((f) => f.id === id)?.lines ?? []) : null
    const nextPreviewProps = !item && fix ? { ...previewProps, ...fix.previewProps } : previewProps
    // Drafts that differ in layout merge as the composed screen: it replaces
    // the page's frame (the Workspace canvas reads `design.frame`, the
    // preview the project's pages).
    let mergedDesign = design
    if (item && draftScreens[item.id]) {
      const base = canvasPages.find((p) => p.id === item.designPageId)?.frames[0]
      // A revert of that merge puts the page's own frame back.
      // The mix as worked on in Merge Studio: plus any components added to
      // it and the Assemble edits made to its layers.
      const composed = base && (conflict?.revertOf ? base : frameWithLayers(composeDraftFrame(item.id, base, regionPicks(item.id, mergedResolutions), item.authorAId ?? item.variants?.[0]?.key, regionLayout(item.id, mergedResolutions)), draft.addedLayers ?? []))
      if (composed) {
        const frame = { ...composed, id: base.id }
        const overrides = conflict?.revertOf ? {} : Object.fromEntries(Object.entries(draft.assemblies ?? {})
          .map(([layerId, assembly]) => {
            const layer = frame.layers.find((l) => l.id === layerId)
            return [layerId, layer && assemblyToOverride(assembly, layer)]
          })
          .filter(([, o]) => o))
        mergedDesign = { ...(design ?? {}), overrides, frame }
        setMergedFrames((prev) => {
          const next = { ...prev }
          if (conflict?.revertOf) delete next[base.id]
          else next[base.id] = frame
          return next
        })
      }
    }
    const resolvedConflicts = nextConflicts.map((c) => mergedIds.has(c.id)
      ? { ...c, mergedFrame: mergedDesign?.frame ?? null }
      : c)
    const output = { savedAt: Date.now(), files: finalFiles, design: mergedDesign, sources: draft.assemblySources ?? {},
      resolutions: mergedResolutions, previewProps: nextPreviewProps }
    setMergedBaseline((prev) => ({ ...prev, [item?.id ?? conflictId]: output }))
    setFileOverrides((prev) => ({ ...prev, ...finalFiles }))
    const nextPrototypeEdits = mergedDesign
      ? { ...prototypeEdits, ...Object.fromEntries(Object.entries(mergedDesign.overrides ?? {}).map(([layerId, override]) => [layerId, { merged: override }])) }
      : prototypeEdits
    if (mergedDesign) setPrototypeEdits(nextPrototypeEdits)
    setPreviewProps(nextPreviewProps)
    setPreviewVersion((v) => v + 1)
    setConflicts(resolvedConflicts)
    if (item) updateMergeItem(item.id, { tag: 'Merged', conflictLevel: 'None', updatedLabel: 'Just now' })
    setDraftChanges((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !Object.hasOwn(finalFiles, id))))
    const title = conflict?.mergeTitle ?? `Merged ${item?.title ?? conflict?.title}`
    const historyFileId = conflict?.fileId ?? item?.fileIds?.[0] ?? activeFileId
    const historyLines = finalFiles[historyFileId]
      ?? Object.values(finalFiles).find(Array.isArray)
      ?? fileOverrides[historyFileId]
      ?? files.find((file) => file.id === historyFileId)?.lines
      ?? currentSnapshot().lines
    const historyPreviewSide = conflict ? mergedSideForConflict(conflict) : 'after'
    // A mix of drafts says what it took from which: "Card layout ← Draft A · …".
    const picks = item && draftScreens[item.id] ? regionPicks(item.id, mergedResolutions) : {}
    const picksReason = Object.keys(picks).length
      ? draftScreens[item.id].regions.filter((region) => picks[region.id])
        .map((region) => `${region.label} ← 시안 ${String.fromCharCode(65 + Math.max(0, item.variants.findIndex((variant) => variant.key === picks[region.id])))}`).join(' · ')
      : null
    const historyId = recordHistory({ label: title, kind: 'merge', actorId: currentUser.id, target: conflict?.file ?? item?.title,
      ...(picksReason && !conflict && { reason: picksReason }),
      conflictIds: [...mergedIds],
      timestamp: timeLabel(), approvedBy: [...new Set((related.length ? related.flatMap(requiredReviewers) : item.reviewers ?? []).filter((r) => r.status === 'approved').map((r) => r.id))],
      snapshot: { ...currentSnapshot(), activeFileId: historyFileId, fileId: historyFileId, lines: historyLines,
        files: finalFiles, mergeOutput: output, conflicts: resolvedConflicts, previewProps: nextPreviewProps,
        prototypeEdits: nextPrototypeEdits, activePageId,
        conflictPreview: historyPreviewSide ? conflict?.preview : null,
        previewSide: historyPreviewSide } })
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
    // (Truthy: the checkpoint it saved, for a "View in History" link.)
    return historyId
  }, [conflicts, mergeItems, projectId, fileOverrides, files, draftChanges, previewProps, prototypeEdits, activePageId, setMergedBaseline, setConflicts, updateMergeItem, recordHistory, currentSnapshot, logEvent, appendTerminalLines, setFileOverrides, setDraftChanges, setDsUpdates, setPreviewProps, setPrototypeEdits, currentUser.id])
  const resolveConflict = useCallback((conflictId) => commitMerge({ conflictId }), [commitMerge])
  const completeMerge = useCallback((itemId) => commitMerge({ itemId }), [commitMerge])

  // A review decision lands in its author's Inbox (not yours): "Taylor
  // requested changes on Place order button". Skipped when there's no
  // human author, or you'd be notifying yourself.
  const notifyAuthor = useCallback((conflict, text, kind) => {
    const authorId = authorOf(conflict)
    if (!authorId || authorId === currentUser.id) return
    setNotifications((prev) => [{
      id: nextId('n'),
      kind,
      authorId: currentUser.id,
      recipientId: authorId,
      text,
      timeLabel: 'Just now',
      unread: true,
      target: { conflictId: conflict.id, label: conflict.title },
    }, ...prev])
  }, [currentUser.id, setNotifications])

  // Your own sign-off on a conflict in review (approving never changes
  // code). You approve as yourself only; it moves to Approved when every
  // required reviewer has approved — the same rule batch approval uses.
  const approveConflict = useCallback(
    (conflictId, note) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'in_review') return null
      if (!conflict.reviewers.some((r) => r.id === currentUser.id)) return null
      // (When it was given and what was said with it stay on the sign-off.)
      const reviewers = conflict.reviewers.map((r) => (r.id === currentUser.id ? { ...r, status: 'approved', reviewedAt: Date.now(), note: note?.trim() || undefined } : r))
      const updated = { ...conflict, reviewers, diffInspected: true }
      const next = scheduleDemoReview({ ...updated, reviewStage: allReviewersApproved(updated) ? 'approved' : 'in_review' }, currentUser.id)
      setConflicts((prev) => prev.map((c) => (c.id === conflictId ? next : c)))
      logEvent({ kind: 'approve', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
      notifyAuthor(conflict, `approved ${conflict.title}`, 'approval')
      appendTerminalLines([`$ devsign review approve "${conflict.title}" --as ${currentUser.id}`])
      return next
    },
    [appendTerminalLines, conflicts, logEvent, notifyAuthor, projectId, setConflicts, currentUser.id]
  )

  const requestChanges = useCallback(
    (conflictId, note) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'in_review') return
      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId
            ? { ...c, reviewers: c.reviewers.map((r) => (r.id === currentUser.id ? { ...r, status: 'changes_requested', reviewedAt: Date.now(), note: note?.trim() || undefined } : r)) }
            : c
        )
      )
      logEvent({ kind: 'changes', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
      notifyAuthor(conflict, `requested changes on ${conflict.title}`, 'comment')
    },
    [conflicts, logEvent, notifyAuthor, projectId, setConflicts, currentUser.id]
  )

  // ── Design decisions (a `decisionFlow` conflict, e.g. CON-002) ──────
  // A structural drift isn't settled by picking values: its developer asks
  // the designer for a decision (with the reason, the screen as built, a
  // proposal, how far along the work is and when it should land), the
  // designer decides — keep the design, approve the change, or ask for
  // another look — and when it applies, and the developer then fixes the
  // code, verifies it and resolves the conflict. Every step is a History
  // checkpoint on the conflict (so its Activity tab and History both
  // show the trail) and a project event.
  const recordDecisionStep = useCallback((conflict, { label, kind = 'decision', reason, lines, actorId = currentUser.id }) => {
    const fileId = conflict.fileId ?? activeFileId
    return recordHistory({
      label, kind, actorId, reason, conflictId: conflict.id, ...(kind === 'merge' && { conflictIds: [conflict.id] }),
      target: `${conflict.file?.split('/').pop() ?? conflict.title} · ${conflict.title.split(' / ').pop()}`,
      timestamp: timeLabel(),
      snapshot: { ...currentSnapshot(), activeFileId: fileId, fileId, lines: lines ?? fileOverrides[fileId] ?? files.find((f) => f.id === fileId)?.lines ?? [] },
    })
  }, [activeFileId, currentSnapshot, currentUser.id, fileOverrides, files, recordHistory])

  const notifyPerson = useCallback((recipientId, conflict, text, kind = 'approval', authorId = currentUser.id) => {
    if (!recipientId) return
    setNotifications((prev) => [{
      id: nextId('n'), kind, authorId, recipientId, text, timeLabel: 'Just now', unread: true,
      target: { conflictId: conflict.id, label: conflict.title },
    }, ...prev])
  }, [currentUser.id, setNotifications])

  // The developer asks: the conflict goes to review with the designer.
  const requestDesignDecision = useCallback((conflictId, request) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict) return
    const round = (conflict.decisionRequest?.round ?? 0) + 1
    const record = { ...request, by: currentUser.id, at: timeLabel(), sentAt: Date.now(), round }
    const designerId = conflict.reviewers[0]?.id ?? 'jane'
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
      ...c,
      decisionRequest: record,
      designDecision: null,
      decisionFix: null,
      reviewStage: 'in_review',
      requestedBy: currentUser.id,
      reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending' })),
    })))
    logEvent({ kind: 'decision_requested', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    notifyPerson(designerId, conflict, `디자인 결정을 요청했어요 · ${conflict.id} ${conflict.title}`)
    recordDecisionStep(conflict, { label: `${conflict.id} 디자인 결정 요청${round > 1 ? ` (${round}차)` : ''} · ${PROPOSAL_LABEL[request.proposal] ?? '수정안'}`, reason: request.reason })
  }, [conflicts, currentUser.id, logEvent, notifyPerson, projectId, recordDecisionStep, setConflicts])

  // The designer decides. Keep / approve settle it (the reviewer signs
  // off); asking for another look sends it back to the developer.
  const decideDesign = useCallback((conflictId, decision, { actorId = currentUser.id } = {}) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict) return
    const settled = decision.choice !== 'rework'
    // (`scripted`: played by the walkthrough for the other side.)
    const record = { ...decision, by: actorId, at: timeLabel(), decidedAt: Date.now(), ...(actorId !== currentUser.id && { scripted: true }) }
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
      ...c,
      designDecision: record,
      reviewStage: settled ? 'approved' : 'in_review',
      reviewers: c.reviewers.map((r) => (r.id === actorId ? { ...r, status: settled ? 'approved' : 'changes_requested', reviewedAt: Date.now(), note: decision.reason } : r)),
    })))
    logEvent({ kind: 'decided', projectId, conflictId, actorId, title: conflict.title })
    if (actorId === currentUser.id) notifyPerson(conflict.decisionRequest?.by ?? authorOf(conflict), conflict, `${DECISION_LABEL[decision.choice]} · ${TIMING_LABEL[decision.timing] ?? ''} — ${conflict.title}`, 'comment')
    recordDecisionStep(conflict, { label: `디자인 결정: ${DECISION_LABEL[decision.choice]} · ${TIMING_LABEL[decision.timing] ?? ''} 반영`, reason: decision.reason, actorId })
  }, [conflicts, currentUser.id, logEvent, notifyPerson, projectId, recordDecisionStep, setConflicts])

  // The developer acts on the decision: the code (and, for an approved
  // change, the design) moves to what was decided.
  const applyDecisionFix = useCallback((conflictId) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    const choice = conflict?.designDecision?.choice
    const fixLine = conflict?.fixes?.[choice]
    if (!conflict || !fixLine || !conflict.fileId || !conflict.line) return
    const base = fileOverrides[conflict.fileId] ?? files.find((f) => f.id === conflict.fileId)?.lines ?? []
    const lines = base.map((line, index) => (index + 1 === conflict.line ? fixLine : line))
    setFileOverrides((prev) => ({ ...prev, [conflict.fileId]: lines }))
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
      ...c, decisionFix: { choice, appliedAt: timeLabel(), designSynced: choice === 'approve', verified: false },
    })))
    logEvent({ kind: 'code_change', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    recordDecisionStep(conflict, {
      kind: 'edit',
      label: choice === 'approve' ? `${conflict.id} 1열 레이아웃 적용 · 디자인 원안 동기화` : `${conflict.id} 코드를 디자인 원안(2열)에 맞춤`,
      reason: conflict.designDecision?.reason,
      lines,
    })
    appendTerminalLines([`$ devsign apply ${conflict.id} --decision ${choice}`, `✓ ${conflict.file} · line ${conflict.line} updated`])
  }, [appendTerminalLines, conflicts, currentUser.id, fileOverrides, files, logEvent, projectId, recordDecisionStep, setConflicts, setFileOverrides])

  const verifyDecisionFix = useCallback((conflictId) => {
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId || !c.decisionFix ? c : { ...c, decisionFix: { ...c.decisionFix, verified: true, verifiedAt: timeLabel() } })))
    appendTerminalLines(['$ devsign verify --breakpoint 768', '✓ cards fit 768px · no overlap', '✓ matches the decided layout'])
  }, [appendTerminalLines, setConflicts])

  const resolveDecision = useCallback((conflictId) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict?.decisionFix?.verified) return null
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {
      ...c, reviewStage: 'resolved', resolved: true, resolvedAtLabel: 'Just now', mergedBy: currentUser.id,
    })))
    logEvent({ kind: 'merge', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    notifyPerson(conflict.designDecision?.by, conflict, `충돌을 해결했어요 · ${conflict.id} ${conflict.title}`, 'comment')
    return recordDecisionStep(conflict, {
      kind: 'merge',
      label: `${conflict.id} 해결 · ${conflict.decisionFix.choice === 'approve' ? '1열 레이아웃' : '디자인 원안 2열'}`,
      reason: `${DECISION_LABEL[conflict.designDecision?.choice] ?? ''} · ${TIMING_LABEL[conflict.designDecision?.timing] ?? ''} 반영 — 검증 완료`,
    })
  }, [conflicts, currentUser.id, logEvent, notifyPerson, projectId, recordDecisionStep, setConflicts])

  // A shared component or token changed along the way: a note for the
  // design system's owners (optional; kept on the conflict).
  const proposeDesignSystemUpdate = useCallback((conflictId, note) => {
    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : { ...c, dsProposal: { note, by: currentUser.id, at: timeLabel() } })))
  }, [currentUser.id, setConflicts])

  // The walkthroughs' other side, played for whoever isn't at the keyboard:
  // the designer's walkthrough starts with Alex's request already in; the
  // developer's gets Taylor's decision a few seconds after asking.
  useEffect(() => {
    if (isDeveloperViewer) return
    const waiting = conflicts.filter((c) => c.decisionFlow && c.scriptedRequest && !c.decisionRequest && !c.designDecision && c.reviewStage !== 'resolved')
    if (!waiting.length) return
    setConflicts((prev) => prev.map((c) => (!waiting.some((w) => w.id === c.id) ? c : {
      ...c, decisionRequest: { ...c.scriptedRequest, round: 1 }, reviewStage: 'in_review', requestedBy: c.scriptedRequest.by,
    })))
    for (const c of waiting) {
      recordDecisionStep(c, { label: `${c.id} 디자인 결정 요청 · ${PROPOSAL_LABEL[c.scriptedRequest.proposal] ?? '수정안'}`, reason: c.scriptedRequest.reason, actorId: c.scriptedRequest.by })
    }
  }, [conflicts, isDeveloperViewer, recordDecisionStep, setConflicts])
  useEffect(() => {
    if (!isDeveloperViewer) return
    const asked = conflicts.filter((c) => c.decisionFlow && c.scriptedDecision && c.decisionRequest?.by === currentUser.id && c.decisionRequest.sentAt && !c.designDecision)
    if (!asked.length) return
    const timer = window.setTimeout(() => {
      for (const c of asked) {
        const decision = { ...c.scriptedDecision, timing: c.decisionRequest.timing ?? 'before-release' }
        decideDesign(c.id, decision, { actorId: c.scriptedDecision.by })
        const designer = teamMembers.find((p) => p.id === c.scriptedDecision.by)?.name ?? 'The designer'
        notifyPerson(currentUser.id, c, `${DECISION_LABEL[decision.choice]} · ${TIMING_LABEL[decision.timing]} — ${c.title}`, 'comment', c.scriptedDecision.by)
        toast(`${designer}님이 결정했어요: ${DECISION_LABEL[decision.choice]}`, { description: `${c.id} · ${TIMING_LABEL[decision.timing]} 반영`, action: { label: '결정 보기', onClick: () => openConflictReview(c.id, { view: 'overlay' }) } })
      }
    }, Math.max(0, Math.min(...asked.map((c) => c.decisionRequest.sentAt)) + DECISION_REPLY_MS - Date.now()))
    return () => window.clearTimeout(timer)
  }, [conflicts, currentUser.id, decideDesign, isDeveloperViewer, notifyPerson, openConflictReview])

  // A merged conflict is history, not a draft — real tools never flip it
  // back to "open" in place (its merge commit already happened). Reverting
  // it is its own new change: a fresh Conflict Point proposing the inverse
  // edit, with its own review from scratch, left permanently linked back
  // to what it reverts. The original stays exactly as merged.
  const revertConflict = useCallback(
    (conflictId) => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict || conflict.reviewStage !== 'resolved') return
      const invertedDiff = conflict.diff && { before: conflict.diff.after, after: conflict.diff.before }
      const invertedFields = conflict.comparisonFields?.map((field) => conflict.decidedSide === 'B'
        ? { ...field }
        : { ...field, expected: field.current, current: field.expected })
      const revert = {
        ...conflict,
        id: `revert-${crypto.randomUUID()}`,
        title: conflict.title.replace(/^(?:Revert: )+/, ''),
        message: `Cancels the merge of ${conflict.title.replace(/^(?:Revert: )+/, '')}.`,
        reviewStage: 'detected',
        diffInspected: false,
        resolved: false,
        resolvedAtLabel: undefined,
        mergedBy: undefined,
        detectedAt: timeLabel(),
        timestamp: 'Just now',
        reviewers: conflict.reviewers.map((r) => ({ ...r, status: 'pending', demoApproveAt: undefined })),
        diff: invertedDiff,
        comparisonFields: invertedFields,
        revertOf: conflict.id,
      }
      setConflicts((prev) => [...prev, revert])
      const item = mergeItems.find((mi) => mi.id === conflict.mergeItemId || mi.conflictId === conflict.id)
      if (item?.tag === 'Merged') updateMergeItem(item.id, { tag: 'Needs Review', updatedLabel: 'Just now' })
      logEvent({ kind: 'revert', projectId, conflictId: revert.id, actorId: currentUser.id, title: revert.title })
      appendTerminalLines([`$ devsign revert "${conflict.title}" --as-new-review`])
      return revert
    },
    [appendTerminalLines, conflicts, logEvent, mergeItems, projectId, setConflicts, updateMergeItem, currentUser.id]
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
    (entryId, { conflicts: restoreConflicts = true, agentMemory = false, reason = null } = {}) => {
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
      if (agentMemory) setWorkspaceChat((prev) => prev.slice(0, keep))
      setSelectedLayerId(snapshot.selectedLayerId ?? null)

      const restoredId = recordHistory({
        label: `Restored: ${entry.label.replace(/^Restored: /, '')}`,
        kind: 'rollback',
        actorId: currentUser.id,
        target: entry.target,
        timestamp: timeLabel(),
        restoredFrom: entry.id,
        // A rollback departs from what was merged, so it carries its reason.
        ...(reason ? { reason } : {}),
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

  // What rolling back to a checkpoint would touch beyond your own work
  // (see lib/rollbackImpact) — the rollback dialog reads this to decide
  // between "roll back and share" and "ask the people it affects first".
  const rollbackImpactFor = useCallback((entryId) => {
    const entry = historyEntries.find((h) => h.id === entryId)
    return rollbackImpact({ entries: historyEntries, entryId, viewerId: currentUser.id, viewers: entry ? getViewersForFile(entry.snapshot.fileId) : [] })
  }, [historyEntries, currentUser.id, getViewersForFile])

  // A rollback that touches other people isn't run — it's put on the
  // Conflict list as an agreement: what's being rolled back, who it
  // affects, and whether each of them has confirmed. The affected people
  // are its reviewers, so confirming is the usual approval, and the
  // rollback itself (`runAgreedRollback`) is its final step.
  const requestRollbackAgreement = useCallback((entryId, options = {}) => {
    const entry = historyEntries.find((h) => h.id === entryId)
    const impact = rollbackImpactFor(entryId)
    if (!entry || !impact.needsAgreement) return null
    const irreversible = impact.reasons.some((reason) => reason.id === 'irreversible')
    const fileName = files.find((f) => f.id === entry.snapshot.fileId)?.name ?? entry.target?.split(' · ')[0] ?? entry.label
    const record = scheduleDemoReview(toConflictRecord({
      id: `rollback-${crypto.randomUUID()}`,
      // Short: the component it rolls back, not the checkpoint's sentence.
      title: `Rollback · ${fileName.replace(/\.[a-z]+$/i, '')}`,
      file: fileName,
      fileId: entry.snapshot.fileId,
      projectId,
      severity: irreversible ? 'high' : 'medium',
      changedBy: { type: 'person', id: currentUser.id, what: 'Requested this rollback' },
      detectedBy: 'Rollback impact check',
      reviewStage: 'in_review',
      requestedBy: currentUser.id,
      reviewers: impact.affected.map((id) => ({ id, status: 'pending' })),
      timestamp: 'Just now',
      detectedAt: timeLabel(),
      ...(options.reason ? { decidedBy: currentUser.id, deviation: { kind: 'rollback', text: options.reason, by: currentUser.id, at: 'Just now' } } : {}),
      rollback: {
        entryId: entry.id, label: entry.label, target: fileName, timestamp: entry.timestamp, options, reasons: impact.reasons,
        component: fileName.replace(/\.[a-z]+$/i, ''), requestedBy: currentUser.id,
        // The values it changes, now → after the rollback.
        changes: rollbackChanges(diffLines(linesOfFile(entry.snapshot.fileId), entry.snapshot.lines ?? [])),
      },
    }), currentUser.id)
    setConflicts((prev) => [...prev, record])
    logEvent({ kind: 'review_requested', projectId, conflictId: record.id, actorId: currentUser.id, title: record.title })
    appendTerminalLines([`$ devsign rollback --to "${entry.label}" --request-agreement`, `· waiting on ${impact.affected.length} affected`])
    return record
  }, [historyEntries, rollbackImpactFor, files, linesOfFile, projectId, currentUser.id, setConflicts, logEvent, appendTerminalLines])

  // Everyone affected has confirmed: run the rollback and close the record.
  const runAgreedRollback = useCallback((conflictId) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict?.rollback || conflict.reviewStage !== 'approved') return null
    const restoredId = rollbackTo(conflict.rollback.entryId, conflict.rollback.options)
    if (!restoredId) return null
    setConflicts((prev) => prev.map((c) => c.id === conflictId ? { ...c, reviewStage: 'resolved', resolved: true, resolvedAtLabel: 'Just now', mergedBy: currentUser.id } : c))
    logEvent({ kind: 'merge', projectId, conflictId, actorId: currentUser.id, title: conflict.title })
    return restoredId
  }, [conflicts, rollbackTo, setConflicts, logEvent, projectId, currentUser.id])

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
    (scenario, target, trimmed, appliedBy = null) => {
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
                  reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending', demoApproveAt: undefined })),
                  // Preserve AI authorship separately from the person applying the draft.
                  source: 'ai',
                  applicationMode: appliedBy ? 'manual' : 'auto',
                  changedBy: appliedBy
                    ? { type: 'person', id: appliedBy.id, what: scenario.title }
                    : { type: 'ai', what: scenario.title },
                  // What was asked for in the chat is the reason for the
                  // change it produced (lib/rationale) — kept unless the
                  // work already had a purpose.
                  purpose: c.purpose ?? { text: trimmed, by: appliedBy?.id ?? currentUser.id, source: 'ai-chat' },
                }
              : c
          )
        : conflicts
      if (reopened) {
        logEvent({
          kind: 'code_change',
          projectId,
          conflictId: reopened.id,
          actorId: appliedBy?.id ?? 'system',
          title: reopened.title,
          detail: scenario.title,
        })
      }

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
      const nextPrototypeEdits = derivedOverride ? { ...prototypeEdits, ...derivedOverride } : prototypeEdits
      if (derivedOverride) setPrototypeEdits(nextPrototypeEdits)
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
        ...(reopened ? { conflictIds: [reopened.id] } : {}),
        actorId: appliedBy?.id ?? 'system',
        actorLabel: appliedBy?.name ?? 'Devsign AI',
        source: 'ai',
        applicationMode: appliedBy ? 'manual' : 'auto',
        target: target?.label ?? changes.map((c) => c.fileName).join(', '),
        prompt: trimmed,
        timestamp: timeLabel(),
        snapshot: {
          activeFileId: scenario.fileId,
          fileId: scenario.fileId,
          lines: scenario.lines,
          activePageId,
          prototypeEdits: nextPrototypeEdits,
          previewProps: nextPreviewProps,
          conflicts: nextConflicts,
          selectedLayerId,
          chatLength: chatLengthRef.current + 1,
        },
      })

      return { result, historyId, reply: scenario.reply }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendTerminalLines, activePageId, logEvent, prototypeEdits, projectId, recordHistory, selectedLayerId]
  )

  const sendChatMessage = useCallback(
    (text, target = null, options = {}) => {
      const trimmed = text.trim()
      if (!trimmed || chatGeneration.current) return
      const generation = { timer: null }
      chatGeneration.current = generation
      const finish = () => {
        chatGeneration.current = null
        setIsAiTyping(false)
      }
      // Every write below goes to the thread this was asked in.
      const setChatMessages = setChatMessagesFor(chatThread)

      if (options.includeUser !== false) setChatMessages((prev) => [...prev, { id: nextId('m'), role: 'user', text: trimmed, target }])
      const appendAssistant = (message) => setChatMessages((prev) => {
        if (options.replaceMessageId) {
          const index = prev.findIndex((entry) => entry.id === options.replaceMessageId)
          if (index >= 0) return prev.map((entry, i) => i === index ? { ...message, id: entry.id } : entry)
        }
        return [...prev, message]
      })
      setIsAiTyping(true)

      const mergeAnswer = chatThreadItem ? mergeChatAnswer(chatThreadItem, itemConflicts(chatThreadItem, conflicts), trimmed, currentUser.id) : null
      const mergeReply = typeof mergeAnswer === 'string' ? mergeAnswer : mergeAnswer?.text ?? null
      const documentReply = mergeReply ?? (target?.kind === 'document' ? answerDocumentQuestion(allReferenceDocs.find((doc) => doc.id === target.docId), trimmed) : null)
      const answer = forProject(chatSuggestions, projectId).find((q) => q.reply && [q.prompt, translateText(q.prompt, 'ko')].some((prompt) => prompt.toLowerCase() === trimmed.toLowerCase()))
      const lower = trimmed.toLowerCase()
      const scenario = forProject(aiEditScenarios, projectId).find((s) => s.keywords.some((k) => lower.includes(k))) ?? null
      const fits = scenario && scenarioFitsTarget(scenario, target)

      generation.timer = window.setTimeout(() => {
        if (chatGeneration.current !== generation) return
        if (documentReply) {
          finish()
          appendAssistant({
            id: nextId('m'),
            role: 'assistant',
            text: documentReply,
            ...(!mergeReply && { target }),
            ...(mergeAnswer?.commentDraft && { commentDraft: mergeAnswer.commentDraft }),
          })
          return
        }
        if (answer) {
          finish()
          appendAssistant({ id: nextId('m'), role: 'assistant', text: answer.reply, summary: answer.summary })
          return
        }
        if (!scenario || !fits) {
          finish()
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
          finish()
          appendAssistant({ id: nextId('m'), role: 'assistant', text: 'I couldn’t apply this change. Try rephrasing the request, or edit the target directly in Assemble.', result: { status: 'failed', target } })
          return
        }
        if (signature(currentLines) === signature(scenario.lines) && Object.entries(scenario.previewProps ?? {}).every(([key, value]) => signature(live.previewProps[key]) === signature(value))) {
          finish()
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

        generation.timer = window.setTimeout(() => {
          if (chatGeneration.current !== generation) return
          finish()
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
    [allReferenceDocs, chatThread, chatThreadItem, commitAiScenario, conflicts, currentUser.id, fileOverrides, previewProps, projectId, setChatMessagesFor]
  )

  // Commits a proposal the person approved: same write path as Auto mode's
  // immediate apply, just deferred until now. Updates the message in place
  // (status pending → done) rather than appending a new one.
  const applyPendingAiEdit = useCallback(
    (messageId) => {
      const message = chatMessages.find((m) => m.id === messageId)
      if (!message?.pendingEdit) return
      const { scenario, target, trimmed } = message.pendingEdit
      const { result, historyId, reply } = commitAiScenario(scenario, target, trimmed, currentUser)
      setChatMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: reply, result, historyId, pendingEdit: null } : m)))
    },
    [chatMessages, commitAiScenario, setChatMessages, currentUser]
  )

  // Declines a proposal: nothing was ever written (files/canvas/History all
  // untouched), so this only has to relabel the message.
  const discardPendingAiEdit = useCallback((messageId) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, result: { ...m.result, status: 'discarded' }, pendingEdit: null } : m))
    )
  }, [setChatMessages])

  // An AI-written note headed for a conflict's Comments box (see
  // mergeChat's review-request draft): opens that conflict's review in the
  // bottom panel and hands the text to its comment composer to send.
  const [commentDraftRequest, setCommentDraftRequest] = useState(null)
  const draftCommentFromChat = useCallback(({ conflictId, text }) => {
    setBottomPanel({ open: true, tab: 'conflict' })
    setReviewConflictId(conflictId)
    setCommentDraftRequest({ conflictId, text, nonce: nextId('comment-draft') })
  }, [setBottomPanel])

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
      let affected = []
      let nextConflicts = conflicts
      let snapshotPrototypeEdits = prototypeEdits
      if (!live) {
        const changedLines = new Set(Array.from({ length: Math.max(before.length, lines.length) }, (_, i) => i + 1).filter((n) => before[n - 1] !== lines[n - 1]))
        affected = conflicts.filter((c) => {
          const span = designMergeVariants[c.mergeItemId]?.layerCodeMap?.[c.layerId]
          const start = span?.line ?? c.line
          return (span?.fileId ?? c.fileId) === fileId && (!start || Array.from({ length: span?.span ?? 1 }, (_, i) => start + i).some((n) => changedLines.has(n)))
        })
        const ids = new Set(affected.map((c) => c.id))
        nextConflicts = conflicts.map((c) => ids.has(c.id)
          ? { ...c, reviewStage: c.reviewers.length ? 'in_review' : 'detected', reviewers: c.reviewers.map((r) => ({ ...r, status: 'pending', demoApproveAt: undefined })) }
          : c)
        setConflicts(nextConflicts)
        for (const conflict of affected) {
          logEvent({ kind: 'code_change', projectId, conflictId: conflict.id, actorId: currentUser.id, title: conflict.title })
        }
        for (const c of affected) if (c.mergeItemId) updateMergeItem(c.mergeItemId, { tag: 'In Review' })
        setDraftChanges((prev) => ({ ...prev, [fileId]: { title: 'Code edited' } }))
      }
      // Code → canvas: a prototype file is parsed back into the canvas
      // model rather than stored as text.
      if (prototypeFile(fileId)) {
        const parsed = parsePrototype(fileId, lines)
        snapshotPrototypeEdits = { ...prototypeEdits, ...parsed }
        setPrototypeEdits((prev) => ({ ...prev, ...parsed }))
      } else {
        if (live) return
        setFileOverrides((prev) => ({ ...prev, [fileId]: lines }))
        // Same reasoning as sendChatMessage's AI edits: a hand-edited real
        // component file (not a generated prototype file) has no other
        // path back to the canvas at all otherwise.
        const derivedOverride = deriveComponentOverride(projectId, fileId, lines)
        if (derivedOverride) snapshotPrototypeEdits = { ...prototypeEdits, ...derivedOverride }
        if (derivedOverride) setPrototypeEdits((prev) => ({ ...prev, ...derivedOverride }))
      }
      if (!live && affected.length) {
        recordHistory({
          label: `Code update · ${getFileName(fileId)}`,
          kind: 'edit',
          actorId: currentUser.id,
          target: getFileName(fileId),
          conflictIds: affected.map((conflict) => conflict.id),
          timestamp: timeLabel(),
          snapshot: {
            ...currentSnapshot(),
            activeFileId: fileId,
            fileId,
            lines,
            files: { [fileId]: lines },
            prototypeEdits: snapshotPrototypeEdits,
            conflicts: nextConflicts,
          },
        })
      }
      setPreviewVersion((v) => v + 1)
      if (!live) appendTerminalLines([`[HMR] ${getFileName(fileId)} updated`])
    },
    [appendTerminalLines, currentSnapshot, currentUser.id, getFileName, logEvent, projectId, prototypeEdits, recordHistory, setPrototypeEdits, setFileOverrides, fileOverrides, files, conflicts, setConflicts, updateMergeItem, setDraftChanges]
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
    if (target?.conflictId) {
      const conflict = conflicts.find((candidate) => candidate.id === target.conflictId)
      if (conflict) {
        logEvent({
          kind: 'comment',
          projectId,
          conflictId: conflict.id,
          actorId: currentUser.id,
          title: conflict.title,
          detail: trimmed,
        })
      }
    }
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
  }, [conflicts, currentUser.id, logEvent, projectId])

  // Where on the Workspace canvas a notification's target is: the page (the
  // canvas tab), the frame, and the point — from the element it names on a
  // merge item's design page, or from coordinates it carries itself. Null
  // when there's nothing to go to (a target on an item this project doesn't
  // have, or one that names a file or a conflict rather than an element) —
  // the Inbox hides "Show on canvas" then.
  const canvasLocationFor = useCallback((target) => {
    if (!target || target.conflictId) return null
    if (target.pageId && target.x != null && target.y != null) return { pageId: target.pageId, x: target.x, y: target.y }
    if (!target.layerId) return null
    // The element's own page: the merge item's design page when this
    // project has that item, otherwise whichever canvas page has the element.
    const item = mergeItems.find((m) => m.id === target.itemId)
    const itemPage = item && projectPages.find((candidate) => candidate.id === item.designPageId)
    for (const page of [itemPage, ...projectPages].filter(Boolean)) {
      for (const frame of page.frames ?? []) {
        const layer = frame.layers.find((candidate) => candidate.id === target.layerId)
        // The pin sits on the element's top edge, centered.
        if (layer) return { pageId: page.id, frameId: frame.id, layerId: layer.id, x: frame.x + layer.x + layer.width / 2, y: frame.y + layer.y }
      }
    }
    return null
  }, [mergeItems, projectPages])

  // "Show on canvas" from the Inbox: leave Merge Studio and the Inbox, open
  // that canvas tab, and hand the canvas a focus request — it pans / zooms
  // to the spot (CanvasPanel). A comment gets its pin there, carrying the
  // comment and its replies, so the canvas can open the thread.
  const [canvasFocus, setCanvasFocus] = useState(null)
  const revealOnCanvas = useCallback((notification) => {
    const location = canvasLocationFor(notification.target)
    if (!location) return false
    const commentId = notification.kind === 'comment' ? `pin-${notification.id}` : null
    if (commentId) {
      const pin = {
        id: commentId, authorId: notification.authorId, timeLabel: notification.timeLabel, text: notification.text,
        status: 'open', likes: 0, replies: notification.replies?.length ?? 0, thread: notification.replies ?? [],
        target: { type: 'canvas', pageId: location.pageId, x: location.x, y: location.y },
      }
      setComments((prev) => (prev.some((comment) => comment.id === commentId) ? prev.map((comment) => (comment.id === commentId ? pin : comment)) : [...prev, pin]))
    }
    exitMergeStudio()
    setMergeDrawer(null)
    setActivePageId(location.pageId)
    setCanvasFocus({ ...location, commentId, nonce: nextId('canvas-focus') })
    return true
  }, [canvasLocationFor, exitMergeStudio])

  // Dismissing a reviewer's change request (GitHub's "Dismiss review"):
  // never silent — it needs a reason, which is posted to the conflict's
  // Comments and logged to its History. The reviewer stays on the change,
  // back to pending, so their sign-off is still required.
  const dismissChangeRequest = useCallback((conflictId, reviewerId, reason) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    const trimmed = reason.trim()
    if (!conflict || !trimmed) return
    const reviewer = conflict.reviewers.find((r) => r.id === reviewerId && r.status === 'changes_requested')
    if (!reviewer) return
    const name = allPeople.find((p) => p.id === reviewerId)?.name ?? reviewerId
    setConflicts((prev) => prev.map((c) => (c.id === conflictId
      ? { ...c, reviewers: c.reviewers.map((r) => (r.id === reviewerId ? { ...r, status: 'pending', demoApproveAt: undefined, dismissedAt: 'Just now' } : r)) }
      : c)))
    logEvent({ kind: 'dismiss', projectId, conflictId, actorId: currentUser.id, title: conflict.title, detail: `${name}: ${trimmed}` })
    setComments((prev) => [
      ...prev,
      {
        id: nextId('comment'),
        authorId: currentUser.id,
        timeLabel: 'Just now',
        text: `Dismissed ${name}'s change request: ${trimmed}`,
        status: 'open',
        likes: 0,
        replies: 0,
        target: { conflictId },
      },
    ])
  }, [conflicts, currentUser.id, logEvent, projectId, setConflicts])

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
    dismissChangeRequest,
    revertConflict,
    batchApproveConflicts,
    projectPages,
    memberViewports,
    updateConflict,
    restartConflict,
    createMergeRequest,
    reviewConflictId,
    reviewView,
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
    openConflictReview,
    focusChange,
    chatDraft,
    setChatDraft,
    chatTargetOverride,
    setChatTargetOverride,
    chatMessages,
    chatThread,
    chatThreadItem,
    openMergeItem,
    commentDraftRequest,
    draftCommentFromChat,
    isAiTyping,
    sendChatMessage,
    stopChatGeneration,
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
    rollbackImpactFor,
    requestRollbackAgreement,
    runAgreedRollback,
    archiveHistoryEntry,
    restoreHistoryEntry,
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
    saveMergeDraft,
    decisionsFor,
    decideDrift,
    setStudioDecisions,
    setLayerAdjustments,
    setManualCode,
    draftVersion,
    conflictChecks,
    linesOfFile,
    designCompareRequest,
    setDesignCompareRequest,
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
    requestDesignDecision,
    decideDesign,
    applyDecisionFix,
    verifyDecisionFix,
    resolveDecision,
    proposeDesignSystemUpdate,
    mergeDrawer,
    setMergeDrawer,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    replyToNotification,
    mergeFocus,
    requestMergeFocus,
    checkGuide,
    setCheckGuide,
    canvasLocationFor,
    revealOnCanvas,
    canvasFocus,
    historyDrawerRequest,
    requestHistoryDrawer,
    conflictDrawerRequest,
    openConflictFromNotification,
    mergePreviewOpen,
    setMergePreviewOpen,
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
