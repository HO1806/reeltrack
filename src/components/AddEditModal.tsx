import React, { useState, useEffect } from 'react';
import { Search, Star, Plus, Minus, Calendar, Clock, Tv, Film, Play, Sparkles, Loader2, Save, Info, Tag, Hash } from 'lucide-react';
import { LibraryEntry, MediaType, WatchStatus } from '../types';
import { cn, generateId } from '../utils';
import { searchTMDB, getExternalIds } from '../services/tmdb';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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
  const [isScoring, setIsScoring] = useState(false);

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
    onToast('info', 'Enriching data through cinematic channels...');
    setIsScoring(true);
    try {
      const extIds = await getExternalIds(result.id, result.media_type, tmdbApiKey);
      const imdbId = extIds.imdb_id;

      if (!imdbId) {
        onToast('error', 'IMDb index not found for this masterpiece.');
        setIsScoring(false);
        return;
      }

      const enrichedData = await api.fetchFromImdb(imdbId, tmdbApiKey);
      const enriched = enrichedData.entry;

      if (!enriched) {
        onToast('error', 'Enrichment data sync failed.');
        setIsScoring(false);
        return;
      }

      console.log('[ReelTrack] Enriched entry from backend:', JSON.stringify(enriched, null, 2));

      setFormData(prev => {
        const next = { ...prev };
        if (enriched.title) next.title = enriched.title;
        if (enriched.type) next.type = enriched.type as any;
        if (enriched.year) next.year = parseInt(String(enriched.year));
        if (enriched.runtime) next.runtime = parseInt(String(enriched.runtime));
        if (enriched.poster) next.poster = enriched.poster;
        if (enriched.description) next.description = enriched.description;
        if (enriched.director) next.director = enriched.director;
        if (enriched.genres) {
          next.genres = Array.isArray(enriched.genres)
            ? enriched.genres
            : String(enriched.genres).split(',').map((s: any) => s.trim()).filter(Boolean);
        }
        if (enriched.cast) {
          next.cast = Array.isArray(enriched.cast) ? enriched.cast : [String(enriched.cast)];
        }
        if (enriched.streamingUrl) next.streamingUrl = enriched.streamingUrl;
        if (enriched.tmdbPopularity) next.tmdbPopularity = enriched.tmdbPopularity;
        if (enriched.vote_average) next.vote_average = enriched.vote_average;
        if (enriched.seasons) next.seasons = enriched.seasons;
        next.imdbId = imdbId;
        next.tmdbId = enriched.tmdbId || result.id;
        next.ultimate_score = enriched.ultimate_score;
        next.imdb_10 = enriched.imdb_10;
        next.m_val = enriched.m_val;
        next.rc_val = enriched.rc_val;
        next.ra_val = enriched.ra_val;
        console.log('[ReelTrack] Updated form state:', JSON.stringify(next, null, 2));
        return next;
      });

      if (enriched.ultimate_score) {
        onToast('success', `Analytics Complete: ${(enriched.ultimate_score / 10).toFixed(1)} ★ Ultimate Score`);
      } else {
        onToast('success', 'Metadata synchronized successfully.');
      }
      setIsScoring(false);
    } catch (e: any) {
      onToast('error', e.message || 'Synchronization failed.');
      setIsScoring(false);
    }
  };

  const calculateOverall = (rating: any) => {
    const values = [rating.story, rating.acting, rating.visuals].filter(v => v !== null) as number[];
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const handleRatingChange = (key: keyof typeof formData.rating, value: number) => {
    setFormData(prev => {
      const newRating = { ...(prev.rating || {}), [key]: value };
      return {
        ...prev,
        rating: {
          ...newRating,
          overall: calculateOverall(newRating)
        } as any
      };
    });
  };

  const handleSave = () => {
    if (!formData.title) {
      onToast('error', 'Title is mandatory');
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/90 backdrop-blur-xl"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl glass-panel rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row h-full max-h-[850px] border border-white/10"
      >
        {/* Sidebar Tabs (Desktop) */}
        <div className="w-full md:w-64 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
          <div className="p-8 border-b border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center shadow-accent-glow">
              <Sparkles size={20} className="text-background" />
            </div>
            <div>
              <h2 className="font-bebas text-2xl tracking-wider text-white">
                {editingEntry ? 'Edit Title' : 'New Entry'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Master Registry</p>
            </div>
          </div>

          <div className="p-4 flex flex-row md:flex-col gap-2">
            {[
              { id: 'details', label: 'Core Metadata', icon: Info },
              { id: 'take', label: 'The Experience', icon: Star }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 md:flex-none flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all group",
                  activeTab === tab.id
                    ? "bg-accent text-background shadow-accent-glow"
                    : "text-text-secondary hover:text-white hover:bg-white/5"
                )}
              >
                <tab.icon size={16} />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto p-6 hidden md:block">
            {formData.poster && (
              <div className="aspect-[2/3] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
                <img src={formData.poster} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
              </div>
            )}
          </div>
        </div>

        {/* Main Form Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'details' ? (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  {/* Title Section */}
                  <div className="space-y-4">
                    <div className="flex gap-3 items-end">
                      <div className="relative flex-1 group">
                        <Input
                          label="Title & Recognition"
                          value={formData.title || ''}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="font-bold"
                          placeholder="What have you watched?"
                        />
                        <AnimatePresence>
                          {tmdbResults.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-4 glass-panel rounded-3xl overflow-hidden z-[110] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10"
                            >
                              {tmdbResults.map(res => (
                                <button
                                  key={res.id}
                                  onClick={() => selectTmdbResult(res)}
                                  className="w-full px-6 py-4 text-left hover:bg-accent/10 flex items-center gap-5 border-b border-white/5 last:border-0 transition-all group"
                                >
                                  <div className="w-12 h-16 shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-lg">
                                    {res.poster_path ? (
                                      <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[8px] font-bebas opacity-30">NO POSTER</div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-base font-bold text-white group-hover:text-accent transition-colors">{res.title || res.name}</div>
                                    <div className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em]">
                                      {res.media_type} <span className="text-accent/30 mx-2">•</span> {new Date(res.release_date || res.first_air_date).getFullYear() || 'N/A'}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <Button
                        onClick={handleTmdbSearch}
                        disabled={isSearching}
                        variant="secondary"
                        size="icon"
                        className="w-16 h-[68px] rounded-2xl bg-surface-active border border-border-default hover:bg-accent hover:text-background hover:scale-105 active:scale-95 group shadow-xl mb-1"
                        title="Fetch Master Metadata"
                        aria-label="Fetch Master Metadata"
                      >
                        {isSearching ? <Loader2 size={24} className="animate-spin text-accent" /> : <Search size={24} className="group-hover:text-background" />}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {/* Media Type */}
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted">Classification</label>
                      <div className="flex bg-white/5 p-1.5 rounded-[20px] border border-white/5 shadow-inner">
                        <button
                          onClick={() => setFormData({ ...formData, type: 'movie' })}
                          className={cn(
                            "flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                            formData.type === 'movie' ? "bg-accent text-background shadow-accent-glow" : "text-text-secondary hover:text-white"
                          )}
                        >
                          <Film size={16} /> Movie
                        </button>
                        <button
                          onClick={() => setFormData({ ...formData, type: 'series' })}
                          className={cn(
                            "flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                            formData.type === 'series' ? "bg-accent text-background shadow-accent-glow" : "text-text-secondary hover:text-white"
                          )}
                        >
                          <Tv size={16} /> Series
                        </button>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted">Viewing Status</label>
                      <div className="relative">
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as WatchStatus })}
                          className="input-field w-full pr-12 text-sm font-bold bg-white/5 border-white/10 appearance-none cursor-pointer"
                        >
                          <option value="want_to_watch">Plan to Watch</option>
                          <option value="watching">Currently Watching</option>
                          <option value="watched">Completed</option>
                          <option value="dropped">Dropped</option>
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Year & Runtime */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Input
                        label={<><Calendar size={14} className="text-accent" /> Release Year</>}
                        type="number"
                        value={formData.year || ''}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                        className="font-bold text-center"
                        placeholder="2026"
                      />
                    </div>
                    <div className="space-y-4">
                      <Input
                        label={<><Clock size={14} className="text-accent" /> Duration (m)</>}
                        type="number"
                        value={formData.runtime || ''}
                        onChange={(e) => setFormData({ ...formData, runtime: parseInt(e.target.value) })}
                        className="font-bold text-center"
                        placeholder="120"
                      />
                    </div>
                  </div>

                  {/* Series Specifics */}
                  {formData.type === 'series' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-3 gap-6 p-8 bg-white/[0.03] rounded-[32px] border border-white/5 shadow-xl"
                    >
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted text-center block">Total Seasons</label>
                        <input type="number" value={formData.seasons || 0} onChange={(e) => setFormData({ ...formData, seasons: parseInt(e.target.value) })} className="input-field w-full text-center font-bold bg-background/50 border-white/5" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted text-center block">Current S</label>
                        <input type="number" value={formData.currentSeason || 1} onChange={(e) => setFormData({ ...formData, currentSeason: parseInt(e.target.value) })} className="input-field w-full text-center font-bold bg-accent/10 border-accent/20 text-accent" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted text-center block">Current E</label>
                        <input type="number" value={formData.currentEpisode || 1} onChange={(e) => setFormData({ ...formData, currentEpisode: parseInt(e.target.value) })} className="input-field w-full text-center font-bold bg-accent/10 border-accent/20 text-accent" />
                      </div>
                    </motion.div>
                  )}

                  {/* Description */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted">Master Synopsis</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input-field w-full h-32 resize-none text-sm leading-relaxed"
                      placeholder="Share the plot details..."
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="take"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  {/* Rating Scales */}
                  <div className="space-y-8 glass-panel p-10 rounded-[40px] border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] rounded-full -mr-32 -mt-32" />

                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-accent flex items-center gap-4">
                      <div className="w-10 h-[1px] bg-accent/30" /> Subjective Critique
                    </h4>

                    <div className="space-y-8">
                      {[
                        { key: 'story', label: 'Story & Narrative', icon: Film },
                        { key: 'acting', label: 'Performance & Cast', icon: Sparkles },
                        { key: 'visuals', label: 'Cinematography', icon: Plus }
                      ].map(item => (
                        <div key={item.key} className="space-y-4">
                          <div className="flex justify-between items-center pr-2">
                            <div className="flex items-center gap-3">
                              <item.icon size={16} className="text-accent/60" />
                              <span className="text-xs font-black uppercase tracking-widest text-text-primary">{item.label}</span>
                            </div>
                            <span className="text-xl font-bebas text-accent tracking-widest">{formData.rating?.[item.key as keyof typeof formData.rating] || 0}<span className="text-[10px] text-accent/40 ml-1">/10</span></span>
                          </div>
                          <div className="relative group/slider">
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              value={formData.rating?.[item.key as keyof typeof formData.rating] || 0}
                              onChange={(e) => handleRatingChange(item.key as any, parseFloat(e.target.value))}
                              className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-10 pt-10 border-t border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-1">Calculated Average</p>
                        <h3 className="font-bebas text-6xl text-accent leading-none">
                          {formData.rating?.overall ? formData.rating.overall.toFixed(1) : '0.0'}
                        </h3>
                      </div>
                      <div className="w-24 h-24 rounded-full border-4 border-accent/20 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-accent/10 blur-[20px]" />
                        <Star size={40} className="text-accent fill-accent shadow-accent-glow" />
                      </div>
                    </div>
                  </div>

                  {/* Rewatch Logic */}
                  <div className="flex items-center justify-between p-8 bg-white/[0.03] rounded-[32px] border border-white/5 group hover:border-accent/20 transition-all">
                    <div className="flex flex-col">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted mb-1">Rewatch Frequency</h4>
                      <p className="text-xs font-medium text-text-secondary">How many times have you revisited this?</p>
                    </div>
                    <div className="flex items-center gap-6 bg-background/50 p-2 rounded-2xl border border-white/5">
                      <button
                        onClick={() => setFormData({ ...formData, rewatchCount: Math.max(0, (formData.rewatchCount || 0) - 1) })}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="font-bebas text-4xl text-white w-12 text-center">{formData.rewatchCount || 0}</span>
                      <button
                        onClick={() => setFormData({ ...formData, rewatchCount: (formData.rewatchCount || 0) + 1 })}
                        className="w-10 h-10 rounded-xl bg-accent text-background flex items-center justify-center transition-all hover:scale-105 active:scale-90 shadow-accent-glow"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Tags & Personal Note */}
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted flex items-center gap-2">
                        <Tag size={14} className="text-accent" /> Meta Tags
                      </label>
                      <input
                        type="text"
                        value={formData.tags?.join(', ') || ''}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="input-field w-full py-4 bg-white/5 border-white/10"
                        placeholder="Masterpiece, Rewatchable, Sci-Fi..."
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-text-muted">Personal Reflections</label>
                      <textarea
                        value={formData.personalNote || ''}
                        onChange={(e) => setFormData({ ...formData, personalNote: e.target.value })}
                        className="input-field w-full h-40 resize-none text-sm p-6 leading-relaxed"
                        placeholder="Capture your thoughts on this experience..."
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="px-12 py-8 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-6">
            <div className="hidden sm:flex items-center gap-3">
              {isScoring && (
                <div className="flex items-center gap-3 text-accent text-[10px] font-black uppercase tracking-widest animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  Synchronizing Collective Wisdom...
                </div>
              )}
              {!isScoring && formData.imdbId && (
                <div className="flex items-center gap-2 text-text-muted text-[10px] font-black uppercase tracking-widest">
                  <Hash size={12} className="text-accent" />
                  ID INDEXED
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Button onClick={onClose} variant="secondary" className="px-8 py-3.5 flex-1 sm:flex-none">Cancel</Button>
              <Button
                onClick={handleSave}
                variant="primary"
                className="px-10 py-3.5 flex-1 sm:flex-none"
              >
                <Save size={18} />
                {editingEntry ? 'Update Registry' : 'Save Mastermind'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
