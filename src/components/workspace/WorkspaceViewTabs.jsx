import { cn } from 'cn'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { VIEWS, VIEW_LABEL } from '@/lib/viewLink'
import { conflictCounts } from '@/lib/conflicts'
import { useWorkspace } from '@/state/WorkspaceProvider'

export const VIEW_PANEL_ID = 'workspace-view-panel'
export const viewTabId = (view) => `workspace-view-tab-${view}`
// (Said here rather than through the dictionary: "Screens" already means something else there — the screens a change affects.)
const VIEW_NAME = { en: { ...VIEW_LABEL, merge: 'Merge' }, ko: { preview: '미리보기', screens: '화면', code: '코드', merge: '병합' } }
// (Preview · Screens · Code · Merge — Merge is Merge Studio, in the same shell.)
const TABS = [...VIEWS, 'merge']
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

// The Workspace's three views — Preview · Screens · Code — as the tabs of
// its main window: the same three for every project, the one showing marked
// by more than its color (a filled pill, heavier type, a bar under it).
// ← / → move along them, Enter or Space shows the one in focus, and the
// focus stays on the tab. ⌥1 / ⌥2 / ⌥3 go straight to each (the layout's
// shortcut; ⌘ with a digit is the browser's own).
// `editing`: Screens is showing a screen on the canvas rather than the board
// — pressing Screens again goes back to the board (`onBoard`). Nothing else
// sits in the row: no page or file tabs, no back button.
function WorkspaceViewTabs({ editing = false, onBoard }) {
  const { workspaceView, setWorkspaceView, activeView, openMergeStudio, exitMergeStudio, conflicts } = useWorkspace()
  const merging = activeView === 'mergeStudio'
  const unresolved = conflictCounts(conflicts).open
  const show = (view) => {
    if (view === 'merge') { if (!merging) openMergeStudio(); return }
    if (merging) exitMergeStudio()
    setWorkspaceView(view)
  }
  const language = useLanguage()
  const names = VIEW_NAME[language] ?? VIEW_NAME.en
  function onKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step || event.altKey || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
    tabs[(tabs.indexOf(document.activeElement) + step + tabs.length) % tabs.length]?.focus()
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div role="tablist" aria-label="Workspace view" data-workspace-views onKeyDown={onKeyDown} className="flex h-8 shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
        {TABS.map((view, index) => {
          const selected = view === 'merge' ? merging : !merging && view === workspaceView
          return (
            <button
              key={view}
              type="button"
              role="tab"
              id={viewTabId(view)}
              data-workspace-view-tab={view}
              aria-selected={selected}
              aria-controls={VIEW_PANEL_ID}
              tabIndex={selected ? 0 : -1}
              title={view === 'screens' && selected && editing ? translateText('Back to the board', language) : `${names[view]} · ${MAC ? '⌥' : 'Alt+'}${index + 1}`}
              translate="no"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => (view === 'screens' && selected && editing ? onBoard?.() : show(view))}
              className={cn(
                'relative flex h-7 items-center rounded-md px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
                selected ? 'bg-white/[0.12] font-semibold text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              )}
            >
              {names[view]}
              {view === 'merge' && unresolved > 0 && <span data-merge-count className="ml-1.5 text-xs font-normal tabular-nums opacity-70">{unresolved}</span>}
              {selected && <span aria-hidden className="absolute inset-x-2.5 bottom-0.5 h-0.5 rounded-full bg-white/80" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default WorkspaceViewTabs
