import { useRef } from 'react'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'

export const DOC_TYPES = {
  design: { label: 'Design', tone: 'bg-indigo-500' },
  spec: { label: 'Spec', tone: 'bg-sky-500' },
  doc: { label: 'Guide', tone: 'bg-emerald-500' },
}

// Inline `code` spans inside otherwise plain text.
function RichText({ text }) {
  const language = useLanguage()
  return translateText(text, language).split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    )
  )
}

const CALLOUT_TONES = {
  info: { icon: Info, className: 'border-primary/25 bg-primary/[0.07] text-foreground/85', iconClass: 'text-primary' },
  warning: { icon: AlertTriangle, className: 'border-amber-400/25 bg-amber-400/[0.07] text-foreground/85', iconClass: 'text-amber-400' },
}

function Block({ block }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 id={block.id} className="mt-10 mb-3 scroll-mt-6 text-[17px] font-semibold tracking-tight text-foreground first:mt-0">
          {block.text}
        </h2>
      )
    case 'p':
      return (
        <p className="my-3 text-[14px] leading-7 text-foreground/80">
          <RichText text={block.text} />
        </p>
      )
    case 'ul':
    case 'ol': {
      const List = block.type
      return (
        <List
          className={cn(
            'my-3 space-y-1.5 pl-5 text-[14px] leading-7 text-foreground/80 marker:text-muted-foreground',
            block.type === 'ul' ? 'list-disc' : 'list-decimal'
          )}
        >
          {block.items.map((item) => (
            <li key={item} className="pl-1">
              <RichText text={item} />
            </li>
          ))}
        </List>
      )
    }
    case 'code':
      return (
        <div className="my-4 overflow-hidden rounded-xl border border-white/[0.08] bg-card">
          <div className="px-4 pt-2.5 text-[11px] font-medium text-muted-foreground">{block.language}</div>
          <pre className="overflow-x-auto px-4 pt-1.5 pb-3.5 font-mono text-[12.5px] leading-6 text-foreground/90">
            {block.text}
          </pre>
        </div>
      )
    case 'callout': {
      const tone = CALLOUT_TONES[block.tone] ?? CALLOUT_TONES.info
      const Icon = tone.icon
      return (
        <div className={cn('my-4 flex gap-3 rounded-xl border px-4 py-3 text-[13.5px] leading-6', tone.className)}>
          <Icon className={cn('mt-1 size-4 shrink-0', tone.iconClass)} />
          <p>
            <RichText text={block.text} />
          </p>
        </div>
      )
    }
    case 'table':
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {block.columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')} className="border-t border-white/[0.06]">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-4 py-2.5 text-foreground/80',
                        // The first column is a token / key in code — unless the
                        // table is plain prose (`plain`), e.g. a guide's.
                        ((i === 0 && !block.plain) || i === block.swatchColumn) && 'font-mono text-[12px] text-foreground',
                        i === 0 && block.plain && 'font-medium text-foreground'
                      )}
                    >
                      {i === block.swatchColumn ? (
                        <span className="flex items-center gap-2">
                          <span className="size-3.5 shrink-0 rounded-full ring-1 ring-white/15" style={{ background: cell }} />
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

// A reference doc as a readable, documentation-style page: a quiet header
// (type, title, summary, author, updated), the body at a comfortable
// reading width, and — on wide screens — an "On this page" list built
// from the doc's h2 blocks.
// `path`: the categories it's filed under ("개발 › API") — said in the meta line over the title.
// `frameClassName`: the column the article and its contents list sit in — its own centred one by
// default (a panel).
// `page` (the docs layer): what's read sits in the middle of the layer as one block — the 680px
// article and, when there's room, its contents list 48px beside it (176px, sticky) — so the
// empty space is the same on both sides whether or not the list is there. Under 1100px of
// layer the list folds into the article, which is then centred alone; the article keeps 24px at
// its sides. The width asked is the layer's own (`@container/doc`), not the window's, so
// opening or closing the drawer settles it the same way.
const DOC_FRAME = 'mx-auto flex max-w-5xl gap-8 px-5 py-8 @min-[960px]/doc:px-8 @min-[960px]/doc:py-10'
export const DOC_PAGE_FRAME = 'flex w-full justify-center px-6 pt-6 pb-24'
function ReferenceDocView({ doc, path = [], frameClassName = DOC_FRAME, page = false }) {
  const root = useRef(null)
  const author = allPeople.find((p) => p.id === doc.authorId)
  const type = DOC_TYPES[doc.type] ?? DOC_TYPES.doc
  const sections = doc.blocks.filter((b) => b.type === 'h2')

  function jumpTo(id) {
    Array.from(root.current?.querySelectorAll('[id]') ?? []).find(el => el.id === id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={root} className="@container/doc w-full">
    <div data-doc-frame={page ? 'page' : undefined} className={page ? DOC_PAGE_FRAME : frameClassName}>
      <article data-doc-article className={'min-w-0 max-w-[680px] flex-1'}>
        <header className="mb-8">
          {/* (No path over the title: the sidebar's tree marks where it is. Its categories are a quiet part of
              the meta line, after who and when.) */}
          <h1 className={cn('tracking-tight text-foreground', page ? 'text-[22px] leading-tight font-semibold' : 'text-[20px] leading-tight font-semibold')}>{doc.title}</h1>
          {doc.summary && <p className="mt-1.5 text-[14px] leading-6 text-slate-400">{doc.summary}</p>}
          <div className="mt-4 flex min-w-0 items-center gap-2 text-[12px] text-slate-500">
            {author && (
              <>
                <Avatar size="xs">
                  <AvatarFallback className={cn('text-[10px] font-medium text-white', author.colorClass)}>
                    {author.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground/85">{author.name}</span>
                <span className="text-muted-foreground/50">·</span>
              </>
            )}
            <span className="shrink-0">Updated {doc.updatedAtLabel}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="shrink-0">{type.label}</span>
            {path.length > 0 && <span data-doc-path className="min-w-0 truncate"><span aria-hidden>· </span>{path.map((label, index) => <span key={`${index}:${label}`}>{index > 0 && <span aria-hidden> › </span>}<LocalizedText text={label} /></span>)}</span>}
          </div>
        </header>

        {sections.length > 1 && <details className={cn('mb-6 rounded-[20px] border border-white/[0.08] px-4 py-3', page ? '@min-[1100px]/doc:hidden' : '@min-[960px]/doc:hidden')}>
          <summary className="cursor-pointer text-xs text-muted-foreground">On this page</summary>
          <nav aria-label="On this page" className="mt-2 flex flex-col items-start gap-1">
            {sections.map(section => <button key={section.id} type="button" onClick={() => jumpTo(section.id)} className="py-1 text-left text-xs text-muted-foreground hover:text-foreground">{section.text}</button>)}
          </nav>
        </details>}
        {doc.blocks.map((block, i) => (
          <Block key={block.id ?? i} block={block} />
        ))}
      </article>

      {sections.length > 1 && (
        <nav aria-label="On this page" data-doc-toc className={cn('sticky top-10 hidden w-44 self-start', page ? 'ml-12 shrink-0 @min-[1100px]/doc:block' : 'shrink-0 @min-[960px]/doc:block')}>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">On this page</p>
          <ul className="space-y-1 border-l border-white/[0.06]">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(s.id)}
                  className="-ml-px border-l border-transparent py-1 pl-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  {s.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
    </div>
  )
}

export default ReferenceDocView
