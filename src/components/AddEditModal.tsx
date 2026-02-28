import React, { useState, useEffect } from 'react';
import { X, Search, Star, Plus, Minus, Calendar, Clock, Tv, Film, ExternalLink, Loader2 } from 'lucide-react';
import { LibraryEntry, MediaType, WatchStatus } from '../types';
import { cn, generateId } from '../utils';
import { searchTMDB, getTMDBMetadata } from '../services/tmdb';
import { motion, AnimatePresence } from 'motion/react';

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: LibraryEntry) => void;
  editingEntry: LibraryEntry | null;
  tmdbApiKey: string;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AddEditModal: React.FC<AddEditModalProps> = ({
  isOpen, onClose, onSave, editingEntry, tmdbApiKey, onToast
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'take'>('details');
  const [formData, setFormData] = useState<Partial<LibraryEntry>>({});
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (editingEntry) {
      setFormData(editingEntry);
    } else {
      setFormData({
        type: 'movie',
        status: 'want_to_watch',
        rating: { story: null, acting: null, visuals: null, overall: null },
        rewatchCount: 0,
        currentSeason: 1,
        currentEpisode: 1,
        genres: [],
        cast: [],
        tags: [],
        isFavorite: false,
        isPinned: false,
        notifiedUnrated: false,
        tmdbPopularity: 0,
        dateAdded: new Date().toISOString()
      });
    }
    setActiveTab('details');
  }, [editingEntry, isOpen]);

  const handleTmdbSearch = async () => {
    if (!formData.title) return;
    if (!tmdbApiKey) {
      onToast('info', 'Add your TMDB API key in Settings ⚙️');
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchTMDB(formData.title, tmdbApiKey);
      setTmdbResults(results.slice(0, 5));
    } catch (e) {
      onToast('error', 'Failed to search TMDB');
    } finally {
      setIsSearching(false);
    }
  };

  const selectTmdbResult = async (result: any) => {
    setTmdbResults([]);
    onToast('info', 'Fetching full metadata...');
    try {
      const metadata = await getTMDBMetadata(result.id, result.media_type, tmdbApiKey);
      setFormData(prev => ({
        ...prev,
        ...metadata,
        type: result.media_type === 'tv' ? 'series' : 'movie'
      }));
      onToast('success', 'Metadata fetched ✓');
    } catch (e) {
      onToast('error', 'Failed to fetch full metadata');
    }
  };

  const calculateOverall = (rating: any) => {
    const values = [rating.story, rating.acting, rating.visuals].filter(v => v !== null) as number[];
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const handleRatingChange = (key: keyof typeof formData.rating, value: number) => {
    const newRating = { ...formData.rating, [key]: value };
    newRating.overall = calculateOverall(newRating);
    setFormData(prev => ({ ...prev, rating: newRating as any }));
  };

  const handleSave = () => {
    if (!formData.title) {
      onToast('error', 'Title is required');
      return;
    }
    onSave({
      ...formData,
      id: formData.id || generateId(),
      dateAdded: formData.dateAdded || new Date().toISOString()
    } as LibraryEntry);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative w-full max-w-2xl bg-card border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('details')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-all",
                activeTab === 'details' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              Details
            </button>
            <button 
              onClick={() => setActiveTab('take')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest transition-all",
                activeTab === 'take' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              My Take
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-card to-background">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Title & Search */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-accent/60">Title</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input-field w-full bg-white/5 border-white/10 focus:border-accent/50 placeholder:text-white/20"
                      placeholder="Enter movie or series title..."
                    />
                    <AnimatePresence>
                      {tmdbResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-2xl overflow-hidden z-[110] shadow-2xl border border-white/10"
                        >
                          {tmdbResults.map(res => (
                            <button
                              key={res.id}
                              onClick={() => selectTmdbResult(res)}
                              className="w-full px-4 py-3 text-left hover:bg-accent/10 flex items-center gap-4 border-b border-white/5 last:border-0 transition-colors group"
                            >
                              <div className="w-10 h-14 shrink-0 rounded overflow-hidden bg-white/5 border border-white/10">
                                {res.poster_path ? (
                                  <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] font-bebas opacity-30">NO POSTER</div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-bold group-hover:text-accent transition-colors">{res.title || res.name}</div>
                                <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                                  {res.media_type} • {new Date(res.release_date || res.first_air_date).getFullYear() || 'N/A'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={handleTmdbSearch}
                    disabled={isSearching}
                    className="btn-secondary flex items-center gap-2 px-4 shrink-0 border-accent/20 hover:border-accent/50"
                  >
                    {isSearching ? <Loader2 size={18} className="animate-spin text-accent" /> : <Search size={18} className="text-accent" />}
                    <span className="hidden sm:inline">Fetch Metadata</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Type */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-accent/60">Type</label>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    <button 
                      onClick={() => setFormData({ ...formData, type: 'movie' })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all flex items-center justify-center gap-2", 
                        formData.type === 'movie' ? "bg-accent text-background shadow-lg" : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Film size={14} /> MOVIE
                    </button>
                    <button 
                      onClick={() => setFormData({ ...formData, type: 'series' })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all flex items-center justify-center gap-2", 
                        formData.type === 'series' ? "bg-accent text-background shadow-lg" : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Tv size={14} /> SERIES
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-accent/60">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as WatchStatus })}
                    className="input-field w-full text-xs bg-white/5 border-white/10 appearance-none cursor-pointer"
                  >
                    <option value="want_to_watch">Watchlist</option>
                    <option value="watching">Watching</option>
                    <option value="watched">Watched</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Year</label>
                  <input 
                    type="number"
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Runtime (min)</label>
                  <input 
                    type="number"
                    value={formData.runtime || ''}
                    onChange={(e) => setFormData({ ...formData, runtime: parseInt(e.target.value) })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              {formData.type === 'series' && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-2xl">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-text-secondary">Seasons</label>
                    <input type="number" value={formData.seasons || 0} onChange={(e) => setFormData({ ...formData, seasons: parseInt(e.target.value) })} className="input-field w-full text-center" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-text-secondary">Current S</label>
                    <input type="number" value={formData.currentSeason || 1} onChange={(e) => setFormData({ ...formData, currentSeason: parseInt(e.target.value) })} className="input-field w-full text-center" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-text-secondary">Current E</label>
                    <input type="number" value={formData.currentEpisode || 1} onChange={(e) => setFormData({ ...formData, currentEpisode: parseInt(e.target.value) })} className="input-field w-full text-center" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Genres (comma separated)</label>
                <input 
                  type="text"
                  value={formData.genres?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, genres: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="input-field w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Poster URL</label>
                <div className="flex gap-4">
                  {formData.poster && <img src={formData.poster} className="w-16 h-24 rounded-lg object-cover border border-white/10" />}
                  <input 
                    type="text"
                    value={formData.poster || ''}
                    onChange={(e) => setFormData({ ...formData, poster: e.target.value })}
                    className="input-field flex-1"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Description</label>
                <textarea 
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field w-full h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">IMDb ID</label>
                  <input type="text" value={formData.imdbId || ''} onChange={(e) => setFormData({ ...formData, imdbId: e.target.value })} className="input-field w-full" placeholder="tt1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Streaming URL</label>
                  <input type="text" value={formData.streamingUrl || ''} onChange={(e) => setFormData({ ...formData, streamingUrl: e.target.value })} className="input-field w-full" placeholder="stremio:///..." />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Ratings */}
              <div className="space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-accent">Ratings</h4>
                {[
                  { key: 'story', label: 'Story' },
                  { key: 'acting', label: 'Acting' },
                  { key: 'visuals', label: 'Visuals' }
                ].map(item => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{item.label}</span>
                      <span className="text-accent">{formData.rating?.[item.key as keyof typeof formData.rating] || 0}/10</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={formData.rating?.[item.key as keyof typeof formData.rating] || 0}
                      onChange={(e) => handleRatingChange(item.key as any, parseFloat(e.target.value))}
                      className="w-full accent-accent bg-white/10 rounded-lg h-2 appearance-none cursor-pointer"
                    />
                  </div>
                ))}
                
                <div className="bg-accent/10 border border-accent/20 p-6 rounded-2xl text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Overall Score</div>
                  <div className="text-4xl font-bebas text-accent">
                    {formData.rating?.overall ? formData.rating.overall.toFixed(1) : '—'}
                  </div>
                </div>
              </div>

              {/* Rewatch */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <RotateCcw size={20} className="text-accent" />
                  <span className="text-sm font-bold">Rewatched</span>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setFormData({ ...formData, rewatchCount: Math.max(0, (formData.rewatchCount || 0) - 1) })}
                    className="p-2 bg-white/5 rounded-lg hover:bg-white/10"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-bebas text-2xl w-8 text-center">{formData.rewatchCount || 0}</span>
                  <button 
                    onClick={() => setFormData({ ...formData, rewatchCount: (formData.rewatchCount || 0) + 1 })}
                    className="p-2 bg-white/5 rounded-lg hover:bg-white/10"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Personal Note */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Personal Note</label>
                <textarea 
                  value={formData.personalNote || ''}
                  onChange={(e) => setFormData({ ...formData, personalNote: e.target.value })}
                  className="input-field w-full h-32 resize-none"
                  placeholder="Your thoughts, quotes you loved, why you'd rewatch..."
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Tags (comma separated)</label>
                <input 
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="input-field w-full"
                />
              </div>

              {/* Date Watched */}
              {formData.status === 'watched' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Date Watched</label>
                  <input 
                    type="date"
                    value={formData.dateWatched?.split('T')[0] || ''}
                    onChange={(e) => setFormData({ ...formData, dateWatched: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="input-field w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">Save Entry</button>
        </div>
      </motion.div>
    </div>
  );
};

const RotateCcw = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
