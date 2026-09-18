// Lightweight, regex-based mock syntax highlighter.
// It is intentionally not a real parser — just enough tokenizing to make
// the editor mockup read like JS/JSX, CSS and JSON at a glance.

const tokenClasses = {
  keyword: 'text-purple-400',
  function: 'text-yellow-300',
  tag: 'text-sky-400',
  attribute: 'text-sky-300',
  string: 'text-emerald-400',
  comment: 'text-muted-foreground/70 italic',
  number: 'text-orange-300',
  variable: 'text-purple-300',
  property: 'text-sky-300',
  key: 'text-sky-300',
  boolean: 'text-purple-400',
  punct: 'text-foreground/60',
  plain: 'text-foreground/80',
}

export function tokenClassName(type) {
  return tokenClasses[type] ?? tokenClasses.plain
}

const jsRules = [
  { type: 'comment', regex: /^\/\/.*/ },
  { type: 'string', regex: /^(`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")/ },
  { type: 'tag', regex: /^<\/?[A-Za-z][\w.]*/ },
  {
    type: 'keyword',
    regex:
      /^\b(import|export|default|const|let|var|function|return|if|else|from|class|extends|new|async|await|this)\b/,
  },
  { type: 'function', regex: /^[A-Za-z_$][\w$]*(?=\()/ },
  { type: 'attribute', regex: /^[A-Za-z-]+(?==)/ },
  { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
]

const cssRules = [
  { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
  { type: 'string', regex: /^('(?:\\.|[^'])*'|"(?:\\.|[^"])*")/ },
  { type: 'variable', regex: /^--[\w-]+/ },
  { type: 'function', regex: /^[A-Za-z-]+(?=\()/ },
  { type: 'property', regex: /^[A-Za-z-]+(?=\s*:)/ },
  { type: 'number', regex: /^-?\d+(\.\d+)?(px|rem|em|%|deg|s|ms)?/ },
]

const jsonRules = [
  { type: 'string', regex: /^"(?:\\.|[^"])*"/ },
  { type: 'boolean', regex: /^\b(true|false|null)\b/ },
  { type: 'number', regex: /^-?\d+(\.\d+)?/ },
]

const pythonRules = [
  { type: 'comment', regex: /^#.*/ },
  { type: 'string', regex: /^('(?:\\.|[^'])*'|"(?:\\.|[^"])*")/ },
  {
    type: 'keyword',
    regex:
      /^\b(import|from|def|return|if|else|elif|for|while|class|as|with|print|True|False|None|__main__)\b/,
  },
  { type: 'function', regex: /^[A-Za-z_][\w]*(?=\()/ },
  { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
]

const rulesByLanguage = {
  jsx: jsRules,
  css: cssRules,
  json: jsonRules,
  python: pythonRules,
}

function rawTokenize(line, rules) {
  const tokens = []
  let i = 0
  while (i < line.length) {
    const rest = line.slice(i)
    const rule = rules.find((r) => r.regex.test(rest))
    const match = rule ? rest.match(rule.regex) : null

    if (rule && match && match.index === 0) {
      tokens.push({ text: match[0], type: rule.type })
      i += match[0].length
    } else {
      tokens.push({ text: line[i], type: 'plain' })
      i += 1
    }
  }
  return tokens
}

// JSON strings need a second pass: a string immediately followed by ':' is
// an object key, not a value, so it gets the `key` color instead of `string`.
function markJsonKeys(tokens) {
  return tokens.map((token, i) => {
    if (token.type !== 'string') return token
    const next = tokens.slice(i + 1).find((t) => t.text.trim() !== '')
    return next?.text.startsWith(':') ? { ...token, type: 'key' } : token
  })
}

// Merge adjacent tokens of the same type so we render fewer DOM nodes.
function mergeTokens(tokens) {
  const merged = []
  for (const token of tokens) {
    const last = merged[merged.length - 1]
    if (last && last.type === token.type) {
      last.text += token.text
    } else {
      merged.push({ ...token })
    }
  }
  return merged
}

export function tokenizeLine(line, language) {
  const rules = rulesByLanguage[language] ?? []
  let tokens = rawTokenize(line, rules)
  if (language === 'json') tokens = markJsonKeys(tokens)
  return mergeTokens(tokens)
}
