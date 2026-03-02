import React, { useEffect, useState } from 'react';
import { LibraryEntry, MediaType } from '../types';
import { getRecommendations, getExtendedCredits } from '../services/tmdb';
import { ArrowLeft, Play, Plus, Star, Calendar, Clock, User, Film, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { DetailsSkeleton } from './Skeleton';

interface SimilarItem {
  id: number;
  title: string;
  year: number;
  poster: string;
  type: MediaType;
  overview: string;
  rating: number;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile: string | null;
}

interface Director {
  name: string;
  profile: string | null;
}

interface MovieDetailsProps {
  entry: LibraryEntry;
  onBack: () => void;
  tmdbApiKey: string;
  onAdd: (item: SimilarItem) => void;
  library: LibraryEntry[];
}

export const MovieDetails: React.FC<MovieDetailsProps> = ({ entry, onBack, tmdbApiKey, onAdd, library }) => {
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [director, setDirector] = useState<Director | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry.tmdbId && tmdbApiKey) {
      setLoading(true);

      Promise.all([
        getRecommendations(entry.tmdbId, entry.type === 'movie' ? 'movie' : 'tv', tmdbApiKey),
        getExtendedCredits(entry.tmdbId, entry.type === 'movie' ? 'movie' : 'tv', tmdbApiKey)
      ])
        .then(([recommendations, credits]) => {
          // Filter out watched items from recommendations
          const filtered = recommendations.filter((item: SimilarItem) =>
            !library.some(e => e.tmdbId === item.id && e.status === 'watched')
          );
          setSimilar(filtered);

          setCast(credits.cast);
          setDirector(credits.director);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [entry.tmdbId, entry.type, tmdbApiKey, library]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-background text-text-primary overflow-y-auto custom-scrollbar animate-cinematic"
    >
      {/* Cinematic Backdrop */}
      {entry.poster && (
        <div className="fixed inset-0 z-[-1] pointer-events-none">
          <img
            src={entry.poster}
            alt=""
            className="w-full h-full object-cover opacity-15 scale-125 blur-[100px]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 py-10 sm:py-20 flex flex-col gap-12 sm:gap-20">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-3 text-text-secondary hover:text-accent transition-all uppercase tracking-[0.2em] text-[10px] font-black group w-fit"
        >
          <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Return to Library
        </button>

        <div className="flex flex-col lg:flex-row gap-12 sm:gap-20">
          {/* Left Column: Poster & Quick Info */}
          <div className="w-full lg:w-[400px] flex flex-col gap-10">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="aspect-[2/3] w-full rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 relative group"
            >
              {entry.poster ? (
                <img
                  src={entry.poster}
                  alt={entry.title}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-elevated flex items-center justify-center">
                  <span className="font-bebas text-8xl text-white/5">{entry.title.substring(0, 1)}</span>
                </div>
              )}

              {((entry.ultimate_score || 0) > 0) && (
                <div className="absolute top-6 right-6 score-badge text-2xl animate-glow">
                  <Star size={20} className="fill-background" />
                  {Math.round(entry.ultimate_score!)}
                </div>
              )}
            </motion.div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => {
                  const url = entry.streamingUrl || `https://www.google.com/search?q=${encodeURIComponent(entry.title)}+stremio`;
                  window.open(url, '_blank');
                }}
                className="btn-primary w-full py-5 text-lg justify-center shadow-accent-glow"
              >
                <Play size={24} fill="currentColor" /> Stream Now
              </button>

              {director && (
                <div className="glass-panel p-6 rounded-[24px] flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                    {director.profile ? (
                      <img src={director.profile} alt={director.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/20">
                        {director.name.substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-1">Director</p>
                    <h4 className="font-bold text-lg truncate">{director.name}</h4>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Detailed Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-16">
            {/* Main Header */}
            <div className="space-y-8">
              <div className="space-y-4">
                <motion.span
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="pill-badge text-accent border-accent/20 bg-accent/5"
                >
                  {entry.type}
                </motion.span>
                <h1 className="font-bebas text-7xl sm:text-9xl tracking-[0.02em] leading-[0.85] text-white">
                  {entry.title}
                </h1>
              </div>

              <div className="flex items-center gap-6 text-sm font-bold text-text-secondary">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-accent" />
                  <span>{entry.year}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-accent" />
                  <span>{entry.runtime} Minutes</span>
                </div>
                {entry.vote_average > 0 && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-white/20" />
                    <div className="flex items-center gap-2">
                      <Star size={18} className="text-accent fill-accent" />
                      <span>{entry.vote_average.toFixed(1)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {entry.genres.map(g => (
                  <span key={g} className="px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase tracking-[0.15em] text-text-primary/80">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Synopsis Panel */}
            <div className="glass-panel p-8 sm:p-12 rounded-[40px] space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -mr-32 -mt-32" />
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent flex items-center gap-4">
                <div className="w-10 h-[1px] bg-accent/30" /> Overview
              </h3>
              <p className="text-xl sm:text-2xl leading-relaxed text-text-primary/90 font-medium font-sans">
                {entry.description || "The story of this masterpiece remains a mystery."}
              </p>
            </div>

            {/* Cast Grid */}
            <div className="space-y-10">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-muted flex items-center gap-4">
                <div className="w-10 h-[1px] bg-white/20" /> Principal Cast
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6">
                {cast.slice(0, 12).map(c => (
                  <motion.div
                    key={c.id}
                    whileHover={{ y: -6, scale: 1.02 }}
                    className="flex items-center gap-4 bg-white/[0.02] hover:bg-white/[0.06] p-4 rounded-[24px] border border-white/[0.05] hover:border-white/[0.12] transition-all duration-500"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/10 flex-shrink-0">
                      {c.profile ? (
                        <img src={c.profile} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-black text-white/10 uppercase">
                          {c.name.substring(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-text-muted truncate font-bold uppercase tracking-wider mt-0.5">{c.character}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="pt-20 border-t border-white/5 space-y-12">
          <div className="flex items-center justify-between">
            <h2 className="font-bebas text-5xl tracking-wider text-white">Discover More</h2>
            <div className="h-[2px] flex-1 mx-8 bg-gradient-to-r from-accent/20 to-transparent" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {loading ? (
              <div className="flex items-center gap-4 text-accent animate-pulse font-black uppercase tracking-[0.2em] text-xs">
                <div className="w-2 h-2 rounded-full bg-accent shadow-accent-glow" /> Curating collection...
              </div>
            ) : similar.slice(0, 10).map(item => (
              <motion.div
                key={item.id}
                whileHover={{ y: -10 }}
                className="group relative aspect-[2/3] rounded-[28px] overflow-hidden bg-card border border-white/[0.05] shadow-2xl hover:border-white/[0.12] transition-all duration-500"
              >
                {item.poster ? (
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 group-hover:brightness-50" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-elevated text-white/5 font-bebas text-4xl">{item.title.substring(0, 1)}</div>
                )}

                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1.5 border border-white/10 shadow-lg transition-transform duration-500 group-hover:scale-110">
                  <Star size={12} className="text-accent fill-accent" />
                  {item.rating.toFixed(1)}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6 text-center gap-4 transform translate-y-4 group-hover:translate-y-0">
                  <div className="space-y-1">
                    <h4 className="font-black text-sm line-clamp-2 leading-tight text-white uppercase tracking-wider">{item.title}</h4>
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{item.year}</span>
                  </div>
                  <button
                    onClick={() => onAdd(item)}
                    className="btn-primary w-full py-3 text-[10px] justify-center"
                  >
                    <Plus size={16} /> Add to list
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
