import React, { useEffect, useState } from 'react';
import { LibraryEntry, MediaType } from '../types';
import { getRecommendations, getExtendedCredits } from '../services/tmdb';
import { ArrowLeft, Play, Plus, Star, Calendar, Clock, User, Film } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="h-[calc(100vh-60px)] bg-background text-text-primary p-6 flex flex-col overflow-hidden"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors uppercase tracking-widest text-xs font-bold mb-6 shrink-0"
      >
        <ArrowLeft size={16} /> Back to Library
      </button>

      <div className="flex-1 min-h-0 flex gap-8 overflow-hidden">
        {/* Left Column: Poster & Actions */}
        <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group shrink-0">
            {entry.poster ? (
              <img 
                src={entry.poster} 
                alt={entry.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <span className="font-bebas text-6xl text-white/10">{entry.title.substring(0, 2)}</span>
              </div>
            )}
            
            {/* Rating Badge on Main Poster */}
            {entry.vote_average && (
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-white/10 text-white shadow-lg">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                {entry.vote_average.toFixed(1)}
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              const url = entry.streamingUrl || `https://www.google.com/search?q=${encodeURIComponent(entry.title)}+stremio`;
              window.open(url, '_blank');
            }}
            className="w-full bg-accent text-black py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-accent/20"
          >
            <Play size={18} fill="currentColor" /> Watch Now
          </button>
          
          {director && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
                <User size={12} /> Director
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
                  {director.profile ? (
                    <img src={director.profile} alt={director.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/20">
                      {director.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">{director.name}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: Details */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-8">
            {/* Header Info */}
            <div>
              <h1 className="font-bebas text-6xl tracking-wide leading-none mb-4">{entry.title}</h1>
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg">
                  <Calendar size={14} /> {entry.year}
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg">
                  <Clock size={14} /> {entry.runtime} min
                </span>
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold text-accent bg-accent/10 px-3 py-1 rounded-lg text-xs">
                  {entry.type}
                </span>
              </div>
            </div>

            {/* Genres */}
            <div className="flex items-center gap-2 flex-wrap">
              {entry.genres.map(g => (
                <span key={g} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-colors cursor-default bg-card">
                  {g}
                </span>
              ))}
            </div>

            {/* Synopsis */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                <span className="w-1 h-4 bg-accent rounded-full"/> Synopsis
              </h3>
              <p className="text-lg leading-relaxed text-text-secondary/90">
                {entry.description || "No description available."}
              </p>
            </div>

            {/* Cast */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                <Film size={14} /> Cast
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {cast.length > 0 ? cast.map(c => (
                  <div key={c.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
                      {c.profile ? (
                        <img src={c.profile} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/20">
                          {c.name.substring(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{c.name}</div>
                      <div className="text-[10px] text-text-secondary truncate">{c.character}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-text-secondary">Cast information unavailable.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recommendations */}
        <div className="w-64 shrink-0 flex flex-col min-h-0 border-l border-white/5 pl-6">
          <h2 className="font-bebas text-2xl tracking-wide text-text-muted mb-4 shrink-0">You Might Also Like</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-text-secondary animate-pulse text-xs">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" /> Curating...
              </div>
            ) : similar.length > 0 ? (
              similar.slice(0, 5).map(item => (
                <div key={item.id} className="group relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-card border border-white/5 hover:border-accent/30 transition-all shadow-lg hover:shadow-accent/10 shrink-0">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <span className="font-bebas text-xl text-white/10">{item.title.substring(0, 2)}</span>
                    </div>
                  )}
                  
                  {/* Rating Badge */}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-white/10">
                    <Star size={8} className="text-yellow-400 fill-yellow-400" />
                    {item.rating.toFixed(1)}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-center gap-2">
                    <div>
                      <h4 className="font-bold text-xs line-clamp-2 leading-tight">{item.title}</h4>
                      <span className="text-[10px] text-text-secondary mt-0.5 block">{item.year}</span>
                    </div>
                    <button 
                      onClick={() => onAdd(item)}
                      className="w-full bg-accent text-black py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-secondary italic">No similar titles found.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
