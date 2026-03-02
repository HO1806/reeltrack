import React, { useState } from 'react';
import { LibraryEntry, Suggestion } from '../types';
import { Sparkles, Play, Plus, Loader2, Film, Tv, ExternalLink } from 'lucide-react';
import { getAISuggestions } from '../services/groq';
import { getExternalIds, searchTMDB } from '../services/tmdb';
import { api } from '../services/api';
import { motion } from 'motion/react';

interface SuggestionsProps {
  library: LibraryEntry[];
  groqApiKey: string;
  tmdbApiKey: string;
  onAdd: (suggestion: Suggestion) => void;
  onSelect: (suggestion: Suggestion) => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Suggestions: React.FC<SuggestionsProps> = ({
  library, groqApiKey, tmdbApiKey, onAdd, onSelect, onToast
}) => {
  const [suggestions, setSuggestions] = useState<(Suggestion & { id?: number, ultimate_score?: number, loadingScore?: boolean })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentType, setCurrentType] = useState<'movie' | 'series' | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');

  const fetchSuggestions = async (type: 'movie' | 'series', keyToUse = groqApiKey) => {
    if (!keyToUse) {
      onToast('error', 'Please provide a Groq API key');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setCurrentType(type);
    setSuggestions([]);

    try {
      // 1. Fetch AI Suggestions from Groq
      let results = await getAISuggestions(library, keyToUse, type);

      // Filter out any accidental library overlaps just in case
      const existingTitles = new Set(library.map(e => e.title.toLowerCase().trim()));
      results = results.filter((item) => !existingTitles.has(item.title.toLowerCase().trim()));

      const initialSuggestions = results.map((item) => ({
        ...item,
        poster: undefined, // Nullify hallucinated AI poster so it doesn't cause 404s before TMDB loads
        loadingScore: true
      }));

      setSuggestions(initialSuggestions);
      setIsLoading(false); // Show basic cards immediately
      onToast('success', 'AI Suggestions generated!');

      // 2. Send all to backend to resolve TMDB/IMDb IDs and fetch Ultimate Score via cache
      if (tmdbApiKey) {
        try {
          const enriched = await api.enrichSuggestions(initialSuggestions, tmdbApiKey);
          setSuggestions(enriched.map(item => ({
            ...item,
            loadingScore: false
          })));
        } catch (err) {
          console.error('Failed to enrich suggestions via backend:', err);
          // Set loading to false as fallback
          setSuggestions(prev => prev.map(s => ({ ...s, loadingScore: false })));
        }
      } else {
        // Finish loading state if no TMDB API key provided
        setSuggestions(prev => prev.map(s => ({ ...s, loadingScore: false })));
      }

    } catch (err: any) {
      onToast('error', err.message || 'Failed to get suggestions');
      setIsLoading(false);
      setHasSearched(false);
    }
  };

  if (!groqApiKey && !hasSearched) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-panel-elevated p-10 rounded-3xl text-center space-y-8 w-full">
          <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
            <Sparkles size={40} />
          </div>
          <h2 className="text-3xl font-bebas tracking-wide">AI Recommendations</h2>
          <p className="text-text-secondary">
            Get deeply personalized movie and series suggestions based on what you love, powered by Groq and LLaMA-3.
          </p>
          <div className="space-y-4 text-left">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              <span>Enter Groq API Key</span>
              <a href="https://console.groq.com/keys" target="_blank" className="text-accent hover:underline flex items-center gap-1">
                Get Free Key <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Paste your key here to unlock..."
              className="input-field w-full text-center"
            />
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => fetchSuggestions('movie', tempApiKey)}
                disabled={!tempApiKey || isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Film size={20} />}
                Movies
              </button>
              <button
                onClick={() => fetchSuggestions('series', tempApiKey)}
                disabled={!tempApiKey || isLoading}
                className="btn-secondary w-full flex items-center justify-center gap-2 py-3"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Tv size={20} />}
                Series
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-panel-elevated p-10 rounded-3xl text-center space-y-8 w-full">
          <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
            <Sparkles size={40} />
          </div>
          <h2 className="text-3xl font-bebas tracking-wide">AI Discovery</h2>
          <p className="text-text-secondary">
            What are you looking for? We'll analyze your taste profile and find hidden gems not in your library.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
            <button
              onClick={() => fetchSuggestions('movie')}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-4 text-lg rounded-2xl"
            >
              <Film size={24} /> Movies
            </button>
            <button
              onClick={() => fetchSuggestions('series')}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-4 text-lg rounded-2xl"
            >
              <Tv size={24} /> Series
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-4 space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bebas tracking-wider text-accent flex items-center gap-3">
            <Sparkles size={28} /> AI {currentType === 'movie' ? 'Movies' : 'Series'}
          </h2>
          <p className="text-xs text-text-secondary font-medium">
            Based on your taste profile
          </p>
        </div>
        <div className="flex gap-3 self-start">
          <button
            onClick={() => setHasSearched(false)}
            className="btn-secondary flex items-center gap-2"
          >
            Go Back
          </button>
          <button
            onClick={() => currentType && fetchSuggestions(currentType)}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Refresh
          </button>
        </div>
      </div>

      {isLoading && suggestions.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 size={48} className="text-accent animate-spin" />
          <p className="text-text-secondary font-medium animate-pulse">Analyzing your taste profile...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {suggestions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel overflow-hidden rounded-[2rem] border border-white/[0.05] hover:border-accent/20 transition-all duration-500 group flex flex-col sm:flex-row h-full relative"
            >
              {s.ultimate_score != null && (
                <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-xl">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Score</div>
                  <div className="text-accent font-bebas text-xl">{Math.round(s.ultimate_score)}</div>
                </div>
              )}
              {s.loadingScore && (
                <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-xl">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  <div className="text-xs font-bold text-accent uppercase tracking-wider">Rating...</div>
                </div>
              )}

              {/* Poster */}
              <div
                className="w-full sm:w-40 shrink-0 aspect-[2/3] sm:aspect-auto relative bg-white/5 cursor-pointer"
                onClick={() => onSelect(s)}
              >
                {s.poster && s.poster !== 'null' ? (
                  <img src={s.poster} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-accent/20 font-bebas text-4xl">
                    {s.title.substring(0, 2)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent sm:hidden" />
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="cursor-pointer" onClick={() => onSelect(s)}>
                      <h3 className="font-bebas text-2xl tracking-wide group-hover:text-accent transition-colors pr-20">{s.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{s.year}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{s.type}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 italic">
                    "{s.reason}"
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={() => onAdd(s)}
                    className="flex-1 bg-accent text-background px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add to Library
                  </button>
                  {s.imdb_id && s.imdb_id !== 'null' && (
                    <button
                      onClick={() => window.open(`stremio:///detail/${s.type === 'movie' ? 'movie' : 'series'}/${s.imdb_id}`, '_blank')}
                      className="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Play size={14} fill="currentColor" /> Watch Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
