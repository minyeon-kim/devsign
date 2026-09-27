import { AtSign, FileText, GitBranch, GitCommitHorizontal, GitMerge, MessageSquare } from 'lucide-react'

// Single source of truth for the Activity page's semantic color language —
// shared by the filter pills and each row's icon/status pill so the two
// never drift out of sync. Deliberately restrained: color lives only in
// these small badges, never as a row/card background (see the dashboard
// brief's color principle).
export const ACTIVITY_TYPE_META = {
  changes: {
    label: 'Changes',
    icon: GitCommitHorizontal,
    tone: 'text-sky-400 bg-sky-500/10 ring-1 ring-sky-500/20',
  },
  conflict: {
    label: 'Conflict',
    icon: GitBranch,
    tone: 'text-destructive bg-destructive/10 ring-1 ring-destructive/20',
  },
  merge: {
    label: 'Merge',
    icon: GitMerge,
    tone: 'text-violet-400 bg-violet-500/10 ring-1 ring-violet-500/20',
  },
  comment: {
    label: 'Comment',
    icon: MessageSquare,
    tone: 'text-muted-foreground bg-muted',
  },
  file: {
    label: 'File',
    icon: FileText,
    tone: 'text-sky-400 bg-sky-500/10 ring-1 ring-sky-500/20',
  },
  mention: {
    label: 'Mention',
    icon: AtSign,
    tone: 'text-muted-foreground bg-muted',
  },
}

export const ACTIVITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'changes', label: 'Changes' },
  { id: 'conflict', label: 'Conflicts' },
  { id: 'merge', label: 'Merges' },
  { id: 'comment', label: 'Comments' },
  { id: 'file', label: 'Files' },
  { id: 'mention', label: 'Mentions' },
]
