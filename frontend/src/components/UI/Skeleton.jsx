import React from 'react';

/**
 * A beautiful, pulsing skeleton list placeholder for data cards or rows.
 */
export function CardListSkeleton({ count = 4 }) {
  return (
    <div className="w-full space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
          {/* Icon placeholder */}
          <div className="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0" />
          
          {/* Text block */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
          
          {/* Pill placeholder */}
          <div className="w-16 h-6 bg-slate-200 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * A beautiful 3-column card grid skeleton matching Master List page cards.
 */
export function MasterListSkeleton({ count = 6 }) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-h-[170px] flex flex-col justify-between space-y-4"
        >
          {/* Top Row: Icon + Title + Department + Menu button */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-200 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-28" />
                <div className="h-3 bg-slate-200 rounded w-14" />
              </div>
            </div>
            <div className="w-7 h-7 bg-slate-200 rounded-lg shrink-0" />
          </div>

          {/* Middle Row: CREATED & UPDATED dates */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <div className="h-2.5 bg-slate-200 rounded w-12" />
              <div className="h-3 bg-slate-200 rounded w-20" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 bg-slate-200 rounded w-12" />
              <div className="h-3 bg-slate-200 rounded w-20" />
            </div>
          </div>

          {/* Bottom Row: Type badge + Department tag */}
          <div className="flex items-center justify-between pt-1">
            <div className="h-6 bg-slate-200 rounded-full w-28" />
            <div className="h-3 bg-slate-200 rounded w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A beautiful 3-column card grid skeleton matching Category Management / Office Head cards.
 */
export function OfficeCardSkeleton({ count = 6 }) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          {/* Top Row: Icon + Title + Event/Dept + Academic Pill + 3-dots */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="h-3 bg-slate-200 rounded w-16" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 bg-slate-200 rounded-full w-16" />
              <div className="w-6 h-6 bg-slate-200 rounded-lg shrink-0" />
            </div>
          </div>

          {/* Dates Row */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-200 rounded w-24" />
          </div>

          {/* Requirements & Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-4 bg-slate-200 rounded-full w-16" />
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full" />
          </div>

          {/* Personnel Footer */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="h-2.5 bg-slate-200 rounded w-14" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-200 rounded-full shrink-0" />
              <div className="h-3 bg-slate-200 rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A pulsing dashboard grid and chart template loader mirroring the main home page.
 */
export function DashboardSkeleton() {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden animate-pulse p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 flex justify-between items-center shadow-sm">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-8 bg-slate-200 rounded w-1/4" />
              <div className="h-3 bg-slate-200 rounded w-1/3" />
            </div>
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Split Charts */}
      <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-[300px]">
        {/* Donut Chart Skeleton */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 flex-1">
            <div className="w-36 h-36 rounded-full border-[10px] border-slate-200 flex-shrink-0" />
            <div className="flex-1 w-full space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
            </div>
          </div>
        </div>

        {/* Bar Chart Skeleton */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="flex items-end justify-between gap-3 h-44 flex-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                <div className="w-full bg-slate-200 rounded-t-md" style={{ height: `${20 + (i % 3) * 25}%` }} />
                <div className="h-3 bg-slate-200 rounded w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2x2 grid skeleton matching Accreditation / Standards (ALLC.jsx) event cards.
 */
export function StandardsSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-0 h-full p-1 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/90 bg-white p-4 md:p-5 h-full min-h-0 flex flex-col justify-between shadow-2xs space-y-4"
        >
          {/* Header Row: Icon + Title + Code + Badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 bg-slate-200 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-4 bg-slate-200 rounded w-3/5" />
                <div className="h-3 bg-slate-200 rounded w-2/5" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-6 w-16 bg-slate-200 rounded-full" />
              <div className="w-7 h-7 bg-slate-200 rounded-lg" />
            </div>
          </div>

          {/* Description line placeholder */}
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/5" />
          </div>

          {/* Metadata & Progress bar */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-200 rounded w-16" />
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full" />
          </div>

          {/* Footer Dates */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100/80">
            <div className="h-2.5 bg-slate-200 rounded w-20" />
            <div className="h-2.5 bg-slate-200 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader matching the actual compact list layout of Audit Logs & Security Trails.
 */
export function AuditLogsSkeleton({ count = 9 }) {
  return (
    <div className="w-full divide-y divide-slate-100 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2 gap-3">
          {/* Left: Icon + Action Badge + Message Title + Subtitle */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-12 bg-slate-200 rounded-full shrink-0" />
                <div
                  className={`h-3 bg-slate-200 rounded ${
                    i % 4 === 0
                      ? 'w-2/3'
                      : i % 4 === 1
                      ? 'w-1/2'
                      : i % 4 === 2
                      ? 'w-3/5'
                      : 'w-4/5'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 bg-slate-100 rounded w-28" />
                <div className="h-2.5 bg-slate-100 rounded w-16" />
                <div className="h-2.5 bg-slate-100 rounded w-36 hidden sm:block" />
              </div>
            </div>
          </div>

          {/* Right: Timestamp & Chevron */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="space-y-1 flex flex-col items-end">
              <div className="h-3 w-16 bg-slate-200 rounded" />
              <div className="h-2.5 w-14 bg-slate-100 rounded" />
            </div>
            <div className="w-3.5 h-3.5 rounded bg-slate-200/80 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}


