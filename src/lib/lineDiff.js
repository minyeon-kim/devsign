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
