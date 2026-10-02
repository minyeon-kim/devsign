// A change's lines written into its file: `before` swapped for `after` at
// 1-based `line`. Changes are recorded as snippets without the file's
// indentation, so lines match on their trimmed text and the after lines
// take on the indentation the file has there. Null when the file doesn't
// hold `before` at that line (e.g. the change was already merged).
export function placeChange(base, line, before = [], after = []) {
  if (!line || !base?.length || !Array.isArray(before) || !before.length) return null
  const at = line - 1
  // A one-line change may record just part of the line (an opening tag,
  // a class list): swap that part within the line.
  if (before.length === 1 && after.length === 1 && base[at] !== undefined
    && base[at].trim() !== before[0].trim() && base[at].includes(before[0].trim())) {
    return [...base.slice(0, at), base[at].replace(before[0].trim(), after[0].trim()), ...base.slice(at + 1)]
  }
  const here = base.slice(at, at + before.length)
  if (here.length !== before.length || here.some((text, i) => text.trim() !== before[i].trim())) return null
  const indentOf = (text) => text.match(/^\s*/)[0]
  const fileIndent = indentOf(base[at])
  const snippetIndent = indentOf(before[0])
  const extra = fileIndent.startsWith(snippetIndent) ? fileIndent.slice(snippetIndent.length) : ''
  return [...base.slice(0, at), ...after.map((text) => (text ? extra + text : text)), ...base.slice(at + before.length)]
}
