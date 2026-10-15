import { cn } from 'cn'
import { PAGE_CARD } from '@/components/mergestudio/floatingStyles'

const BONE = 'animate-pulse rounded-md bg-white/[0.07] motion-reduce:animate-none'

function Bone({ className }) {
  return <span aria-hidden className={cn('block', BONE, className)} />
}

// A list card: a title, then rows — each a title line, a file line and the
// button at its right.
function ListSkeleton({ rows = 3 }) {
  return (
    <div className={cn(PAGE_CARD, 'p-6')}>
      <Bone className="mb-5 h-4 w-28" />
      <div className="flex flex-col gap-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-3.5 w-2/5" />
              <Bone className="h-3 w-3/5" />
            </div>
            <Bone className="h-3.5 w-14" />
            <Bone className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// A project card: its thumbnail, then the mark, name and members.
function CardSkeleton() {
  return (
    <div className={cn(PAGE_CARD, 'overflow-hidden')}>
      <Bone className="h-36 w-full rounded-none" />
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Bone className="size-9 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-3.5 w-1/2" />
          <Bone className="h-3 w-1/3" />
        </div>
        <Bone className="h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

// What a page shows while it loads: the shapes of what's coming — the icon
// rail, a list card and a grid of cards — in place of an empty screen, so
// the layout doesn't jump when the real page arrives.
// `bare`: inside the app shell, which already has its rail.
function PageSkeleton({ bare = false }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" data-page-skeleton className={cn('flex overflow-hidden bg-background', bare ? 'h-full' : 'h-screen')}>
      {!bare && (
        <div className="flex w-[var(--ds-chrome-size)] shrink-0 flex-col items-center gap-3 pt-3">
          {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="size-7 rounded-full" />)}
        </div>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 py-8 sm:px-10">
          <ListSkeleton />
          <Bone className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PageSkeleton
