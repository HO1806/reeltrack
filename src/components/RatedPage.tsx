import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LibraryEntry } from '../types';
import { LibraryGrid } from './LibraryGrid';
import { Star, X } from 'lucide-react';
import { cn } from '../utils';

interface RatedPageProps {
    library: LibraryEntry[];
    onRate: (id: string, rating: number) => void;
    onEdit: (entry: LibraryEntry) => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    onToggleWatched: (id: string) => void;
    onUpdateEpisode: (id: string, delta: number) => void;
    onFindSimilar: (entry: LibraryEntry) => void;
    onClick: (entry: LibraryEntry) => void;
}

export const RatedPage: React.FC<RatedPageProps> = ({
    library,
    onRate,
    onEdit,
    onDelete,
    onToggleFavorite,
    onToggleWatched,
    onUpdateEpisode,
    onFindSimilar,
    onClick
}) => {
    const [unratedQueue, setUnratedQueue] = useState<LibraryEntry[]>([]);
    const [currentUnrated, setCurrentUnrated] = useState<LibraryEntry | null>(null);
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);

    // 1. Identify all watched but unrated items
    useEffect(() => {
        // Needs to be watched AND have essentially a missing user rating
        const unrated = library.filter(e => e.status === 'watched' && !e.rating.overall);
        setUnratedQueue(unrated);
        if (unrated.length > 0 && !currentUnrated) {
            setCurrentUnrated(unrated[0]);
        } else if (unrated.length === 0) {
            setCurrentUnrated(null);
        }
    }, [library, currentUnrated]);

    // The actual items to display on the page
    const ratedItems = library.filter(e => e.rating.overall !== null);

    const handleRate = (rating: number) => {
        if (!currentUnrated) return;

        // Save rating
        onRate(currentUnrated.id, rating);

        // Move to next in queue temporarily before re-render catches up
        const nextQueue = unratedQueue.slice(1);
        setCurrentUnrated(nextQueue.length > 0 ? nextQueue[0] : null);
        setHoveredStar(null);
    };

    const handleSkip = () => {
        // Just dismiss the current one from the local queue viewed this session
        const nextQueue = unratedQueue.slice(1);
        setUnratedQueue(nextQueue);
        setCurrentUnrated(nextQueue.length > 0 ? nextQueue[0] : null);
        setHoveredStar(null);
    };

    return (
        <div className="flex flex-col flex-1 relative min-h-screen pt-4">
            {/* Page Header */}
            <div className="px-8 py-4 mb-4 border-b border-white/5">
                <h2 className="text-2xl font-bebas tracking-widest text-white flex items-center gap-3">
                    <Star className="text-accent" fill="currentColor" size={24} />
                    Your Rated Collection
                    <span className="text-sm font-sans tracking-normal text-text-muted ml-2">
                        ({ratedItems.length} items)
                    </span>
                </h2>
            </div>

            {/* Grid */}
            <div className="pb-12 max-w-content-max mx-auto w-full">
                {ratedItems.length > 0 ? (
                    <LibraryGrid
                        entries={ratedItems}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleFavorite={onToggleFavorite}
                        onToggleWatched={onToggleWatched}
                        onUpdateEpisode={onUpdateEpisode}
                        onQuickRate={onRate}
                        onFindSimilar={onFindSimilar}
                        onClick={onClick}
                        activeTab="rated"
                        isSearching={false}
                        isLoading={false}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                        <Star size={48} className="opacity-20 mb-4" />
                        <p className="text-lg">You haven't rated any movies or series yet.</p>
                        <p className="text-sm mt-2">Rate items you've watched to see them here.</p>
                    </div>
                )}
            </div>

            {/* Unrated Pop-up Modal */}
            <AnimatePresence>
                {currentUnrated && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="glass-panel-elevated w-full max-w-md rounded-3xl overflow-hidden relative shadow-premium border border-white/10"
                        >
                            <button
                                onClick={handleSkip}
                                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors z-10"
                            >
                                <X size={20} />
                            </button>

                            <div className="relative aspect-[16/9] w-full bg-surface">
                                {currentUnrated.poster ? (
                                    <>
                                        <img
                                            src={currentUnrated.poster}
                                            alt={currentUnrated.title}
                                            className="w-full h-full object-cover opacity-50"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-surface-active flex items-center justify-center" />
                                )}

                                <div className="absolute bottom-0 left-0 w-full p-6 pb-2">
                                    <div className="text-[10px] uppercase tracking-widest text-accent font-bold mb-1">
                                        You watched this!
                                    </div>
                                    <h3 className="text-2xl font-bold text-white line-clamp-2 leading-tight">
                                        {currentUnrated.title}
                                    </h3>
                                    <div className="text-sm text-text-muted mt-1">
                                        {currentUnrated.year} • {currentUnrated.type === 'movie' ? 'Movie' : 'Series'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 pt-4 flex flex-col items-center justify-center">
                                <p className="text-sm text-text-secondary mb-6 text-center">
                                    How would you rate it?
                                </p>

                                <div className="flex gap-2 w-full justify-center max-w-[280px]">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => handleRate(star)}
                                            onMouseEnter={() => setHoveredStar(star)}
                                            onMouseLeave={() => setHoveredStar(null)}
                                            className="p-2 -m-2 group transition-transform hover:scale-110"
                                        >
                                            <Star
                                                size={32}
                                                className={cn(
                                                    "transition-all duration-300",
                                                    ((hoveredStar !== null ? star <= hoveredStar : false) || star <= (currentUnrated.rating.overall || 0))
                                                        ? "text-accent fill-accent shadow-accent-glow"
                                                        : "text-white/20"
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-8 flex items-center justify-between w-full text-[10px] uppercase tracking-wider text-text-muted font-bold">
                                    <span>{unratedQueue.length} items unrated</span>
                                    <button onClick={handleSkip} className="hover:text-white transition-colors">
                                        Skip for now
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
