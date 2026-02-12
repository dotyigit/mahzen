import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface FileTableSkeletonProps {
  compactMode?: boolean
}

export function FileTableSkeleton({ compactMode = false }: FileTableSkeletonProps) {
  const rowHeight = compactMode ? 28 : 36
  const rows = 12

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="w-full min-w-[700px]">
        {/* Header — identical structure to FileTable */}
        <div data-table-header className={cn('flex items-center border-b border-border bg-card', compactMode ? '[&>div]:py-1' : '[&>div]:py-2')}>
          <div className="flex w-11 flex-shrink-0 items-center justify-center">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
          </div>
          <div className="flex-1 pr-4">
            <Skeleton className="h-2.5 w-10" />
          </div>
          <div className="w-24 flex-shrink-0 pr-4">
            <Skeleton className="h-2.5 w-7" />
          </div>
          <div className="w-28 flex-shrink-0 pr-4">
            <Skeleton className="h-2.5 w-14" />
          </div>
          <div className="w-28 flex-shrink-0 pr-4">
            <Skeleton className="h-2.5 w-10" />
          </div>
          <div className="w-24 flex-shrink-0 pr-4">
            <Skeleton className="h-2.5 w-8" />
          </div>
        </div>
      </div>

      {/* Rows — identical layout to FileTable virtualized rows */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex w-full items-center border-b border-border/30"
            style={{ height: `${rowHeight}px` }}
          >
            <div className="flex w-11 flex-shrink-0 items-center justify-center">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            </div>
            <div className="flex flex-1 items-center gap-2.5 pr-4">
              <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
              <Skeleton className={cn('h-3', i % 3 === 0 ? 'w-44' : i % 3 === 1 ? 'w-32' : 'w-56')} />
            </div>
            <div className="w-24 flex-shrink-0 pr-4">
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="w-28 flex-shrink-0 pr-4">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="w-28 flex-shrink-0 pr-4">
              {i % 2 === 0 && <Skeleton className="h-5 w-16 rounded-full" />}
            </div>
            <div className="w-24 flex-shrink-0 pr-4">
              {i % 3 !== 2 && <Skeleton className="h-3 w-16" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
