// Build the explorer from the project's file paths, including root-level files
// and imported directories. Renaming changes only the leaf name.
export function buildFileTree(files, nameOf = (file) => file.name) {
  const root = { kind: 'folder', path: '', name: '/', children: [] }
  for (const file of files) {
    const parts = (file.path || file.name).replaceAll('\\', '/').split('/').filter((part) => part && part !== '.')
    parts.pop()
    const folders = []
    for (const part of parts) {
      if (part === '..') folders.pop()
      else folders.push(part)
    }
    let parent = root
    for (const name of folders) {
      const path = parent.path ? `${parent.path}/${name}` : name
      let folder = parent.children.find((node) => node.kind === 'folder' && node.path === path)
      if (!folder) {
        folder = { kind: 'folder', name, path, children: [] }
        parent.children.push(folder)
      }
      parent = folder
    }
    const name = nameOf(file)
    parent.children.push({ kind: 'file', name, path: parent.path ? `${parent.path}/${name}` : name, file })
  }
  function sort(node) {
    node.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'folder' ? -1 : 1))
    node.children.filter((child) => child.kind === 'folder').forEach(sort)
  }
  sort(root)
  return root.children
}
