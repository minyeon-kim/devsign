// Build the explorer from the project's file paths, including root-level files
// and imported directories. Renaming changes only the leaf name.
// `emptyFolders` are folder paths with no files in them yet (see the
// Explorer's "New Folder" action) — buildFileTree otherwise only derives a
// folder from a file's path, so they need to be created explicitly.
export function buildFileTree(files, nameOf = (file) => file.name, emptyFolders = []) {
  const root = { kind: 'folder', path: '', name: '/', children: [] }
  function ensureFolder(path) {
    let parent = root
    for (const name of path.split('/').filter(Boolean)) {
      const folderPath = parent.path ? `${parent.path}/${name}` : name
      let folder = parent.children.find((node) => node.kind === 'folder' && node.path === folderPath)
      if (!folder) {
        folder = { kind: 'folder', name, path: folderPath, children: [] }
        parent.children.push(folder)
      }
      parent = folder
    }
    return parent
  }
  for (const file of files) {
    const parts = (file.path || file.name).replaceAll('\\', '/').split('/').filter((part) => part && part !== '.')
    parts.pop()
    const folders = []
    for (const part of parts) {
      if (part === '..') folders.pop()
      else folders.push(part)
    }
    const parent = ensureFolder(folders.join('/'))
    const name = nameOf(file)
    parent.children.push({ kind: 'file', name, path: parent.path ? `${parent.path}/${name}` : name, file })
  }
  for (const path of emptyFolders) ensureFolder(path)
  function sort(node) {
    node.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'folder' ? -1 : 1))
    node.children.filter((child) => child.kind === 'folder').forEach(sort)
  }
  sort(root)
  return root.children
}
