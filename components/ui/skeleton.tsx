'use client';

import type React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[#DDE3EA]', className)}
      {...props}
    />
  );
}

function TableSkeletonRows({
  rows = 6,
  columns,
  cellClassName,
}: {
  rows?: number;
  columns: number;
  cellClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-[#EAEEF3]">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className={cn('px-4 py-3.5', cellClassName)}>
              <Skeleton
                className={cn(
                  'h-3.5',
                  columnIndex === 0 ? 'w-8' : columnIndex === columns - 1 ? 'ml-auto w-14' : 'w-full max-w-36',
                )}
              />
              {columnIndex === 2 && <Skeleton className="mt-2 h-3 w-24" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm', className)}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-36" />
    </div>
  );
}

export { CardSkeleton, Skeleton, TableSkeletonRows };
