import React from 'react';
import { cn } from '../utils';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
    <div className={cn("bg-white/[0.04] rounded animate-shimmer", className)} />
);

export const MovieCardSkeleton = () => (
    <div className="flex flex-col gap-4">
        <Skeleton className="aspect-[2/3] w-full rounded-[28px]" />
        <div className="px-2 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-10 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-lg" />
            </div>
        </div>
    </div>
);

export const DetailsSkeleton = () => (
    <div className="flex flex-col gap-8 h-full overflow-hidden p-6">
        <Skeleton className="h-8 w-40 rounded-full" />
        <div className="flex gap-12 flex-1 min-h-0">
            <div className="w-[400px] shrink-0 flex flex-col gap-6">
                <Skeleton className="aspect-[2/3] rounded-[32px]" />
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-20 rounded-[24px]" />
            </div>
            <div className="flex-1 space-y-10">
                <div className="space-y-5">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-20 w-2/3 rounded-lg" />
                    <div className="flex gap-4">
                        <Skeleton className="h-8 w-28 rounded-lg" />
                        <Skeleton className="h-8 w-28 rounded-lg" />
                        <Skeleton className="h-8 w-28 rounded-lg" />
                    </div>
                    <div className="flex gap-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-24 rounded-2xl" />)}
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-32 w-full rounded-[40px]" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-[24px]" />)}
                    </div>
                </div>
            </div>
        </div>
    </div>
);
