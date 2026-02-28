import React, { useState } from 'react';
import { Star, Play, Edit2, Trash2, Heart, RotateCcw, Plus, Minus, Tv, Film, Clock, Search, Loader2 } from 'lucide-react';
import { LibraryEntry } from '../types';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

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
      transition={{ delay: Math.min(index * 0.05, 1), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col w-full cursor-pointer"
      onClick={() => onClick?.(entry)}
    >
      {/* Poster Area */}
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-card border border-white/5 shadow-2xl transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-accent/20 group-hover:border-accent/30">
        {entry.poster ? (
          <img 
            src={entry.poster} 
            alt={entry.title}
            loading="lazy"
            className={cn(
              "w-full h-full object-cover transition-all duration-700 group-hover:brightness-50",
              !isWatched && "brightness-[0.9]"
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-elevated to-background flex items-center justify-center p-4 text-center">
            <span className="font-bebas text-5xl text-white/10">{entry.title.substring(0, 2).toUpperCase()}</span>
          </div>
        )}

        {/* Find Similar Button (Higher Z-Index) */}
        <button 
          onClick={(e) => { e.stopPropagation(); onFindSimilar?.(entry); }}
          title={`Find similar ${entry.type}s`}
          className="absolute top-3 left-3 z-[45] px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/5 hover:bg-accent hover:text-black transition-all"
        >
          ⊕ Similar
        </button>

        {/* Rating Badge (Top Right) */}
        {(entry.vote_average || 0) > 0 && (
          <div className="absolute top-3 right-3 z-[45] bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-white/10 text-white">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            {(entry.vote_average || 0).toFixed(1)}
          </div>
        )}

        {/* Rewatch Badge (Top Left) */}
        {entry.rewatchCount > 0 && (
          <div className="absolute top-10 left-3 z-[45] px-1.5 py-0.5 rounded bg-blue/80 backdrop-blur-sm text-white text-[9px] font-bold">
            ↺ {entry.rewatchCount}
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 space-y-4 z-40">
          <div className="flex flex-col w-full gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const url = entry.streamingUrl || `https://www.google.com/search?q=${encodeURIComponent(entry.title)}+stremio`;
                window.open(url, '_blank');
              }}
              className="w-full bg-accent text-black py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Play size={12} fill="currentColor" /> Watch Now
            </button>
            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Edit
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                className="flex-1 bg-red/10 hover:bg-red/20 text-red-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Quick Rate Stars (Half Star Support) - Only for Watched */}
          {isWatched && (
            <div className="pt-2 border-t border-white/10 w-full flex flex-col items-center gap-1">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const rating = entry.rating.overall || 0;
                  const isFull = rating >= star;
                  const isHalf = rating >= star - 0.5 && rating < star;
                  
                  return (
                    <button
                      key={star}
                      onClick={(e) => handleQuickRate(e, star)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleQuickRate(e as any, star - 0.5);
                      }}
                      className="hover:scale-125 transition-transform relative"
                      title="Left click for full star, Right click for half star"
                    >
                      <Star 
                        size={16} 
                        className={cn(
                          isFull ? "text-accent fill-accent" : 
                          isHalf ? "text-accent" : "text-white/20"
                        )} 
                      />
                      {isHalf && (
                        <div className="absolute inset-0 overflow-hidden w-1/2">
                          <Star size={16} className="text-accent fill-accent" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {isRatingSaved && (
                  <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] text-accent font-bold uppercase tracking-widest"
                  >
                    ★ Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Info Area */}
      <div className="mt-3 space-y-1.5 px-1">
        <h3 className="font-crimson text-[16px] font-semibold leading-tight line-clamp-2 text-text-primary group-hover:text-accent transition-colors">
          {entry.title}
        </h3>
        
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span>{entry.year}</span>
          
          {isWatched && entry.rating.overall ? (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const rating = entry.rating.overall!;
                const isFull = rating >= star;
                const isHalf = rating >= star - 0.5 && rating < star;
                return (
                  <div key={star} className="relative">
                    <Star 
                      size={10} 
                      className={cn(
                        isFull ? "text-accent fill-accent" : 
                        isHalf ? "text-accent" : "text-white/10"
                      )} 
                    />
                    {isHalf && (
                      <div className="absolute inset-0 overflow-hidden w-1/2">
                        <Star size={10} className="text-accent fill-accent" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                entry.status === 'watched' ? "bg-green" :
                entry.status === 'watching' ? "bg-blue" :
                entry.status === 'want_to_watch' ? "bg-accent" : "bg-red"
              )} />
              <span className="uppercase tracking-wider text-[9px] font-bold">{entry.status.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        {/* Series Progress (Visible) */}
        {isSeries && entry.status === 'watching' && (
          <div className="pt-2 flex items-center justify-between border-t border-white/5">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              S{entry.currentSeason} E{entry.currentEpisode}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdateEpisode?.(entry.id, -1); }}
                className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-text-secondary"
              >
                <Minus size={10} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdateEpisode?.(entry.id, 1); }}
                className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-text-secondary"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
