import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'

// Nothing in the app catches render errors — an uncaught one unmounts the
// whole tree, leaving only the page's own near-black background showing
// (no message, no way back). Wrap a view that's prone to incomplete data
// (new items, demo-seeded drafts) with this instead of leaving it exposed.
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.state.error, () => this.setState({ error: null }))
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-[#070708] p-6 text-center text-slate-400">
        <TriangleAlert className="size-5 text-amber-400" />
        <p className="text-sm font-medium text-slate-300">Something went wrong showing this.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-1 inline-flex h-8 items-center rounded-full bg-white/[0.08] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.14]"
        >
          Try again
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
