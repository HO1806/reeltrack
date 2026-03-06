import React, { useState } from 'react';
import { Star, Play, Edit2, Trash2, Heart, RotateCcw, Plus, Minus, Tv, Film, Clock, Search, Loader2, Sparkles } from 'lucide-react';
import { cn, calculateUltimateScore } from '../utils';
import { LibraryEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';

interface MovieCardProps {
  entry: LibraryEntry;
  onEdit: (entry: LibraryEntry) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleWatched: (id: string) => void;
  onUpdateEpisode?: (id: string, delta: number) => void;
  onQuickRate?: (id: string, rating: number) => void;
  onFindSimilar?: (entry: LibraryEntry) => void;
  onClick?: (entry: LibraryEntry) => void;
  index: number;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  entry,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleWatched,
  onUpdateEpisode,
  onQuickRate,
  onFindSimilar,
  onClick,
  index
}) => {
  const [isRatingSaved, setIsRatingSaved] = useState(false);
  const isWatched = entry.status === 'watched';
  const isSeries = entry.type === 'series';
  const needsRating = isWatched && entry.rating.overall === null;
  const ultimateScore = calculateUltimateScore(entry);

  const handleQuickRate = (e: React.MouseEvent, rating: number) => {
    e.stopPropagation();
    onQuickRate?.(entry.id, rating);
    setIsRatingSaved(true);
    setTimeout(() => setIsRatingSaved(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 1), duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col w-full cursor-pointer animate-cinematic"
      onClick={() => onClick?.(entry)}
    >
      {/* Poster Area */}
      <div className="relative aspect-[2/3] rounded-[28px] overflow-hidden bg-card border border-white/[0.05] shadow-premium transition-all duration-700 card-hover">
        {entry.poster ? (
          <img
            src={entry.poster}
            alt={entry.title}
            loading="lazy"
            className={cn(
              "w-full h-full object-cover transition-all duration-1000 group-hover:scale-110",
              isWatched ? "brightness-[0.8] group-hover:brightness-[0.4]" : "brightness-[0.9] group-hover:brightness-[0.5]"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-elevated to-background flex items-center justify-center p-6 text-center">
            <span className="font-bebas text-6xl text-white/5 tracking-[8px]">{entry.title.substring(0, 2).toUpperCase()}</span>
          </div>
        )}

        {/* Global Poster Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-500" />

        {/* Find Similar Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onFindSimilar?.(entry); }}
          className="absolute top-4 left-4 z-[50] rounded-full bg-black/60 backdrop-blur-md border-white/10 !px-3 !h-7 !text-[11px] text-white/80 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-background hover:border-transparent transition-all"
        >
          <Plus size={12} className="opacity-70" /> Similar
        </Button>

        {/* Rating Badge (Top Right) - Ultimate Score */}
        {ultimateScore !== null && (
          <div className="absolute top-4 right-4 z-[50] score-badge animate-glow">
            <Star size={14} className="fill-background" />
            {ultimateScore}
          </div>
        )}

        {/* Favorite Heart */}
        {entry.isFavorite && (
          <div className="absolute bottom-4 right-4 z-[50] w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-accent/30 animate-heart-pulse">
            <Heart size={14} className="text-accent fill-accent" />
          </div>
        )}


        {/* Rewatch Badge */}
        {entry.rewatchCount > 0 && (
          <div className="absolute top-14 left-4 z-[50] pill-badge bg-blue/40 border-blue/20 text-white">
            ↺ {entry.rewatchCount}
          </div>
        )}

        {/* Hover Actions Overlay */}
        <div className="absolute inset-x-4 bottom-6 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 flex flex-col gap-3 z-50">
          <Button
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              const url = entry.streamingUrl || `https://www.google.com/search?q=${encodeURIComponent(entry.title)}+stremio`;
              window.open(url, '_blank');
            }}
            className="w-full !py-3 !text-[11px] justify-center"
          >
            <Play size={14} fill="currentColor" /> Watch Now
          </Button>

          <div className="flex gap-2 text-white">
            <Button
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="flex-1 !h-10 border-border-default !rounded-xl !text-[10px] uppercase tracking-widest"
            >
              Details
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="w-12 h-10 border-transparent bg-red/[0.12] hover:bg-red/[0.25] text-red !rounded-xl"
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </Button>
          </div>

          {/* Quick Rate Stars */}
          {isWatched && (
            <div className="pt-3 border-t border-white/10 flex flex-col items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const rating = entry.rating.overall || 0;
                  const isFull = rating >= star;
                  const isHalf = rating >= star - 0.5 && rating < star;
                  return (
                    <button
                      key={star}
                      onClick={(e) => handleQuickRate(e, star)}
                      onContextMenu={(e) => { e.preventDefault(); handleQuickRate(e as any, star - 0.5); }}
                      className="hover:scale-125 transition-transform relative"
                    >
                      <Star size={18} className={cn(isFull ? "text-accent fill-accent" : isHalf ? "text-accent" : "text-white/20")} />
                      {isHalf && <div className="absolute inset-0 overflow-hidden w-1/2"><Star size={18} className="text-accent fill-accent" /></div>}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {isRatingSaved && (
                  <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[10px] text-accent font-bebas tracking-widest">Saved</motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Info Area */}
      <div className="mt-5 space-y-1.5 px-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[18px] font-bold leading-tight line-clamp-2 text-text-primary group-hover:text-accent transition-colors duration-500">
            {entry.title}
          </h3>
          <span className="flex-shrink-0 text-[11px] font-bold text-text-muted mt-1">{entry.year}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              entry.status === 'watched' ? "bg-green shadow-[0_0_12px_rgba(74,222,128,0.5)]" :
                entry.status === 'watching' ? "bg-blue shadow-[0_0_12px_rgba(96,165,250,0.5)]" :
                  "bg-accent shadow-[0_0_12px_rgba(245,197,24,0.5)]"
            )} />
            <span className="uppercase tracking-[0.1em] text-[10px] font-bold text-text-secondary">{(entry.status || '').replace(/_/g, ' ')}</span>
          </div>

          {isWatched && entry.rating.overall && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const rating = entry.rating.overall!;
                const isFull = rating >= star;
                const isHalf = rating >= star - 0.5 && rating < star;
                return (
                  <div key={star} className="relative">
                    <Star size={10} className={cn(isFull ? "text-accent fill-accent" : isHalf ? "text-accent" : "text-white/10")} />
                    {isHalf && <div className="absolute inset-0 overflow-hidden w-1/2"><Star size={10} className="text-accent fill-accent" /></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Series Progress */}
        {isSeries && entry.status === 'watching' && (
          <div className="pt-2 flex items-center justify-between border-t border-white/10 group-hover:border-accent/20 transition-colors">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
              S{entry.currentSeason} <span className="text-accent/50 mx-1">•</span> E{entry.currentEpisode}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateEpisode?.(entry.id, -1); }}
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-text-secondary active:scale-90"
              >
                <Minus size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateEpisode?.(entry.id, 1); }}
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-text-secondary active:scale-90"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
