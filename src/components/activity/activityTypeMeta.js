import { AtSign, FileText, GitBranch, GitCommitHorizontal, GitMerge, MessageSquare } from 'lucide-react'

// Activity types are distinguished by their icon and label, with a shared neutral tone.
const ACTIVITY_TONE = 'text-muted-foreground bg-muted/40 ring-1 ring-border/60'
export const ACTIVITY_TYPE_META = {
  changes: {
    label: 'Changes',
    icon: GitCommitHorizontal,
    tone: ACTIVITY_TONE,
  },
  conflict: {
    label: 'Conflict',
    icon: GitBranch,
    tone: ACTIVITY_TONE,
  },
  merge: {
    label: 'Merge',
    icon: GitMerge,
    tone: ACTIVITY_TONE,
  },
  comment: {
    label: 'Comment',
    icon: MessageSquare,
    tone: ACTIVITY_TONE,
  },
  file: {
    label: 'File',
    icon: FileText,
    tone: ACTIVITY_TONE,
  },
  mention: {
    label: 'Mention',
    icon: AtSign,
    tone: ACTIVITY_TONE,
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
