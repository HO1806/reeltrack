import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LibraryEntry, Settings, Suggestion, WatchStatus, Notification, MediaType } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LibraryGrid } from './components/LibraryGrid';
import { AddEditModal } from './components/AddEditModal';
import { ImportModal } from './components/ImportModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { StatsDashboard } from './components/StatsDashboard';
import { Suggestions } from './components/Suggestions';
import { BulkAddModal } from './components/BulkAddModal';
import { MovieDetails } from './components/MovieDetails';
import { ToastContainer, ToastMessage } from './components/Toast';
import { generateId, normalizeTitle, computeSmartScore, updateStreak, isDuplicate } from './utils';
import { getTMDBMetadata, searchTMDB, fetchAndEnrichTMDB } from './services/tmdb';
import { api } from './services/api';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, Search, Popcorn, Film, Plus, Star, Tv, RotateCcw, Sparkles, Dices } from 'lucide-react';
import { cn } from './utils';

export default function App() {
  // --- State ---
  // Library loads exclusively from SQL database — no localStorage
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  const [settings, setSettings] = useState<Settings>({
    tmdbApiKey: '',
    groqApiKey: '',
    showPosters: true,
    defaultSort: 'smartScore',
    bestStreak: 0,
    currentStreak: 0,
    lastWatchedDate: null
  });
  // Flag to know if settings are loaded from DB
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

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
  const [starDirection, setStarDirection] = useState<'above' | 'below'>('above');
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
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  // Flag to prevent infinite sync loop when library is updated from DB data
  const syncFromDB = useRef(false);
  // Tracks items that failed TMDB extraction to prevent infinite looping
  const failedEnrichmentIds = useRef<Set<string>>(new Set());

  // --- MySQL Load & Sync (DB is single source of truth for library AND settings) ---
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const [dbLibrary, dbSettings] = await Promise.all([
          api.getLibrary(),
          api.getSettings()
        ]);
        setLibrary(dbLibrary);
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          setSettings(prev => ({ ...prev, ...dbSettings } as Settings));
          if (dbSettings.defaultSort) {
            setSortBy(dbSettings.defaultSort);
          }
        }
        setIsSettingsLoaded(true);
      } catch (err) {
        console.warn('Failed to load data from DB:', err);
        setIsSettingsLoaded(true);
      } finally {
        setIsInitialSync(false);
      }
    };
    loadFromDB();
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

  // --- DB Sync on library changes ---
  // Library changes are pushed to DB; DB is the single source of truth (no localStorage)
  useEffect(() => {
    // Skip the initial empty state and the first DB load
    if (library.length === 0 || isInitialSync) return;

    // If this update came from a DB read, skip re-pushing to avoid loops
    if (syncFromDB.current) {
      syncFromDB.current = false;
      setIsSavedFlash(true);
      const timer = setTimeout(() => setIsSavedFlash(false), 1500);
      return () => clearTimeout(timer);
    }

    // Push all changes to DB
    const timeout = setTimeout(async () => {
      try {
        console.log('Pushing library changes to DB (Items:', library.length, ')');
        const updatedFromDB = await api.syncLibrary(library);

        // If the DB consolidated items (due to unique constraints), update local library
        if (updatedFromDB && updatedFromDB.length !== library.length) {
          console.log('DB consolidated items. Updating local state from', library.length, 'to', updatedFromDB.length);
          syncFromDB.current = true;
          setLibrary(updatedFromDB);
        }
        console.log('Successfully synced library to DB!');
      } catch (e) {
        console.error('CRITICAL: Library push intercept failed:', e);
      }
    }, 1500);

    setIsSavedFlash(true);
    const timer = setTimeout(() => setIsSavedFlash(false), 1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [library]);

  // Settings use the database (fallback sync)
  useEffect(() => {
    if (!isSettingsLoaded) return;

    const timeout = setTimeout(async () => {
      try {
        await api.updateSettings(settings);
      } catch (e) {
        console.error('Failed to sync settings', e);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [settings, isSettingsLoaded]);

  useEffect(() => {
    localStorage.setItem('reeltrack_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // --- Background Enrichment Queue ---
  useEffect(() => {
    if (!settings.tmdbApiKey || library.length === 0) return;

    // Find the first item that needs enrichment (missing poster OR missing ultimate_score)
    const needsEnrichment = library.find(e =>
      !failedEnrichmentIds.current.has(e.id) &&
      (e.poster === '' || e.ultimate_score === undefined || e.ultimate_score === null)
    );

    if (!needsEnrichment) return;

    const timer = setTimeout(async () => {
      try {
        let updatedEntry = null;

        // Has IMDb ID -> Use backend fetcher (which also executes Python Rater logic)
        if (needsEnrichment.imdbId) {
          const enriched = await api.fetchFromImdb(needsEnrichment.imdbId, settings.tmdbApiKey);
          if (enriched.success && enriched.entry) {
            updatedEntry = enriched.entry;
          }
        }
        // Missing IMDb ID -> Fallback directly to title search over frontend TMDB
        else {
          const typeForTMDB = needsEnrichment.type === 'movie' ? 'movie' : 'tv';
          const fallbackData = await fetchAndEnrichTMDB(needsEnrichment.title, typeForTMDB, settings.tmdbApiKey);
          if (fallbackData) {
            updatedEntry = fallbackData;
          }
        }

        if (updatedEntry) {
          setLibrary(prev => prev.map(e => {
            if (e.id === needsEnrichment.id) {
              // Preserve status and other user-managed state from the original entry
              const {
                status,
                dateAdded,
                dateWatched,
                isFavorite,
                isPinned,
                notifiedUnrated,
                personalNote,
                rating,
                ...metadata
              } = updatedEntry;
              return { ...e, ...metadata };
            }
            return e;
          }));
        } else {
          failedEnrichmentIds.current.add(needsEnrichment.id);
          setLibrary(prev => [...prev]); // Trigger re-render to advance queue
        }
      } catch (e) {
        console.error("Enrichment queue error", e);
        failedEnrichmentIds.current.add(needsEnrichment.id);
        setLibrary(prev => [...prev]);
      }
    }, 2000); // 2 second delay between queries to accommodate python rater & TMDB

    return () => clearTimeout(timer);
  }, [library, settings.tmdbApiKey]);

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

  // Helper: fire-and-forget score calculation for a single entry
  const autoRateEntry = (entry: LibraryEntry) => {
    if (!entry.imdbId || entry.ultimate_score) return; // Skip if no IMDb ID or already scored
    api.rateSingle(entry.id, entry.imdbId).then(score => {
      if (score) {
        setLibrary(prev => prev.map(e => e.id === entry.id ? { ...e, ...score } : e));
        addToast('success', `★ Score ready: ${entry.title} — ${(score.ultimate_score / 10).toFixed(1)}`);
      }
    }).catch(() => { });
  };

  // --- Library Actions ---
  const handleSaveEntry = (entry: LibraryEntry) => {
    if (editingEntry) {
      setLibrary(prev => prev.map(e => e.id === entry.id ? entry : e));
      addToast('success', 'Entry updated ✓');
      // Re-rate if imdbId changed or score missing
      if (entry.imdbId && !entry.ultimate_score) autoRateEntry(entry);
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
      // Auto-rate new entries in background
      autoRateEntry(entry);
    }
    setIsAddModalOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await api.deleteEntry(id);
        // Only update local state if server call succeeds
        syncFromDB.current = true; // Use this flag to prevent immediate re-sync of the smaller list
        setLibrary(prev => prev.filter(e => e.id !== id));
        addToast('info', 'Entry deleted ✓');
      } catch (err: any) {
        console.error('Delete failed:', err);
        addToast('error', `Failed to delete from database: ${err.message || 'Unknown error'}`);
      }
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

  const handleImport = async (newEntries: LibraryEntry[]) => {
    try {
      // Form the new combined library
      const updatedLibrary = [...newEntries, ...library];

      // Explicitly sync the newly merged array directly with the backend, bypassing the timeout
      await api.syncLibrary(updatedLibrary);

      // Now set state, safe from wipeouts
      syncFromDB.current = true;
      setLibrary(updatedLibrary);
      setIsImportModalOpen(false);
      addToast('success', `Import complete: ${newEntries.length} added`);
    } catch (err) {
      console.error('CRITICAL: Bulk Import Failed', err);
      addToast('error', 'Failed to save imported items to database!');
    }
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

  const handleSurpriseMe = (typeChoice?: MediaType) => {
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

  const handleRunRater = async () => {
    setIsSavedFlash(true);
    try {
      addToast('info', 'Custom Rater started...');
      const result = await api.runBatchRater();
      if (result.processed > 0) {
        setNotifications([{
          id: generateId(),
          type: 'IMPORT_COMPLETE',
          message: `★ Rater finished processing ${result.processed} items!`,
          entryId: null,
          read: false,
          createdAt: new Date().toISOString()
        }, ...notifications]);

        // Refresh library from server
        const updated = await api.getLibrary();
        setLibrary(updated);
        addToast('success', `Rater processed ${result.processed} titles`);
      } else {
        addToast('info', 'No new titles to rate');
      }
    } catch (e: any) {
      addToast('error', `Rater failed: ${e.message}`);
    } finally {
      setTimeout(() => setIsSavedFlash(false), 2000);
    }
  };

  // --- Filtering & Sorting ---
  const genres = useMemo(() => {
    const set = new Set<string>();
    library.forEach(e => {
      if (Array.isArray(e.genres)) {
        e.genres.forEach(g => set.add(g));
      }
    });
    return Array.from(set).sort();
  }, [library]);

  const filteredLibrary = useMemo(() => {
    let list = library.filter(e => {
      // 1. Unify 'tv' and 'series' so the UI only has to deal with two binary types
      const isMovie = e.type === 'movie';
      const isSeries = e.type === 'series' || e.type === 'tv';
      const isWatched = e.status === 'watched';

      // 2. Base Search & Genre Filters (Applies globally everywhere)
      if (!e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (genreFilter !== 'all' && !(Array.isArray(e.genres) && e.genres.includes(genreFilter))) return false;

      // 3. Dropdown Type Filter
      if (typeFilter === 'movie' && !isMovie) return false;
      if (typeFilter === 'series' && !isSeries) return false;

      // 4. Dropdown Star Filter (Ultimate Score Logic)
      const score = Math.round(e.ultimate_score || 0);

      const passesStar = starFilter === 'all' || (
        starDirection === 'above'
          ? score >= (starFilter as number)
          : score < (starFilter as number)
      );
      if (!passesStar) return false;

      // 5. Deterministic Tab Routing
      switch (activeTab) {
        case 'movies':
          return isMovie && !isWatched; // Unwatched movies only
        case 'series':
          return isSeries && !isWatched; // Unwatched series only
        case 'history':
          return isWatched; // Watched anything
        case 'favorites':
          return isWatched && (e.rating.overall || 0) >= 4.5; // Watched high ratings
        case 'suggestions':
        case 'stats':
        default:
          return false; // Handled directly by component wrappers, hide from grid
      }
    });

    // Smart Sort & Pinned logic
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'smartScore') return computeSmartScore(b, library) - computeSmartScore(a, library);
      if (sortBy === 'dateAdded') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      if (sortBy === 'rating') {
        const ratingA = a.ultimate_score ? (a.ultimate_score / 10) : 0;
        const ratingB = b.ultimate_score ? (b.ultimate_score / 10) : 0;
        return ratingB - ratingA;
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'year') return b.year - a.year;
      if (sortBy === 'recentlyWatched') {
        if (!a.dateWatched) return 1;
        if (!b.dateWatched) return -1;
        return new Date(b.dateWatched).getTime() - new Date(a.dateWatched).getTime();
      }
      return 0;
    });
  }, [library, search, typeFilter, statusFilter, genreFilter, sortBy, activeTab, starFilter, starDirection]);

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
        onBulkAdd={() => setIsBulkModalOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        isSaved={isSavedFlash}
      />

      <main className="pt-nav min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {selectedEntry ? (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <MovieDetails
                entry={selectedEntry}
                onBack={() => setSelectedEntry(null)}
                tmdbApiKey={settings.tmdbApiKey}
                onAdd={handleAddSimilar}
                library={library}
              />
            </motion.div>
          ) : activeTab === 'suggestions' ? (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 sm:px-8 pt-2 pb-8 flex-1"
            >
              <Suggestions
                library={library}
                groqApiKey={settings.groqApiKey}
                tmdbApiKey={settings.tmdbApiKey}
                onAdd={handleAddFromSuggestion}
                onSelect={handleSelectSuggestion}
                onToast={addToast}
              />
            </motion.div>
          ) : activeTab === 'stats' ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 sm:px-8 pt-2 pb-8 flex-1 overflow-y-auto"
            >
              <StatsDashboard library={library} />
            </motion.div>
          ) : (
            <motion.div
              key="library-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1"
            >

              <FilterBar
                search={search} setSearch={setSearch}
                type={typeFilter} setType={setTypeFilter}
                status={statusFilter} setStatus={setStatusFilter}
                genre={genreFilter} setGenre={setGenreFilter}
                star={starFilter} setStar={setStarFilter}
                starDirection={starDirection} setStarDirection={setStarDirection}
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

              <div className="px-2 sm:px-4 pb-12 max-w-content-max mx-auto w-full">
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
                  isSearching={search.length > 0}
                  isLoading={isInitialSync}
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

        {isBulkModalOpen && (
          <BulkAddModal
            isOpen={isBulkModalOpen}
            onClose={() => setIsBulkModalOpen(false)}
            onSuccess={async () => {
              const updated = await api.getLibrary();
              setLibrary(updated);
            }}
            tmdbApiKey={settings.tmdbApiKey}
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
                onClearData={async () => {
                  if (!confirm('Are you sure? This will PERMANENTLY delete everything from your library AND the database!')) return;
                  try {
                    await api.clearLibrary();
                    setLibrary([]);
                    setNotifications([]);
                    addToast('info', 'All library data cleared permanently');
                    setIsSettingsOpen(false);
                  } catch (e: any) {
                    addToast('error', `Failed to clear backend: ${e.message}`);
                  }
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
