import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The path at the top of a page — one component for every page that has one
// (History, Docs, a change's detail), so they read alike.
//
// Everything in it is one size (the body's small text: 14px on a 20px line):
// a parent, the page you're on, the chevrons between them and the meta after
// them differ in weight and color only.
//   · a parent is a link (`to`) or a button (`onClick`) — the muted text
//     color, the text color and an underline on hover or focus; without
//     either it's plain text (a category that has no page of its own);
//   · the last item is the page you're on: medium weight, the text color,
//     `aria-current="page"`, never a link;
//   · `meta` follows, fainter, set off by space (a count, an info icon — its
//     icons at the text's size).
// Each piece is centered on the line (Latin and Hangul come from different
// faces — Geist has no Hangul — so their boxes are made the same height
// rather than left to their baselines). When there's no room the parents
// give way first, from the middle — each truncates, its full name on hover —
// and the page you're on last.
//
// `BREADCRUMB_BAR`: the bar it sits in — one height and one inset wherever
// it's used.
export const BREADCRUMB_BAR = 'flex h-11 shrink-0 items-center gap-3 border-b px-6'

const ITEM = 'block min-w-0 truncate rounded-sm leading-5'
const PARENT = 'text-muted-foreground'
const LINK = 'transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none underline-offset-4'

// `items`: `{ label, to?, onClick?, key? }`, the page you're on last.
// `translate`: labels are app words to translate (the default); a name that
// is the user's own (a project, a document) sets `{ translate: false }`.
export default function Breadcrumb({ items = [], meta = null, className }) {
  const language = useLanguage()
  const last = items.length - 1
  return (
    <nav aria-label={translateText('Path', language)} data-breadcrumb className={cn('flex min-w-0 items-center gap-3 text-sm leading-5', className)}>
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((item, index) => {
          const current = index === last
          const text = item.translate === false ? <span translate="no">{item.label}</span> : <LocalizedText text={item.label} />
          // Parents give way before the page you're on; the middle ones first.
          const style = { flexShrink: current ? 1 : index === 0 ? 100 : 1000 }
          return (
            <Fragment key={item.key ?? `${index}:${item.label}`}>
              {index > 0 && <li aria-hidden role="presentation" className="flex shrink-0 items-center text-muted-foreground/60"><ChevronRight className="size-3.5" /></li>}
              <li data-breadcrumb-item={current ? 'current' : 'parent'} className="flex min-w-0 items-center" style={style}>
                {current ? (
                  <span aria-current="page" title={item.label} className={cn(ITEM, 'font-medium text-foreground')}>{text}</span>
                ) : item.to ? (
                  <Link to={item.to} title={item.label} className={cn(ITEM, PARENT, LINK)}>{text}</Link>
                ) : item.onClick ? (
                  <button type="button" onClick={item.onClick} title={item.label} className={cn('ds-intrinsic', ITEM, PARENT, LINK)}>{text}</button>
                ) : (
                  <span title={item.label} className={cn(ITEM, PARENT)}>{text}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
      {meta && <div data-breadcrumb-meta className="flex shrink-0 items-center gap-1.5 text-muted-foreground/70">{meta}</div>}
    </nav>
  )
}
