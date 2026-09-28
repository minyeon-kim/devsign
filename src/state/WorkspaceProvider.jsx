import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  aiEditScenarios,
  canvasPages,
  conflictChecklist,
  designSystemUpdates,
  referenceDocs as staticReferenceDocs,
  comments as seedComments,
  consoleLogLines as seedConsoleLogLines,
  currentUser,
  findCanvasTarget,
  initialChatMessages,
  initialHistoryEntries,
  mergeListItems as seedMergeListItems,
  registerMergeVariants,
  seedMergeNotifications,
  liveMergeNotification,
  openFiles,
  projectFileSets,
  teamMembers,
  terminalLogLines as seedTerminalLogLines,
} from '@/data/mockData'
import { projectConflictRecords, toConflictRecord } from '@/lib/conflicts'
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
  const files = useMemo(() => [...baseFiles, ...PROTOTYPE_FILES, ...importedFiles], [baseFiles, importedFiles])
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
  const [fileOverrides, setFileOverrides] = useState({})
  const [fileNameOverrides, setFileNameOverrides] = useState({})
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [terminalEntries, setTerminalEntries] = useState(() =>
    seedTerminalLogLines.map((text) => ({ id: nextId('t'), text }))
  )
  const [consoleEntries] = useState(() =>
    seedConsoleLogLines.map((text) => ({ id: nextId('c'), text }))
  )
  // This project's conflicts — the list behind the Workspace bottom
  // panel's Conflict Points tab (the one place conflicts are resolved).
  const [conflicts, setConflicts] = useState(() => projectConflictRecords(projectId))
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
  // The floating Files / Layers window (FilesLayersWindow): open or not,
  // and which tab it shows.
  const [filesWindow, setFilesWindowState] = useState({ open: false, tab: 'files' })
  const setFilesWindow = useCallback((patch) => setFilesWindowState((prev) => ({ ...prev, ...patch })), [])
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
  }, [projectId])

  const resolveConflict = useCallback(
    (conflictId) => {
      // Resolved conflicts stay in the list (as Resolved) for the audit
      // trail; only the review workflow's final step calls this.
      setConflicts((prev) => prev.map((c) => (c.id === conflictId ? { ...c, reviewStage: 'resolved' } : c)))
      appendTerminalLines(['$ devsign resolve-conflict', '✓ conflict marked resolved'])
      // A resolved conflict is a design system change: it enters the
      // Design System Update → Documentation → History pipeline.
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (conflict) {
        const update = updateFromConflict(conflict, projectId)
        setDsUpdates((prev) => (prev.some((u) => u.id === update.id) ? prev : [update, ...prev]))
      }
    },
    [appendTerminalLines, conflicts, projectId]
  )

  // Review-workflow edits from the conflict modal (stage, reviewers,
  // diff inspected) — everything short of the final resolve.
  const updateConflict = useCallback((conflictId, patch) => {
    setConflicts((prev) => prev.map((c) => (c.id === conflictId ? { ...c, ...patch } : c)))
  }, [])

  const setActiveFileId = useCallback((fileId) => {
    setActiveFileIdState(fileId)
  }, [])

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
    const sequence = member?.viewportSequence
    if (!sequence?.length) return

    const index = remoteViewportIndex[followedMemberId] ?? 0
    const target = sequence[index]

    setActiveFileIdState(target.fileId)
    setSelectedLayerId(target.layerId ?? null)
  }, [followedMemberId, remoteViewportIndex])

  const recordHistory = useCallback((entry) => {
    const id = nextId('h')
    setHistoryEntries((prev) => [...prev, { archived: false, id, ...entry }])
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

  const rollbackTo = useCallback(
    (entryId) => {
      const entry = historyEntries.find((h) => h.id === entryId)
      if (!entry) return
      const { snapshot } = entry

      setFileOverrides((prev) => ({ ...prev, [snapshot.fileId]: snapshot.lines }))
      setActiveFileIdState(snapshot.activeFileId)
      setPreviewProps(snapshot.previewProps)
      setPreviewVersion((v) => v + 1)
      // Conflict points are review records, not code state: restore the
      // ones this project's list and the snapshot share (e.g. a conflict an
      // AI edit resolved reopens), but never drop or add others — an older
      // snapshot that predates them must not wipe the review trail.
      const snapshotConflicts = new Map((snapshot.conflicts ?? []).map((c) => [c.id, c]))
      setConflicts((prev) => prev.map((c) => snapshotConflicts.get(c.id) ?? c))
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
          ? conflicts.map((c) => (c.id === scenario.resolvesConflictId ? { ...c, reviewStage: 'resolved' } : c))
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
    openConflictReview: setReviewConflictId,
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
