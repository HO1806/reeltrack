import React from 'react';
import { Search, X, Loader2, Star, Film, Tv } from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  type: string;
  setType: (t: string) => void;
  status: string;
  setStatus: (s: string) => void;
  genre: string;
  setGenre: (g: string) => void;
  star: number | 'all';
  setStar: (s: number | 'all') => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  genres: string[];
  totalCount: number;
  filteredCount: number;
  activeTab: string;
  suggestions?: any[];
  isSearchingSuggestions?: boolean;
  onSelectSuggestion?: (s: any) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search, setSearch,
  type, setType,
  status, setStatus,
  genre, setGenre,
  star, setStar,
  sortBy, setSortBy,
  genres,
  totalCount, filteredCount,
  activeTab,
  suggestions = [],
  isSearchingSuggestions = false,
  onSelectSuggestion
}) => {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const showTypeFilter = activeTab === 'history';
  const showStatusFilter = false;
  const showStarFilter = activeTab === 'history';

  const activeFilters = [
    { id: 'search', label: `Search: ${search}`, active: search !== '', clear: () => setSearch('') },
    { id: 'type', label: `Type: ${type}`, active: type !== 'all' && showTypeFilter, clear: () => setType('all') },
    { id: 'status', label: `Status: ${status.replace(/_/g, ' ')}`, active: status !== 'all' && showStatusFilter, clear: () => setStatus('all') },
    { id: 'genre', label: `Genre: ${genre}`, active: genre !== 'all', clear: () => setGenre('all') },
    { id: 'star', label: `Rating: ${star}+`, active: star !== 'all', clear: () => setStar('all') },
  ].filter(f => f.active);

  return (
    <div className="sticky top-[60px] left-0 right-0 h-auto min-h-[52px] bg-elevated border-b border-white/5 z-40 flex flex-col px-6 py-2 gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative w-full max-w-[240px] group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search titles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/40 w-full transition-all"
            />

            {/* suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (search.length >= 2) && (suggestions.length > 0 || isSearchingSuggestions) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-elevated border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] backdrop-blur-xl"
                >
                  {isSearchingSuggestions ? (
                    <div className="p-4 flex items-center justify-center text-text-muted gap-2 text-[10px] font-bold uppercase tracking-widest">
                      <Loader2 size={12} className="animate-spin text-accent" /> Searching...
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onSelectSuggestion?.(s)}
                          className="flex items-center gap-3 p-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                        >
                          {s.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w92${s.poster_path}`} className="w-8 h-12 rounded object-cover shadow-lg" alt="" />
                          ) : (
                            <div className="w-8 h-12 rounded bg-white/5 flex items-center justify-center text-white/10">
                              {s.media_type === 'movie' ? <Film size={12} /> : <Tv size={12} />}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-white truncate">{s.title || s.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-text-muted font-bold">
                                {new Date(s.release_date || s.first_air_date || '').getFullYear() || 'N/A'}
                              </span>
                              {s.vote_average > 0 && (
                                <div className="flex items-center gap-0.5 text-yellow-400">
                                  <Star size={8} fill="currentColor" />
                                  <span className="text-[9px] font-bold">{s.vote_average.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-2">
            {showTypeFilter && (
              <div className="relative group">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="bg-white/5 border border-white/5 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-accent/40 cursor-pointer hover:bg-white/10 appearance-none transition-all"
                >
                  <option value="all">Type: All</option>
                  <option value="movie">Movies</option>
                  <option value="series">Series</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-accent transition-colors">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
                </div>
              </div>
            )}

            {showStatusFilter && (
              <div className="relative group">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-white/5 border border-white/5 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-accent/40 cursor-pointer hover:bg-white/10 appearance-none transition-all"
                >
                  <option value="all">Status: All</option>
                  <option value="watched">Watched</option>
                  <option value="watching">Watching</option>
                  <option value="want_to_watch">Want to Watch</option>
                  <option value="dropped">Dropped</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-accent transition-colors">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
                </div>
              </div>
            )}

            {showStarFilter && (
              <div className="relative group">
                <select
                  value={star}
                  onChange={(e) => setStar(e.target.value === 'all' ? 'all' : parseFloat(e.target.value))}
                  className="bg-white/5 border border-white/5 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-accent/40 cursor-pointer hover:bg-white/10 appearance-none transition-all"
                >
                  <option value="all">Rating: All</option>
                  <option value="5">5 Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2.5">2.5+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="1">1+ Star</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-accent transition-colors">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
                </div>
              </div>
            )}

            <div className="relative group">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="bg-white/5 border border-white/5 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-accent/40 cursor-pointer hover:bg-white/10 appearance-none transition-all max-w-[140px]"
              >
                <option value="all">Genre: All</option>
                {genres.sort().map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-accent transition-colors">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
              </div>
            </div>

            <div className="relative group">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/5 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-accent/40 cursor-pointer hover:bg-white/10 appearance-none transition-all"
              >
                <option value="smartScore">Smart Score ↓</option>
                <option value="dateAdded">Date Added ↓</option>
                <option value="rating">Rating ↓</option>
                <option value="title">Title A-Z</option>
                <option value="year">Year ↓</option>
                <option value="recentlyWatched">Recently Watched</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted group-hover:text-accent transition-colors">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">
          Showing <span className="text-accent">{filteredCount}</span> of <span className="text-white">{totalCount}</span>
        </div>
      </div>

      {/* Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pb-1">
          {activeFilters.map(filter => (
            <div
              key={filter.id}
              className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            >
              <span>{filter.label}</span>
              <button onClick={filter.clear} className="hover:text-white transition-colors">
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={() => { setSearch(''); setType('all'); setStatus('all'); setGenre('all'); }}
            className="text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors ml-2"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
