import { currentUserFor } from '@/data/mockData'

// Whether the person viewing this project is a developer — what decides
// whether the code-side details (diff, file paths, branch) start open.
export function isDeveloperViewer(projectId) {
  return currentUserFor(projectId)?.jobRole === 'Developer'
}
