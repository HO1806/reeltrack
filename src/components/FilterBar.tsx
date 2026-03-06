import React from 'react';
import { Search, X, Loader2, Star, Film, Tv, ChevronDown, ListFilter, Trash2 } from 'lucide-react';
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
  starDirection: 'above' | 'below';
  setStarDirection: (d: 'above' | 'below') => void;
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
  starDirection, setStarDirection,
  sortBy, setSortBy,
  genres,
  totalCount, filteredCount,
  activeTab,
  suggestions = [],
  isSearchingSuggestions = false,
  onSelectSuggestion
}) => {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);
  const filterBarRef = React.useRef<HTMLDivElement>(null);

  const showTypeFilter = activeTab === 'history';
  const showStatusFilter = false;
  const showStarFilter = ['movies', 'series', 'history', 'favorites'].includes(activeTab);

  // Close menus on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menuId: string) => {
    setActiveMenu(prev => prev === menuId ? null : menuId);
  };

  // Handle keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      onSelectSuggestion?.(suggestions[selectedIndex]);
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [search, suggestions]);

  const activeFilters = [
    { id: 'search', label: `Search: ${search}`, active: search !== '', clear: () => setSearch('') },
    { id: 'type', label: `Type: ${type}`, active: type !== 'all' && showTypeFilter, clear: () => setType('all') },
    { id: 'status', label: `Status: ${(status || '').replace(/_/g, ' ')}`, active: status !== 'all' && showStatusFilter, clear: () => setStatus('all') },
    { id: 'genre', label: `Genre: ${genre}`, active: genre !== 'all', clear: () => setGenre('all') },
    { id: 'star', label: `Rating: ${starDirection === 'above' ? '≥' : '≤'} ${star}`, active: star !== 'all', clear: () => setStar('all') },
  ].filter(f => f.active);

  return (
    <div ref={filterBarRef} className="sticky top-nav z-[120] px-2 sm:px-4 w-full py-4">
      <div className="w-full max-w-filter-max mx-auto flex flex-col gap-4">
        {/* The Command Pill */}
        <div className="glass-panel-elevated bg-background/80 backdrop-blur-3xl rounded-full border border-white/[0.12] p-1.5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex items-center gap-2 group transition-all duration-500 hover:border-white/30 relative">
          {/* Subtle reflection effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] via-transparent to-white/[0.05] pointer-events-none" />

          {/* Search Segment */}
          <div className="relative flex-1 min-w-0 ml-4 flex items-center gap-3 z-10">
            <Search className="text-text-muted group-focus-within:text-accent transition-all duration-500 shrink-0" size={18} />
            <input
              type="text"
              aria-label="Search Matrix"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="bg-transparent border-none focus:ring-0 focus:outline-none p-0 py-2.5 text-sm font-medium w-full transition-all placeholder:text-text-muted/30 text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-2 hover:bg-white/5 rounded-full text-text-muted hover:text-white transition-colors mr-2"
              >
                <X size={14} />
              </button>
            )}

            {/* suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (search.length >= 2) && (suggestions.length > 0 || isSearchingSuggestions) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full left-[-16px] right-[-100px] sm:right-0 pt-3 z-[100]"
                >
                  <div className="glass-panel-elevated backdrop-blur-3xl rounded-[28px] shadow-[0_40px_80px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10">
                    {isSearchingSuggestions ? (
                      <div className="p-8 flex flex-col items-center justify-center text-text-muted gap-4 text-[11px] font-black uppercase tracking-[0.2em]">
                        <div className="relative">
                          <div className="absolute inset-0 bg-accent/20 blur-xl animate-pulse" />
                          <Loader2 size={24} className="animate-spin text-accent relative z-10" />
                        </div>
                        <span>Syncing Data Stream...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col p-2 max-h-[400px] overflow-y-auto no-scrollbar">
                        {suggestions.map((s, idx) => (
                          <button
                            key={s.id}
                            onClick={() => onSelectSuggestion?.(s)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={cn(
                              "flex items-center gap-4 p-3 rounded-2xl transition-all text-left group/item relative overflow-hidden",
                              selectedIndex === idx ? "bg-accent/10 translate-x-1" : "hover:bg-white/5"
                            )}
                          >
                            {selectedIndex === idx && <div className="absolute left-0 top-2 bottom-2 w-1 bg-accent rounded-full" />}
                            <div className="w-10 h-14 shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-lg transition-transform group-hover/item:scale-105">
                              {s.poster_path ? (
                                <img src={`https://image.tmdb.org/t/p/w92${s.poster_path}`} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/10">
                                  {s.media_type === 'movie' ? <Film size={14} /> : <Tv size={14} />}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={cn(
                                "text-sm font-bold transition-colors truncate",
                                selectedIndex === idx ? "text-accent" : "text-white"
                              )}>{s.title || s.name}</span>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted font-black uppercase tracking-widest">
                                <span>{new Date(s.release_date || s.first_air_date || '').getFullYear() || 'N/A'}</span>
                                <span>•</span>
                                <span>{s.media_type}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-6 w-[1px] bg-white/10 shrink-0" />

          {/* Quick Filters Group */}
          <div className="flex items-center gap-1.5 px-2">
            {/* Type Toggles - Hidden on very small screens, icons on medium */}
            {showTypeFilter && (
              <div className="hidden xs:flex bg-white/[0.04] p-1 rounded-full border border-white/[0.04]">
                {[
                  { id: 'all', label: 'All', icon: ListFilter },
                  { id: 'movie', label: 'Film', icon: Film },
                  { id: 'series', label: 'Show', icon: Tv }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      type === t.id ? "bg-accent text-background shadow-accent-glow" : "text-text-secondary hover:text-white"
                    )}
                  >
                    <t.icon size={12} />
                    <span className="hidden lg:inline">{t.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Rating Stars - Mini Select */}
            {showStarFilter && (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => toggleMenu('star')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/[0.08] transition-all",
                    star !== 'all' ? "bg-accent/10 border-accent/20 text-accent" : "bg-white/[0.04] text-text-secondary hover:text-white",
                    activeMenu === 'star' && "border-accent/40 bg-white/10"
                  )}
                >
                  <Star size={12} fill={star !== 'all' ? "currentColor" : "none"} />
                  <span className="hidden md:inline">{star === 'all' ? 'Any' : `${starDirection === 'above' ? '≥' : '≤'} ${star}`}</span>
                </button>
                <div className={cn(
                  "absolute top-full right-0 transition-all duration-300 z-[110] pt-2",
                  activeMenu === 'star' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2 pointer-events-none"
                )}>
                  <div className="bg-[#0a0a0a] p-2 rounded-[24px] border border-white/10 shadow-2xl flex flex-col gap-1 min-w-[160px]">
                    <div className="flex bg-white/5 p-1 rounded-xl mb-1 shrink-0 relative z-[130]">
                      {(['above', 'below'] as const).map(d => (
                        <button
                          key={d}
                          onClick={(e) => { e.stopPropagation(); setStarDirection(d); }}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                            starDirection === d ? "bg-accent text-background shadow-sm" : "text-text-muted hover:text-white"
                          )}
                        >
                          {d === 'above' ? 'At Least' : 'At Most'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setStar('all'); setActiveMenu(null); }}
                      className={cn("px-4 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-wider transition-colors", star === 'all' ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}
                    >Any Rating</button>
                    {[90, 80, 70, 60, 50].map(val => (
                      <button
                        key={val}
                        onClick={() => { setStar(val); setActiveMenu(null); }}
                        className={cn("px-4 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-between", star === val ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}
                      >
                        <span>{starDirection === 'above' ? `${val}+` : `-${val}`} Score</span>
                        <Star size={10} fill={star === val ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Selectors - Collapsed on Mobile */}
            <div className="flex items-center gap-1.5 ml-2">
              <div className="relative hidden sm:block">
                <button
                  onClick={() => toggleMenu('genre')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/[0.04] border border-white/[0.08] text-text-secondary hover:text-white hover:border-white/20 transition-all",
                    activeMenu === 'genre' && "border-white/30 bg-white/10 text-white"
                  )}
                >
                  <ListFilter size={12} />
                  <span className="hidden lg:inline">Genres</span>
                  <ChevronDown size={10} className={cn("opacity-40 transition-transform", activeMenu === 'genre' && "rotate-180")} />
                </button>
                <div className={cn(
                  "absolute top-full right-0 transition-all duration-300 z-[110] pt-2",
                  activeMenu === 'genre' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2 pointer-events-none"
                )}>
                  <div className="bg-[#0a0a0a] p-2 rounded-[24px] border border-white/10 shadow-2xl flex flex-col gap-1 min-w-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => { setGenre('all'); setActiveMenu(null); }}
                      className={cn("px-4 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-wider transition-colors", genre === 'all' ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}
                    >All Genres</button>
                    {genres.map(g => (
                      <button
                        key={g}
                        onClick={() => { setGenre(g); setActiveMenu(null); }}
                        className={cn("px-4 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-wider transition-colors", genre === g ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}
                      >{g}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sort Switcher - Replaced with icon on ultra small */}
              <div className="relative">
                <button
                  onClick={() => toggleMenu('sort')}
                  className={cn(
                    "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-accent/[0.04] border border-accent/[0.1] text-accent hover:bg-accent hover:text-background transition-all shadow-accent-glow",
                    activeMenu === 'sort' && "bg-accent text-background"
                  )}
                >
                  <ChevronDown size={12} className={cn("transition-transform", activeMenu === 'sort' && "rotate-180")} />
                  <span className="hidden sm:inline">Sort</span>
                </button>
                <div className={cn(
                  "absolute top-full right-0 transition-all duration-300 z-[110] pt-2",
                  activeMenu === 'sort' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2 pointer-events-none"
                )}>
                  <div className="bg-[#0a0a0a] p-2 rounded-[24px] border border-white/10 shadow-2xl flex flex-col gap-1 min-w-[180px]">
                    {[
                      { id: 'smartScore', label: 'Smart Score ↓' },
                      { id: 'dateAdded', label: 'Date Added ↓' },
                      { id: 'rating', label: 'Rating ↓' },
                      { id: 'title', label: 'Title A-Z' },
                      { id: 'year', label: 'Year ↓' },
                      { id: 'recentlyWatched', label: 'Recents' }
                    ].filter(s => !(activeTab === 'history' && s.id === 'smartScore')).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSortBy(s.id); setActiveMenu(null); }}
                        className={cn("px-4 py-2 rounded-xl text-left text-[10px] font-black uppercase tracking-wider transition-colors", sortBy === s.id ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile "More" Menu - Genre/Rating for small screens */}
              <div className="relative sm:hidden">
                <button
                  onClick={() => toggleMenu('mobile')}
                  className={cn(
                    "p-2.5 rounded-full border transition-all",
                    activeMenu === 'mobile' ? "bg-white/20 border-white/30 text-white" : "bg-white/[0.04] border-white/[0.08] text-text-secondary hover:text-white"
                  )}
                >
                  <ListFilter size={16} />
                </button>
                <div className={cn(
                  "absolute top-full right-0 transition-all duration-300 z-[110] pt-2",
                  activeMenu === 'mobile' ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2 pointer-events-none"
                )}>
                  <div className="bg-[#0a0a0a] p-3 rounded-[24px] border border-white/10 shadow-2xl flex flex-col gap-4 min-w-[200px]">
                    {/* Compact Rating Selection */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted px-2">Rating</span>
                      <div className="flex flex-wrap gap-1">
                        {['all', 90, 80, 70, 60, 50].map(v => (
                          <button
                            key={v}
                            onClick={() => { setStar(v as any); setActiveMenu(null); }}
                            className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", star === v ? "bg-accent text-background" : "bg-white/[0.04] text-text-secondary")}
                          >{v === 'all' ? 'Any' : `${v}+`}</button>
                        ))}
                      </div>
                    </div>
                    {/* Compact Genre Selection */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted px-2">Genre</span>
                      <div className="max-h-[300px] overflow-y-auto no-scrollbar flex flex-col gap-1">
                        <button onClick={() => { setGenre('all'); setActiveMenu(null); }} className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase text-left", genre === 'all' ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}>All</button>
                        {genres.sort().map(g => (
                          <button key={g} onClick={() => { setGenre(g); setActiveMenu(null); }} className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase text-left", genre === g ? "bg-accent text-background" : "hover:bg-white/5 text-text-secondary")}>{g}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pr-4 shrink-0 flex items-center gap-3">
            <button
              onClick={() => {
                setSearch('');
                setType('all');
                setStatus('all');
                setGenre('all');
                setStar('all');
                setStarDirection('above');
              }}
              disabled={activeFilters.length === 0}
              className={cn(
                "p-1.5 rounded-full transition-all",
                activeFilters.length > 0
                  ? "text-red-500 hover:bg-red-500/10 hover:text-red-400"
                  : "text-white/20 cursor-not-allowed"
              )}
              title="Reset Filters"
            >
              <X size={16} />
            </button>
            <div className="hidden sm:flex items-center gap-2 font-bebas text-lg tracking-tight">
              <span className="text-accent">{filteredCount}</span>
              <span className="text-white/10">/</span>
              <span className="text-white/30">{totalCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
