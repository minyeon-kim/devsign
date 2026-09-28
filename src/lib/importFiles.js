// What an imported file becomes: code joins the file tree, everything
// else is a design asset of that kind.
const CODE_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'json', 'md', 'html', 'py', 'svelte', 'vue', 'csv', 'tsv'])
const DESIGN_KINDS = {
  fig: 'figma',
  ai: 'illustrator',
  eps: 'illustrator',
  svg: 'vector',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  // Kept as project assets rather than unpacked / parsed.
  zip: 'archive',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
}

export function importKind(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  return DESIGN_KINDS[ext] ?? 'file'
}

// The file picker's accept list: every kind Import understands.
export const IMPORT_ACCEPT = [...CODE_EXTENSIONS, ...Object.keys(DESIGN_KINDS)].map((ext) => `.${ext}`).join(',')
