import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'

// A deliberately small markdown subset for AI chat replies — **bold**,
// `inline code`, "- "/"• " bullet lists and "1. " numbered lists, with
// blank lines splitting paragraphs. Long replies read as a wall of prose
// otherwise; this is the minimum that turns "do X, then Y, then Z" into
// something scannable, without pulling in a full markdown dependency for
// a handful of mock assistant replies.
function parseInline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded-md bg-white/10 px-1 py-0.5 font-mono text-[11.5px] text-emerald-300">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

const BULLET_RE = /^\s*[-•]\s+(.*)$/
const ORDERED_RE = /^\s*\d+\.\s+(.*)$/

function parseBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i++
      continue
    }
    const listType = BULLET_RE.test(lines[i]) ? 'ul' : ORDERED_RE.test(lines[i]) ? 'ol' : null
    if (listType) {
      const re = listType === 'ul' ? BULLET_RE : ORDERED_RE
      const items = []
      while (i < lines.length && re.test(lines[i])) {
        items.push(re.exec(lines[i])[1])
        i++
      }
      blocks.push({ type: listType, items })
      continue
    }
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '' && !BULLET_RE.test(lines[i]) && !ORDERED_RE.test(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', lines: paraLines })
  }
  return blocks
}

// `translateText` collapses all whitespace (including newlines) before
// matching the dictionary — fine for a short single-line string, but it
// would flatten a whole multi-paragraph/numbered-list reply into one line
// and lose the structure this component exists to render. Translating
// line by line instead keeps each line's own newline intact and still
// hits the same dictionary (a line like "1. Open **Diff**..." is matched
// as its own catalog entry), never relying on the JSX auto-translator
// either, since by the time bold/code/list parsing splits a line into
// elements there's no longer one full string for it to match against.
function translateBlock(raw, language) {
  return (raw ?? '').split('\n').map((line) => translateText(line, language)).join('\n')
}

function ChatMarkdown({ text, summary, className }) {
  const language = useLanguage()
  const translated = translateBlock(text, language)
  const translatedSummary = summary ? translateBlock(summary, language) : null
  const blocks = useMemo(() => parseBlocks(translated), [translated])

  return (
    <div translate="no" className={cn('space-y-2.5', className)}>
      {translatedSummary && (
        <div className="flex items-start gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
          <p className="text-[12px] leading-relaxed font-medium text-emerald-100">{parseInline(translatedSummary, 'summary')}</p>
        </div>
      )}
      {blocks.map((block, bi) => {
        if (block.type === 'ul') {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-4 marker:text-emerald-400/70">
              {block.items.map((item, ii) => (
                <li key={ii} className="leading-relaxed">
                  {parseInline(item, `${bi}-${ii}`)}
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-4 marker:font-medium marker:text-emerald-400/70">
              {block.items.map((item, ii) => (
                <li key={ii} className="leading-relaxed">
                  {parseInline(item, `${bi}-${ii}`)}
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={bi} className="leading-relaxed">
            {block.lines.map((line, li) => (
              <span key={li}>
                {parseInline(line, `${bi}-${li}`)}
                {li < block.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export default ChatMarkdown
