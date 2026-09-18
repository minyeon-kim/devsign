// Resolves a filename to a { Icon, colorClass } pair using the
// extension -> icon-name map in mockData, so file/extension associations
// stay data-driven while the actual lucide components stay out of the data
// layer.
import { File, FileCode, FileJson, FileTerminal, Palette } from 'lucide-react'
import { fileExtensionMeta } from '@/data/mockData'

const iconComponents = { File, FileCode, FileJson, FileTerminal, Palette }

export function getFileIconMeta(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const meta = fileExtensionMeta[ext] ?? fileExtensionMeta.default
  return {
    Icon: iconComponents[meta.iconName] ?? File,
    colorClass: meta.colorClass,
  }
}
