import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The path at the top of a page — the one component for every page that has
// one (the project's dashboard, History, Docs, a change's detail), so they
// are the same thing in the same place.
//
// Its look is the project dashboard's "Dashboard › Dashboard Redesign", value
// for value (that page's path was the first, and is the reference):
//   · everything is the small text — 12px on a 16px line, regular weight —
//     with 8px between every piece;
//   · a parent is `slate-400`, white on hover or focus: a link (`to`) or a
//     button (`onClick`); without either, plain text;
//   · between them a 12px chevron, in the parents' color;
//   · the last item is the page you're on: white, `aria-current="page"`,
//     never a link;
//   · `meta` follows the path, set off by space, fainter — its icons the
//     chevron's size.
// When there's no room the parents give way first, the middle ones before
// the first, each truncating with its full name on hover; the page you're on
// goes last.
//
// `BreadcrumbBar`: where it sits — the reference page's own top row: the
// centered page column (1180px at most, its side padding), 32px down, a row
// 32px tall. Every page's path starts at the same x and y through it; what
// else the row holds (a count, a Close button) goes in as children.

const ITEM = 'block min-w-0 truncate rounded-sm'
const LINK = 'transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none'

export const BREADCRUMB_COLUMN = 'mx-auto w-full max-w-[1180px] px-6 sm:px-10'

// `rowClassName`: the row's own classes (its height), where a page sets the bar differently.
export function BreadcrumbBar({ children, className, rowClassName, ...props }) {
  return (
    <div data-breadcrumb-bar className={cn('shrink-0 pt-8', className)} {...props}>
      <div data-breadcrumb-row className={cn(BREADCRUMB_COLUMN, 'flex h-8 min-w-0 items-center gap-2', rowClassName)}>{children}</div>
    </div>
  )
}

// The crumbs every project page starts with: the dashboard, then the project
// (a link — or, with `current`, the page you're on).
export function projectCrumbs(project, { current = false } = {}) {
  return [
    { label: 'Dashboard', to: '/dashboard' },
    { label: project?.name ?? '', translate: false, key: `project:${project?.id}`, ...(!current && { to: `/projects/${project?.id}` }) },
  ]
}

// `items`: `{ label, to?, onClick?, key?, translate? }`, the page you're on
// last (with an `onClick` it's a button, still marked as where you are). Labels are app words to translate; a name that is the user's own (a
// project, a document, a change) sets `translate: false`.
export default function Breadcrumb({ items = [], meta = null, className }) {
  const language = useLanguage()
  const last = items.length - 1
  return (
    <nav aria-label={translateText('Path', language)} data-breadcrumb className={cn('flex min-w-0 items-center gap-2 text-xs text-slate-400', className)}>
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((item, index) => {
          const current = index === last
          const text = item.translate === false ? <span translate="no">{item.label}</span> : <LocalizedText text={item.label} />
          // Parents give way before the page you're on; the middle ones first.
          const style = { flexShrink: current ? 1 : index === 0 ? 100 : 1000 }
          return (
            <Fragment key={item.key ?? `${index}:${item.label}`}>
              {index > 0 && <li aria-hidden role="presentation" className="flex shrink-0 items-center"><ChevronRight className="size-3" /></li>}
              <li data-breadcrumb-item={current ? 'current' : 'parent'} className="flex min-w-0 items-center" style={style}>
                {current && item.onClick ? (
                  // (Where you are — and pressable, when pressing it does something there.)
                  <button type="button" aria-current="page" onClick={item.onClick} title={item.label} className={cn('ds-intrinsic', ITEM, 'text-white focus-visible:outline-none')}>{text}</button>
                ) : current ? (
                  <span aria-current="page" title={item.label} className={cn(ITEM, 'text-white')}>{text}</span>
                ) : item.to ? (
                  <Link to={item.to} title={item.label} className={cn(ITEM, LINK)}>{text}</Link>
                ) : item.onClick ? (
                  <button type="button" onClick={item.onClick} title={item.label} className={cn('ds-intrinsic', ITEM, LINK)}>{text}</button>
                ) : (
                  <span title={item.label} className={ITEM}>{text}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
      {meta && <div data-breadcrumb-meta className="ml-2 flex shrink-0 items-center gap-1.5 text-slate-500">{meta}</div>}
    </nav>
  )
}
