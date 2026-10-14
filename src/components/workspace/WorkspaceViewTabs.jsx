import { cn } from 'cn'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'
import { VIEWS, VIEW_LABEL } from '@/lib/viewLink'
import { useWorkspace } from '@/state/WorkspaceProvider'

export const VIEW_PANEL_ID = 'workspace-view-panel'
export const viewTabId = (view) => `workspace-view-tab-${view}`
// (Said here rather than through the dictionary: "Screens" already means something else there — the screens a change affects.)
const VIEW_NAME = { en: VIEW_LABEL, ko: { preview: '미리보기', screens: '화면', code: '코드' } }
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
// `disabled`: the Design Compare comparison has the canvas's place — the tabs show, dimmed, and wait for it to go.
function WorkspaceViewTabs({ editing = false, disabled = false, onBoard }) {
  const { workspaceView, setWorkspaceView } = useWorkspace()
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
      <div role="tablist" aria-label="Workspace view" data-workspace-views aria-disabled={disabled || undefined} onKeyDown={onKeyDown} className={cn('flex h-8 shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5', disabled && 'opacity-45')}>
        {VIEWS.map((view, index) => {
          const selected = view === workspaceView
          return (
            <button
              key={view}
              type="button"
              role="tab"
              id={viewTabId(view)}
              data-workspace-view-tab={view}
              aria-selected={selected}
              disabled={disabled}
              aria-controls={VIEW_PANEL_ID}
              tabIndex={selected ? 0 : -1}
              title={disabled ? translateText('Back to the canvas to switch views', language) : view === 'screens' && selected && editing ? translateText('Back to the board', language) : `${names[view]} · ${MAC ? '⌥' : 'Alt+'}${index + 1}`}
              translate="no"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => (view === 'screens' && selected && editing ? onBoard?.() : setWorkspaceView(view))}
              className={cn(
                'relative flex h-7 items-center rounded-md px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed',
                selected ? 'bg-white/[0.12] font-semibold text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              )}
            >
              {names[view]}
              {selected && <span aria-hidden className="absolute inset-x-2.5 bottom-0.5 h-0.5 rounded-full bg-white/80" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default WorkspaceViewTabs
