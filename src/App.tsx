import React, { useState, useEffect, useMemo } from 'react';
import { LibraryEntry, Settings, Suggestion, WatchStatus, Notification } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LibraryGrid } from './components/LibraryGrid';
import { AddEditModal } from './components/AddEditModal';
import { ImportModal } from './components/ImportModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { StatsDashboard } from './components/StatsDashboard';
import { Suggestions } from './components/Suggestions';
import { MovieDetails } from './components/MovieDetails';
import { ToastContainer, ToastMessage } from './components/Toast';
import { generateId, normalizeTitle, computeSmartScore, updateStreak, isDuplicate } from './utils';
import { getTMDBMetadata, searchTMDB, fetchAndEnrichTMDB } from './services/tmdb';
import { api } from './services/api';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, Search, Popcorn, Film, Plus, Star, Tv, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from './utils';

export default function App() {
  // --- State ---
  const [library, setLibrary] = useState<LibraryEntry[]>(() => {
    const saved = localStorage.getItem('reeltrack_library');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('reeltrack_settings');
    return saved ? JSON.parse(saved) : {
      tmdbApiKey: '',
      geminiApiKey: '',
      showPosters: true,
      defaultSort: 'smartScore',
      bestStreak: 0,
      currentStreak: 0,
      lastWatchedDate: null
    };
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('reeltrack_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState('movies');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState(settings.defaultSort || 'smartScore');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LibraryEntry | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSavedFlash, setIsSavedFlash] = useState(false);
  const [pickedEntry, setPickedEntry] = useState<LibraryEntry | null>(null);
  const [isSurpriseChoiceOpen, setIsSurpriseChoiceOpen] = useState(false);
  const [similarSource, setSimilarSource] = useState<LibraryEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);

  // --- MySQL Sync ---
  useEffect(() => {
    const syncData = async () => {
      try {
        const syncedLibrary = await api.syncLibrary(library);
        if (JSON.stringify(syncedLibrary) !== JSON.stringify(library)) {
          setLibrary(syncedLibrary);
        }
      } catch (err) {
        console.warn('MySQL Sync unavailable:', err);
      }
    };
    syncData();
  }, []);

  // --- Autocomplete ---
  useEffect(() => {
    if (!search || search.length < 2 || !settings.tmdbApiKey) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAutocomplete(true);
      try {
        const results = await searchTMDB(search, settings.tmdbApiKey);
        setSearchSuggestions(results.slice(0, 5));
      } catch (e) {
        console.error("Autocomplete failed:", e);
      } finally {
        setIsSearchingAutocomplete(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search, settings.tmdbApiKey]);

  // --- Storage ---
  useEffect(() => {
    localStorage.setItem('reeltrack_library', JSON.stringify(library));

    // Auto-sync to MySQL on changes
    const timeout = setTimeout(async () => {
      try {
        await api.syncLibrary(library);
      } catch (e) { }
    }, 2000);

    setIsSavedFlash(true);
    const timer = setTimeout(() => setIsSavedFlash(false), 1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [library]);

  useEffect(() => {
    localStorage.setItem('reeltrack_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('reeltrack_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // --- Streak & Notifications Logic ---
  useEffect(() => {
    const updatedSettings = updateStreak(settings, library);
    if (updatedSettings.currentStreak !== settings.currentStreak) {
      setSettings(updatedSettings);
    }

    // Generate notifications
    const newNotifications: Notification[] = [...notifications];
    let changed = false;

    // Unrated watched
    library.forEach(entry => {
      if (entry.status === 'watched' && entry.rating.overall === null && !entry.notifiedUnrated) {
        newNotifications.push({
          id: generateId(),
          type: 'UNRATED_WATCHED',
          message: `★ Rate '${entry.title}' — you watched it but haven't rated it yet`,
          entryId: entry.id,
          read: false,
          createdAt: new Date().toISOString()
        });
        entry.notifiedUnrated = true;
        changed = true;
      }
    });

    if (changed) {
      setNotifications(newNotifications);
      setLibrary([...library]);
    }
  }, []);

  // --- Toasts ---
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Library Actions ---
  const handleSaveEntry = (entry: LibraryEntry) => {
    if (editingEntry) {
      setLibrary(prev => prev.map(e => e.id === entry.id ? entry : e));
      addToast('success', 'Entry updated ✓');
    } else {
      if (isDuplicate(entry.title, entry.year, library)) {
        addToast('error', `'${entry.title}' is already in your library!`);
        setNotifications(prev => [{
          id: generateId(),
          type: 'DUPLICATE_DETECTED',
          message: `Double vision? '${entry.title}' (${entry.year}) is already in your library.`,
          entryId: null,
          read: false,
          createdAt: new Date().toISOString()
        }, ...prev]);
        return;
      }
      setLibrary(prev => [entry, ...prev]);
      addToast('success', 'Entry added ✓');
    }
    setIsAddModalOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      setLibrary(prev => prev.filter(e => e.id !== id));
      addToast('info', 'Entry deleted');
    }
  };

  const handleToggleFavorite = (id: string) => {
    setLibrary(prev => prev.map(e => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e));
  };

  const handleToggleWatched = (id: string) => {
    setLibrary(prev => prev.map(e => {
      if (e.id === id) {
        const isCurrentlyWatched = e.status === 'watched';
        return {
          ...e,
          status: isCurrentlyWatched ? 'want_to_watch' : 'watched',
          dateWatched: isCurrentlyWatched ? null : new Date().toISOString()
        };
      }
      return e;
    }));
    addToast('success', 'Status updated ✓');
  };

  const handleQuickRate = (id: string, rating: number) => {
    setLibrary(prev => prev.map(e => e.id === id ? { ...e, rating: { ...e.rating, overall: rating } } : e));
  };

  const handleUpdateEpisode = (id: string, delta: number) => {
    setLibrary(prev => prev.map(e => {
      if (e.id === id) {
        let newEp = e.currentEpisode + delta;
        let newSeason = e.currentSeason;
        if (newEp < 1) newEp = 1;
        if (newEp > 10) { // Trigger season prompt
          if (confirm(`Start Season ${newSeason + 1}?`)) {
            newSeason += 1;
            newEp = 1;
          } else {
            newEp = 10;
          }
        }
        return { ...e, currentEpisode: newEp, currentSeason: newSeason };
      }
      return e;
    }));
  };

  const handleImport = (newEntries: LibraryEntry[]) => {
    setLibrary(prev => [...newEntries, ...prev]);
    setIsImportModalOpen(false);
    addToast('success', `Import complete: ${newEntries.length} added`);
  };

  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    const skeleton: LibraryEntry = {
      id: generateId(),
      title: suggestion.title,
      type: suggestion.type,
      year: suggestion.year,
      genres: [],
      poster: suggestion.poster || '',
      description: suggestion.reason,
      director: '',
      cast: [],
      runtime: 0,
      seasons: 0,
      currentSeason: 1,
      currentEpisode: 1,
      status: 'want_to_watch',
      rating: { story: null, acting: null, visuals: null, overall: null },
      rewatchCount: 0,
      streamingUrl: suggestion.imdb_id ? `stremio:///detail/${suggestion.type === 'movie' ? 'movie' : 'series'}/${suggestion.imdb_id}` : '',
      imdbId: suggestion.imdb_id || '',
      tmdbId: 0,
      tmdbPopularity: 0,
      vote_average: 0,
      personalNote: '',
      dateAdded: new Date().toISOString(),
      dateWatched: null,
      tags: [],
      isFavorite: false,
      isPinned: false,
      notifiedUnrated: false
    };

    if (settings.tmdbApiKey) {
      try {
        addToast('info', 'Fetching details...');
        const metadata = await fetchAndEnrichTMDB(suggestion.title, suggestion.type === 'movie' ? 'movie' : 'tv', settings.tmdbApiKey);
        if (metadata) {
          Object.assign(skeleton, metadata);
        }
      } catch (e) {
        console.error("Failed to fetch metadata for suggestion", e);
      }
    }

    setSelectedEntry(skeleton);
  };

  const handleAddFromSuggestion = async (suggestion: Suggestion) => {
    const skeleton: LibraryEntry = {
      id: generateId(),
      title: suggestion.title,
      type: suggestion.type,
      year: suggestion.year,
      genres: [],
      poster: '',
      description: '',
      director: '',
      cast: [],
      runtime: 0,
      seasons: 0,
      currentSeason: 1,
      currentEpisode: 1,
      status: 'want_to_watch',
      rating: { story: null, acting: null, visuals: null, overall: null },
      rewatchCount: 0,
      streamingUrl: suggestion.imdb_id ? `stremio:///detail/${suggestion.type === 'movie' ? 'movie' : 'series'}/${suggestion.imdb_id}` : '',
      imdbId: suggestion.imdb_id || '',
      tmdbId: 0,
      tmdbPopularity: 0,
      vote_average: 0,
      personalNote: '',
      dateAdded: new Date().toISOString(),
      dateWatched: null,
      tags: [],
      isFavorite: false,
      isPinned: false,
      notifiedUnrated: false
    };

    if (settings.tmdbApiKey) {
      try {
        const metadata = await fetchAndEnrichTMDB(suggestion.title, suggestion.type === 'movie' ? 'movie' : 'tv', settings.tmdbApiKey);
        if (metadata) {
          Object.assign(skeleton, metadata);
        }
      } catch (e) { }
    }

    setLibrary(prev => [skeleton, ...prev]);
    addToast('success', `${suggestion.title} added to library`);
  };

  const handleAddSimilar = async (item: any) => {
    const skeleton: LibraryEntry = {
      id: generateId(),
      title: item.title,
      type: item.type,
      year: item.year,
      genres: [],
      poster: item.poster,
      description: item.overview,
      director: '',
      cast: [],
      runtime: 0,
      seasons: 0,
      currentSeason: 1,
      currentEpisode: 1,
      status: 'want_to_watch',
      rating: { story: null, acting: null, visuals: null, overall: null },
      rewatchCount: 0,
      streamingUrl: '',
      imdbId: '',
      tmdbId: item.id,
      tmdbPopularity: 0,
      vote_average: item.rating || 0,
      imdbRating: 0,
      personalNote: '',
      dateAdded: new Date().toISOString(),
      dateWatched: null,
      tags: [],
      isFavorite: false,
      isPinned: false,
      notifiedUnrated: false
    };

    if (settings.tmdbApiKey) {
      try {
        const metadata = await getTMDBMetadata(item.id, item.type === 'movie' ? 'movie' : 'tv', settings.tmdbApiKey);
        Object.assign(skeleton, metadata);
      } catch (e) { }
    }

    setLibrary(prev => [skeleton, ...prev]);
    addToast('success', `${item.title} added to library`);
  };

  const handleSurpriseMe = (typeChoice?: 'movie' | 'series') => {
    if (!typeChoice) {
      setIsSurpriseChoiceOpen(true);
      return;
    }

    const unwatched = library.filter(e => e.status !== 'watched' && e.type === typeChoice);
    if (unwatched.length === 0) {
      addToast('info', `Your ${typeChoice} watchlist is empty!`);
      setIsSurpriseChoiceOpen(false);
      return;
    }

    // Weighted random based on Smart Score
    const weightedList = unwatched.flatMap(e => {
      const score = computeSmartScore(e, library);
      return Array(Math.max(1, Math.floor(score / 10))).fill(e);
    });

    const random = weightedList[Math.floor(Math.random() * weightedList.length)];
    setPickedEntry(random);
    setIsSurpriseChoiceOpen(false);
  };

  // --- Notifications Actions ---
  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const notification = notifications.find(n => n.id === id);
    if (notification?.entryId) {
      const entry = library.find(e => e.id === notification.entryId);
      if (entry) {
        setEditingEntry(entry);
        setIsAddModalOpen(true);
      }
    }
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // --- Filtering & Sorting ---
  const genres = useMemo(() => {
    const set = new Set<string>();
    library.forEach(e => e.genres.forEach(g => set.add(g)));
    return Array.from(set).sort();
  }, [library]);

  const filteredLibrary = useMemo(() => {
    let list = library.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || e.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesGenre = genreFilter === 'all' || e.genres.includes(genreFilter);
      const matchesStar = starFilter === 'all' || (e.rating.overall || 0) >= starFilter;

      if (activeTab === 'movies') return matchesSearch && e.type === 'movie' && e.status !== 'watched' && matchesGenre;
      if (activeTab === 'series') return matchesSearch && e.type === 'series' && e.status !== 'watched' && matchesGenre;
      if (activeTab === 'favorites') return matchesSearch && e.status === 'watched' && (e.rating.overall || 0) >= 4.5 && matchesGenre;
      if (activeTab === 'history') return matchesSearch && e.status === 'watched' && matchesType && matchesGenre && matchesStar;
      if (activeTab === 'suggestions') return false; // Handled separately
      if (activeTab === 'stats') return false; // Handled separately

      return false;
    });

    // Smart Sort & Pinned logic
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'smartScore') return computeSmartScore(b, library) - computeSmartScore(a, library);
      if (sortBy === 'dateAdded') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      if (sortBy === 'rating') return (b.rating.overall || 0) - (a.rating.overall || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'year') return b.year - a.year;
      if (sortBy === 'recentlyWatched') {
        if (!a.dateWatched) return 1;
        if (!b.dateWatched) return -1;
        return new Date(b.dateWatched).getTime() - new Date(a.dateWatched).getTime();
      }
      return 0;
    });
  }, [library, search, typeFilter, statusFilter, genreFilter, sortBy, activeTab]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsAddModalOpen(true);
      }
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Search titles..."]')?.focus();
      }
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsImportModalOpen(false);
        setIsSettingsOpen(false);
        setPickedEntry(null);
        setIsSurpriseChoiceOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-accent selection:text-background">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAdd={() => { setEditingEntry(null); setIsAddModalOpen(true); }}
        onSurprise={handleSurpriseMe}
        onImport={() => setIsImportModalOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        isSaved={isSavedFlash}
      />

      <main className="pt-[60px] min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {selectedEntry ? (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MovieDetails
                entry={selectedEntry}
                onBack={() => setSelectedEntry(null)}
                tmdbApiKey={settings.tmdbApiKey}
                onAdd={handleAddSimilar}
                library={library}
              />
            </motion.div>
          ) : activeTab === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <StatsDashboard library={library} />
            </motion.div>
          ) : activeTab === 'suggestions' ? (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <Suggestions
                library={library}
                geminiApiKey={settings.geminiApiKey}
                onAdd={handleAddFromSuggestion}
                onSelect={handleSelectSuggestion}
                onToast={addToast}
              />
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <FilterBar
                search={search} setSearch={setSearch}
                type={typeFilter} setType={setTypeFilter}
                status={statusFilter} setStatus={setStatusFilter}
                genre={genreFilter} setGenre={setGenreFilter}
                star={starFilter} setStar={setStarFilter}
                sortBy={sortBy} setSortBy={setSortBy}
                genres={genres}
                totalCount={library.length}
                filteredCount={filteredLibrary.length}
                activeTab={activeTab}
                suggestions={searchSuggestions}
                isSearchingSuggestions={isSearchingAutocomplete}
                onSelectSuggestion={async (s) => {
                  const type = s.media_type === 'movie' ? 'movie' : 'series';
                  const existing = library.find(entry => entry.tmdbId === s.id);
                  if (existing) {
                    setSelectedEntry(existing);
                    setSearch('');
                    return;
                  }

                  // Create skeleton
                  const skeleton: LibraryEntry = {
                    id: generateId(),
                    title: s.title || s.name,
                    type: type as any,
                    year: new Date(s.release_date || s.first_air_date).getFullYear(),
                    genres: [],
                    poster: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : '',
                    description: s.overview || '',
                    director: '',
                    cast: [],
                    runtime: 0,
                    seasons: 0,
                    currentSeason: 1,
                    currentEpisode: 1,
                    status: 'want_to_watch',
                    rating: { story: null, acting: null, visuals: null, overall: null },
                    rewatchCount: 0,
                    streamingUrl: '',
                    imdbId: '',
                    tmdbId: s.id,
                    tmdbPopularity: s.popularity,
                    vote_average: s.vote_average,
                    personalNote: '',
                    dateAdded: new Date().toISOString(),
                    dateWatched: null,
                    tags: [],
                    isFavorite: false,
                    isPinned: false,
                    notifiedUnrated: false
                  };

                  if (settings.tmdbApiKey) {
                    try {
                      addToast('info', 'Finishing setup...');
                      const metadata = await getTMDBMetadata(s.id, s.media_type === 'movie' ? 'movie' : 'tv', settings.tmdbApiKey);
                      Object.assign(skeleton, metadata);
                    } catch (e) { }
                  }
                  setSelectedEntry(skeleton);
                  setSearch('');
                }}
              />

              <div className="p-8 max-w-[1800px] mx-auto w-full">
                <LibraryGrid
                  entries={filteredLibrary}
                  onEdit={(e) => { setEditingEntry(e); setIsAddModalOpen(true); }}
                  onDelete={handleDeleteEntry}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleWatched={handleToggleWatched}
                  onUpdateEpisode={handleUpdateEpisode}
                  onQuickRate={handleQuickRate}
                  onFindSimilar={setSimilarSource}
                  onClick={setSelectedEntry}
                  activeTab={activeTab}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddEditModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleSaveEntry}
            editingEntry={editingEntry}
            tmdbApiKey={settings.tmdbApiKey}
            onToast={addToast}
          />
        )}

        {isImportModalOpen && (
          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImport={handleImport}
            tmdbApiKey={settings.tmdbApiKey}
            existingLibrary={library}
            onToast={addToast}
          />
        )}

        {isSettingsOpen && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[360px] h-full bg-card border-l border-white/5 shadow-2xl overflow-y-auto custom-scrollbar"
            >
              <SettingsDrawer
                isOpen={true}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onUpdateSettings={setSettings}
                onExport={() => {
                  const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `reeltrack_backup_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  addToast('success', 'Library exported ✓');
                }}
                onImportBackup={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const data = JSON.parse(ev.target?.result as string);
                        if (Array.isArray(data)) {
                          setLibrary(data);
                          addToast('success', 'Backup restored ✓');
                        }
                      } catch (err) {
                        addToast('error', 'Invalid backup file');
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
                onClearData={() => {
                  setLibrary([]);
                  setNotifications([]);
                  addToast('info', 'All library data cleared');
                  setIsSettingsOpen(false);
                }}
              />
            </motion.div>
          </div>
        )}

        {isSurpriseChoiceOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSurpriseChoiceOpen(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm glass-panel p-8 rounded-[3rem] text-center space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bebas tracking-widest">Surprise Me</h2>
                <p className="text-text-secondary text-xs uppercase tracking-widest">What are you in the mood for?</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSurpriseMe('movie')}
                  className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-white/5 hover:bg-accent hover:text-background transition-all group"
                >
                  <Film size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="font-bebas tracking-widest text-lg">Movie</span>
                </button>
                <button
                  onClick={() => handleSurpriseMe('series')}
                  className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-white/5 hover:bg-accent hover:text-background transition-all group"
                >
                  <Tv size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="font-bebas tracking-widest text-lg">Series</span>
                </button>
              </div>
              <button
                onClick={() => setIsSurpriseChoiceOpen(false)}
                className="text-text-secondary hover:text-white text-[10px] font-bold uppercase tracking-widest pt-4"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}

        {pickedEntry && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPickedEntry(null)}
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative w-full max-w-sm bg-card rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(245,197,24,0.4)] border border-accent/30"
            >
              <div className="aspect-[2/3] relative">
                {pickedEntry.poster ? (
                  <img src={pickedEntry.poster} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent/10 flex items-center justify-center">
                    <span className="font-bebas text-6xl text-accent/20">{pickedEntry.title.substring(0, 2)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <div className="absolute bottom-10 left-8 right-8 text-center space-y-3">
                  <div className="text-accent font-bold text-[10px] tracking-[0.4em] uppercase">Your Random Pick</div>
                  <h2 className="font-bebas text-4xl tracking-wider">{pickedEntry.title}</h2>
                  <div className="text-text-secondary text-[10px] font-bold uppercase tracking-widest">{pickedEntry.year} • {pickedEntry.type}</div>
                </div>
              </div>
              <div className="p-8 grid grid-cols-2 gap-4 bg-card">
                <button
                  onClick={() => {
                    const url = pickedEntry.streamingUrl || `https://www.google.com/search?q=${encodeURIComponent(pickedEntry.title)}+stremio`;
                    window.open(url, '_blank');
                    setPickedEntry(null);
                  }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Play size={18} fill="currentColor" /> Watch Now
                </button>
                <button
                  onClick={() => {
                    setLibrary(prev => prev.map(e => e.id === pickedEntry.id ? { ...e, isPinned: true } : e));
                    addToast('success', 'Pinned to top of list');
                    setPickedEntry(null);
                  }}
                  className="btn-secondary text-[10px] font-bold uppercase tracking-widest"
                >
                  Pin to Top
                </button>
                <button
                  onClick={() => handleSurpriseMe(pickedEntry.type)}
                  className="col-span-2 text-text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest pt-2"
                >
                  Pick Again
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
