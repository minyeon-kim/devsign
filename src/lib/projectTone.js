import { projects } from '@/data/mockData'

const PROJECT_TONES = ['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500']

// A project's identity color, fixed by its place in the project data (not
// by wherever it happens to sit in a sorted or filtered list), so its card,
// the switcher menu and the activity bar's project badge always agree.
export function projectTone(projectId) {
  const index = Math.max(0, projects.findIndex((p) => p.id === projectId))
  return PROJECT_TONES[index % PROJECT_TONES.length]
}
