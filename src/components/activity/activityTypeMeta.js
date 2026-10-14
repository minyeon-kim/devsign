import { AtSign, FileText, GitBranch, GitCommitHorizontal, GitMerge, MessageSquare } from 'lucide-react'

// Tags are quiet words; the one colour is 변경확인's amber, as in the Workspace.
export const ACTIVITY_TYPE_META = {
  changes: {
    label: 'Changes',
    icon: GitCommitHorizontal,
    tone: 'text-slate-400',
  },
  conflict: {
    label: 'Conflict',
    icon: GitBranch,
    tone: 'text-amber-300',
  },
  merge: {
    label: 'Merge',
    icon: GitMerge,
    tone: 'text-slate-400',
  },
  comment: {
    label: 'Comment',
    icon: MessageSquare,
    tone: 'text-slate-400',
  },
  file: {
    label: 'File',
    icon: FileText,
    tone: 'text-slate-400',
  },
  mention: {
    label: 'Mention',
    icon: AtSign,
    tone: 'text-slate-400',
  },
}

export const ACTIVITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'changes', label: 'Changes' },
  { id: 'conflict', label: 'Conflict Points' },
  { id: 'merge', label: 'Merges' },
  { id: 'comment', label: 'Comments' },
  { id: 'file', label: 'Files' },
  { id: 'mention', label: 'Mentions' },
]
