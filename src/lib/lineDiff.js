// Plain LCS line diff — snapshots are a few dozen lines at most, so the
// O(n·m) table is cheap. Returns rows tagged 'same' | 'add' | 'remove',
// reading `from` → `to`.
export function diffLines(from, to) {
  const n = from.length
  const m = to.length
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = from[i] === to[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const rows = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (from[i] === to[j]) {
      rows.push({ kind: 'same', text: from[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ kind: 'remove', text: from[i++] })
    } else {
      rows.push({ kind: 'add', text: to[j++] })
    }
  }
  while (i < n) rows.push({ kind: 'remove', text: from[i++] })
  while (j < m) rows.push({ kind: 'add', text: to[j++] })
  return rows
}

// How far a snapshot's code is from another's: lines added / removed.
export function diffStats(fromLines = [], toLines = []) {
  const rows = diffLines(fromLines, toLines)
  return {
    added: rows.filter((r) => r.kind === 'add').length,
    removed: rows.filter((r) => r.kind === 'remove').length,
  }
}

// A line as tokens — class names, attributes, punctuation — so two lines can
// be compared value by value.
const tokens = (text) => text.match(/\s+|[^\s"'`{}()<>=]+|./g) ?? []

// Which tokens of `a` and `b` aren't shared (longest common subsequence):
// only those are emphasized, so an unchanged value on a changed line — a
// size that's the same on both — stays plain.
export function changedTokens(a, b) {
  const x = tokens(a)
  const y = tokens(b)
  const table = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const left = x.map((text) => ({ text, changed: true }))
  const right = y.map((text) => ({ text, changed: true }))
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { left[i++].changed = false; right[j++].changed = false }
    else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  // Neighbouring changed tokens read as one value (size="lg"), not five.
  const runs = (parts) => parts.reduce((out, part) => {
    const last = out.at(-1)
    if (last && last.changed === part.changed) last.text += part.text
    else out.push({ ...part })
    return out
  }, [])
  return [runs(left), runs(right)]
}
