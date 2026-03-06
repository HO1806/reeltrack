import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LibraryEntry, Settings, Suggestion, WatchStatus, Notification, MediaType } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LibraryGrid } from './components/LibraryGrid';
import { RatedPage } from './components/RatedPage';
import { AddEditModal } from './components/AddEditModal';
import { ImportModal } from './components/ImportModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { StatsDashboard } from './components/StatsDashboard';
import { MovieDetails } from './components/MovieDetails';
import { MissingRatingsModal } from './components/MissingRatingsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { generateId, normalizeTitle, computeSmartScore, updateStreak, isDuplicate, calculateUltimateScore } from './utils';
import { getTMDBMetadata, searchTMDB, fetchAndEnrichTMDB } from './services/tmdb';
import { api } from './services/api';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, Search, Popcorn, Film, Plus, Star, Tv, RotateCcw, Sparkles, Dices } from 'lucide-react';
import { cn } from './utils';

const MovieDetailsRoute = ({ library, settings, onAddSimilar, onClick }: any) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const entry = library.find((e: any) => e.imdbId === id || e.id === id);

  if (!entry) return <div className="p-10 text-center text-text-muted">Item not found in your matrix.</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1"
    >
      <MovieDetails
        entry={entry}
        onBack={() => navigate(-1)}
        tmdbApiKey={settings.tmdbApiKey}
        onAdd={onAddSimilar}
        library={library}
      />
    </motion.div>
  );
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [starDirection, setStarDirection] = useState<'above' | 'below'>('above');

  const [sortBy, setSortBy] = useState(() => {
    if (location.pathname === '/history') return 'recentlyWatched';
    return settings.defaultSort || 'smartScore';
  });

  // Automatically adjust default sort when navigating between History and other tabs
  useEffect(() => {
    if (location.pathname === '/history' && sortBy !== 'recentlyWatched') {
      setSortBy('recentlyWatched');
    } else if (location.pathname !== '/history' && sortBy === 'recentlyWatched') {
      setSortBy(settings.defaultSort || 'smartScore');
    }
  }, [location.pathname]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMissingRatingsModalOpen, setIsMissingRatingsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LibraryEntry | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSavedFlash, setIsSavedFlash] = useState(false);
  const [similarSource, setSimilarSource] = useState<LibraryEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);
  const [isInitialSync, setIsInitialSync] = useState(true);
  // Flag to prevent infinite sync loop when library is updated from DB data
  const syncFromDB = useRef(false);
  const [isApiLimited, setIsApiLimited] = useState(false);

  // Backend-driven sync progress (updated via lightweight polling)
  const [backendSyncTotal, setBackendSyncTotal] = useState(0);
  const [backendSyncSynced, setBackendSyncSynced] = useState(0);
  const [backendMissingScore, setBackendMissingScore] = useState(0);

  // Custom event trigger
  const [forceResync, setForceResync] = useState<() => void>(() => () => { });
  // Tracks items that failed TMDB extraction to prevent infinite looping
  const failedEnrichmentIds = useRef<Set<string>>(new Set());
  // Nonce used to advance background enrichment without triggering library-ref changes
  const [enrichmentNonce, setEnrichmentNonce] = useState(0);

  // --- Derived State ---
  const totalItemsCount = library.length;
  const totalMoviesCount = useMemo(() => library.filter(e => e.type === 'movie' && e.status !== 'watched').length, [library]);
  const totalSeriesCount = useMemo(() => library.filter(e => (e.type === 'series' || e.type === 'tv') && e.status !== 'watched').length, [library]);
  const totalHistoryCount = useMemo(() => library.filter(e => e.status === 'watched').length, [library]);
  const totalHomeCount = useMemo(() => library.filter(e => e.status !== 'watched').length, [library]);


  // --- Initial Data Load ---
  useEffect(() => {
    const initData = async () => {
      try {
        const [libData, settingsData, limitStatus] = await Promise.all([
          api.getLibrary(),
          api.getSettings(),
          api.getLimitStatus()
        ]);

        syncFromDB.current = true;
        setLibrary(libData);
        if (Object.keys(settingsData).length > 0) {
          setSettings(settingsData as Settings);
        }
        setIsApiLimited(limitStatus.limitReached);
        setIsInitialSync(false);
        setIsSettingsLoaded(true);

        const savedNotifs = localStorage.getItem('reeltrack_notifications');
        if (savedNotifs) {
          try { setNotifications(JSON.parse(savedNotifs)); } catch (e) { }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    initData();
  }, []);

  // --- Periodic polling for new metadata ---
  useEffect(() => {
    setForceResync(() => async () => {
      try {
        const [freshLib, limitStatus] = await Promise.all([
          api.getLibrary(),
          api.getLimitStatus()
        ]);
        syncFromDB.current = true;
        setLibrary(freshLib);
        setIsApiLimited(limitStatus.limitReached);
      } catch (e) {
        console.error('Failed to poll background sync updates', e);
      }
    });

    const interval = setInterval(async () => {
      try {
        const [freshLib, limitStatus] = await Promise.all([
          api.getLibrary(),
          api.getLimitStatus()
        ]);
        syncFromDB.current = true;
        setLibrary(freshLib);
        setIsApiLimited(limitStatus.limitReached);
      } catch (e) {
        console.error('Failed to poll background sync updates', e);
      }
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Set theme when settings change
  useEffect(() => {
    if (settings.theme) {
      document.documentElement.className = `theme-${settings.theme}`;
    }
  }, [settings.theme]);

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

    // Push all changes to DB (Incremental/Sync fallback)
    const timeout = setTimeout(async () => {
      try {
        console.log('Pushing library changes to DB (Incremental Sync Target:', library.length, ')');
        const updatedFromDB = await api.syncLibrary(library);

        if (updatedFromDB) {
          console.log('Sync complete. Updating local state with latest DB data.');
          syncFromDB.current = true;
          setLibrary(updatedFromDB);
        }
      } catch (e) {
        console.error('CRITICAL: Library push intercept failed:', e);
      }
    }, 5000); // Reduced debounce for fallback sync

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

  // --- Streak & Notifications Logic ---
  useEffect(() => {
    if (isInitialSync || library.length === 0) return;

    // 1. Update Streak
    const updatedSettings = updateStreak(settings, library);
    if (updatedSettings.currentStreak !== settings.currentStreak) {
      setSettings(updatedSettings);
    }

    // 2. Generate Notifications
    setNotifications(prev => {
      const newNotifs: Notification[] = [...prev];
      let notifsChanged = false;
      let libChanged = false;
      const updatedLib = [...library];

      library.forEach((entry, idx) => {
        // A. Unrated watched
        if (entry.status === 'watched' && entry.rating.overall === null && !entry.notifiedUnrated) {
          newNotifs.push({
            id: generateId(),
            type: 'UNRATED_WATCHED',
            message: `★ Rate '${entry.title}' — you watched it but haven't rated it yet`,
            entryId: entry.id,
            read: false,
            createdAt: new Date().toISOString()
          });
          updatedLib[idx] = { ...entry, notifiedUnrated: true };
          libChanged = true;
          notifsChanged = true;
        }

        // B. Missing Metadata (Poster or Description)
        const hasMetadataNotif = prev.some(n => n.entryId === entry.id && n.type === 'MISSING_METADATA');
        if ((entry.poster === '' || !entry.description) && !hasMetadataNotif) {
          // Skip notifying for items that were just added and might still be in the enrichment queue
          // (Wait at least 10 seconds after adding? Or just check if failedEnrichmentIds has it)
          const isFailed = failedEnrichmentIds.current.has(entry.id);
          if (isFailed || new Date().getTime() - new Date(entry.dateAdded).getTime() > 30000) {
            newNotifs.push({
              id: generateId(),
              type: 'MISSING_METADATA',
              message: `⚠ '${entry.title}' is missing essential metadata`,
              entryId: entry.id,
              read: false,
              createdAt: new Date().toISOString()
            });
            notifsChanged = true;
          }
        }

        // C. Missing Ultimate Score
        const hasScoreNotif = prev.some(n => n.entryId === entry.id && n.type === 'MISSING_SCORE');
        if ((entry.ultimate_score === undefined || entry.ultimate_score === null) && !hasScoreNotif) {
          const isFailed = failedEnrichmentIds.current.has(entry.id);
          if (isFailed || new Date().getTime() - new Date(entry.dateAdded).getTime() > 30000) {
            newNotifs.push({
              id: generateId(),
              type: 'MISSING_SCORE',
              message: `⚡ '${entry.title}' is missing its Ultimate Score calculation`,
              entryId: entry.id,
              read: false,
              createdAt: new Date().toISOString()
            });
            notifsChanged = true;
          }
        }
      });

      if (libChanged) {
        // Update library state separately to persist notifiedUnrated flags
        setTimeout(() => {
          setLibrary(prevLib => {
            const next = [...prevLib];
            updatedLib.forEach((e, i) => {
              if (e.notifiedUnrated) {
                const index = next.findIndex(item => item.id === e.id);
                if (index !== -1) next[index] = { ...next[index], notifiedUnrated: true };
              }
            });
            return next;
          });
        }, 0);
      }

      return notifsChanged ? newNotifs : prev;
    });
  }, [library.length, isInitialSync]);

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
  const handleSaveEntry = async (entry: LibraryEntry) => {
    if (editingEntry) {
      setLibrary(prev => prev.map(e => e.id === entry.id ? entry : e));
      try {
        await api.updateEntry(entry.id, entry);
        addToast('success', 'Entry updated ✓');
      } catch (err: any) {
        addToast('error', `Failed to update: ${err.message}`);
      }
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
      try {
        await api.addEntry(entry);
        addToast('success', 'Entry added ✓');
        autoRateEntry(entry);
      } catch (err: any) {
        addToast('error', `Failed to add: ${err.message}`);
      }
    }
    setIsAddModalOpen(false);
    setEditingEntry(null);
    // Trigger immediate refresh to show progress live
    const updated = await api.getLibrary();
    syncFromDB.current = true;
    setLibrary(updated);
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

  const handleToggleFavorite = async (id: string) => {
    const entry = library.find(e => e.id === id);
    if (!entry) return;
    const updated = { ...entry, isFavorite: !entry.isFavorite };
    setLibrary(prev => prev.map(e => e.id === id ? updated : e));
    try {
      await api.updateEntry(id, updated);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleToggleWatched = async (id: string) => {
    const entry = library.find(e => e.id === id);
    if (!entry) return;
    const isCurrentlyWatched = entry.status === 'watched';
    const updated = {
      ...entry,
      status: isCurrentlyWatched ? 'want_to_watch' : 'watched' as WatchStatus,
      dateWatched: isCurrentlyWatched ? null : new Date().toISOString()
    };
    setLibrary(prev => prev.map(e => e.id === id ? updated : e));
    try {
      await api.updateEntry(id, updated);
      addToast('success', 'Status updated ✓');
    } catch (err) {
      console.error('Failed to toggle watched:', err);
    }
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
        const updated = { ...e, currentEpisode: newEp, currentSeason: newSeason };
        // Sync update to backend immediately
        api.updateEntry(id, updated).catch(err => console.error('[UpdateEpisode] Failed:', err));
        return updated;
      }
      return e;
    }));
  };

  const handleRepairRatings = async () => {
    addToast('info', 'Searching for Cine-Frequency errors... Repairing all ratings...');
    try {
      const result = await api.runBatchRater(true);
      console.log('[Repair] Complete:', result);
      addToast('success', `Analytics Resynced: Processed ${result.processed} assets.`);
      // Refresh library to see updated scores
      const updated = await api.getLibrary();
      syncFromDB.current = true;
      setLibrary(updated);
    } catch (err: any) {
      addToast('error', `System Overload: ${err.message}`);
    }
  };

  // --- Lightweight Sync Status Polling ---
  // Polls /api/sync-status every 5s for real-time progress circle updates
  // When enrichment completes, triggers one full library refresh
  const prevSyncedRef = useRef(0);
  useEffect(() => {
    if (isInitialSync) return;

    const pollSyncStatus = async () => {
      try {
        const status = await api.getSyncStatus();
        setBackendSyncTotal(status.total);
        setBackendSyncSynced(status.synced);
        setBackendMissingScore(status.missingScoreCount);
        setIsApiLimited(status.isApiLimited);

        // When new items get enriched, refresh the full library so cards update
        if (status.synced > prevSyncedRef.current && status.synced > 0) {
          console.log(`[App] Sync progress: ${status.synced}/${status.total}. Refreshing library...`);
          const freshLib = await api.getLibrary();
          syncFromDB.current = true;
          setLibrary(freshLib);
        }
        prevSyncedRef.current = status.synced;
      } catch (err) {
        console.warn('[App] Sync status poll failed:', err);
      }
    };

    // Poll immediately, then every 5 seconds
    pollSyncStatus();
    const interval = setInterval(pollSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [isInitialSync]);


  const handleImport = async (newEntries: LibraryEntry[]) => {
    try {
      // Form the new combined library
      const updatedLibrary = [...newEntries, ...library];

      // Explicitly sync the newly merged array directly with the backend, bypassing the timeout
      await api.syncLibrary(updatedLibrary);

      // Now set state, safe from wipeouts
      const refreshedLibrary = await api.getLibrary();
      syncFromDB.current = true;
      setLibrary(refreshedLibrary);
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
    if (!typeChoice) return;

    const unwatched = library.filter(e => (e.status === 'want_to_watch' || e.status === 'watching') && e.type === typeChoice);
    if (unwatched.length === 0) {
      addToast('info', `Your ${typeChoice} watchlist is empty!`);
      return;
    }

    // Weighted random based on Smart Score
    const weightedList = unwatched.flatMap(e => {
      const score = computeSmartScore(e, library);
      return Array(Math.max(1, Math.floor(score / 10))).fill(e);
    });

    const random = weightedList[Math.floor(Math.random() * weightedList.length)];
    handleEntryClick(random);
    addToast('info', `Surprise! Directing you to '${random.title}'`);
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
  const homeGenres = useMemo(() => {
    const list = library.filter(e => e.status !== 'watched');
    const set = new Set<string>();
    list.forEach(e => (Array.isArray(e.genres) ? e.genres.forEach(g => set.add(g)) : null));
    return Array.from(set).sort();
  }, [library]);

  const moviesGenres = useMemo(() => {
    const list = library.filter(e => e.type === 'movie' && e.status !== 'watched');
    const set = new Set<string>();
    list.forEach(e => (Array.isArray(e.genres) ? e.genres.forEach(g => set.add(g)) : null));
    return Array.from(set).sort();
  }, [library]);

  const seriesGenres = useMemo(() => {
    const list = library.filter(e => (e.type === 'series' || e.type === 'tv') && e.status !== 'watched');
    const set = new Set<string>();
    list.forEach(e => (Array.isArray(e.genres) ? e.genres.forEach(g => set.add(g)) : null));
    return Array.from(set).sort();
  }, [library]);

  const historyGenres = useMemo(() => {
    const list = library.filter(e => e.status === 'watched');
    const set = new Set<string>();
    list.forEach(e => (Array.isArray(e.genres) ? e.genres.forEach(g => set.add(g)) : null));
    return Array.from(set).sort();
  }, [library]);

  const baseFilteredLibrary = useMemo(() => {
    let list = library.filter(e => {
      const isMovie = e.type === 'movie';
      const isSeries = e.type === 'series' || e.type === 'tv';

      if (!e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (genreFilter !== 'all' && !(Array.isArray(e.genres) && e.genres.includes(genreFilter))) return false;

      // Type filter only applies to the History page; other pages have inherent type filters
      if (location.pathname === '/history') {
        if (typeFilter === 'movie' && !isMovie) return false;
        if (typeFilter === 'series' && !isSeries) return false;
      }

      const score = calculateUltimateScore(e) || 0;
      const passesStar = starFilter === 'all' || (
        starDirection === 'above'
          ? score >= (starFilter as number)
          : score < (starFilter as number)
      );
      if (!passesStar) return false;

      return true;
    });

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (sortBy === 'smartScore') return computeSmartScore(b, library) - computeSmartScore(a, library);
      if (sortBy === 'dateAdded') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      if (sortBy === 'rating') {
        return (calculateUltimateScore(b) || 0) - (calculateUltimateScore(a) || 0);
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'year') return b.year - a.year;
      if (sortBy === 'recentlyWatched') {
        if (!a.dateWatched && !b.dateWatched) {
          // Both lack a watch date; fallback to date components or zero to maintain symmetry
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        }
        if (!a.dateWatched) return 1;
        if (!b.dateWatched) return -1;
        return new Date(b.dateWatched).getTime() - new Date(a.dateWatched).getTime();
      }
      return 0;
    });
  }, [library, search, typeFilter, genreFilter, sortBy, starFilter, starDirection, location.pathname]);

  // Derived filter views mapped closely to old activeTab logic
  const homeLibrary = useMemo(() => baseFilteredLibrary.filter(e => e.status !== 'watched'), [baseFilteredLibrary]);
  const moviesLibrary = useMemo(() => baseFilteredLibrary.filter(e => e.type === 'movie' && e.status !== 'watched'), [baseFilteredLibrary]);
  const seriesLibrary = useMemo(() => baseFilteredLibrary.filter(e => (e.type === 'series' || e.type === 'tv') && e.status !== 'watched'), [baseFilteredLibrary]);
  const historyLibrary = useMemo(() => baseFilteredLibrary.filter(e => e.status === 'watched'), [baseFilteredLibrary]);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);




  const handleEntryClick = (entry: LibraryEntry) => {
    const type = entry.type === 'movie' ? 'movies' : 'series';
    const id = entry.imdbId || entry.id;
    navigate(`/${type}/${id}`);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-accent selection:text-background">
      <Navbar
        onAdd={() => { setEditingEntry(null); setIsAddModalOpen(true); }}
        onSurprise={handleSurpriseMe}
        onImport={() => setIsImportModalOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        totalItems={backendSyncTotal}
        syncedItems={backendSyncSynced}
        missingScoreCount={backendMissingScore}
        isApiLimited={isApiLimited}
        onMissingRatingsClick={() => setIsMissingRatingsModalOpen(true)}
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
          ) : (
            <Routes>
              {/* Stats Route */}
              <Route path="/stats" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-4 pt-2 flex-1 overflow-hidden"
                >
                  <StatsDashboard library={library} />
                </motion.div>
              } />

              {/* Rated Page Route */}
              <Route path="/rated" element={
                <RatedPage
                  library={baseFilteredLibrary}
                  onRate={handleQuickRate}
                  onEdit={(e) => { setEditingEntry(e); setIsAddModalOpen(true); }}
                  onDelete={handleDeleteEntry}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleWatched={handleToggleWatched}
                  onUpdateEpisode={handleUpdateEpisode}
                  onFindSimilar={setSimilarSource}
                  onClick={handleEntryClick}
                />
              } />

              {/* Detail Routes */}
              <Route path="/movies/:id" element={<MovieDetailsRoute library={library} settings={settings} onAddSimilar={handleAddSimilar} />} />
              <Route path="/series/:id" element={<MovieDetailsRoute library={library} settings={settings} onAddSimilar={handleAddSimilar} />} />

              {/* Home Route - Empty for now */}
              <Route path="/" element={<div className="flex-1" />} />

              {/* Standard List Routes */}
              {['/movies', '/series', '/history'].map((path) => (
                <Route key={path} path={path} element={
                  <motion.div
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
                      genres={
                        path === '/' ? homeGenres :
                          path === '/movies' ? moviesGenres :
                            path === '/series' ? seriesGenres :
                              historyGenres
                      }
                      totalCount={
                        path === '/' ? totalHomeCount :
                          path === '/movies' ? totalMoviesCount :
                            path === '/series' ? totalSeriesCount :
                              totalHistoryCount
                      }
                      filteredCount={
                        path === '/' ? homeLibrary.length :
                          path === '/movies' ? moviesLibrary.length :
                            path === '/series' ? seriesLibrary.length :
                              historyLibrary.length
                      }
                      activeTab={
                        path === '/' ? 'home' :
                          path === '/movies' ? 'movies' :
                            path === '/series' ? 'series' :
                              'history'
                      }
                      suggestions={searchSuggestions}
                      isSearchingSuggestions={isSearchingAutocomplete}
                      onSelectSuggestion={async (s) => {
                        const type = s.media_type === 'movie' ? 'movie' : 'series';
                        const existing = library.find(entry => entry.tmdbId === s.id);
                        if (existing) {
                          handleEntryClick(existing);
                          setSearch('');
                          return;
                        }

                        const skeleton: LibraryEntry = {
                          id: generateId(),
                          title: s.title || s.name,
                          type: type as any,
                          year: s.release_date || s.first_air_date ? new Date(s.release_date || s.first_air_date).getFullYear() : 0,
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

                    <div className="pb-12 max-w-content-max mx-auto w-full">
                      <LibraryGrid
                        entries={
                          path === '/' ? homeLibrary :
                            path === '/movies' ? moviesLibrary :
                              path === '/series' ? seriesLibrary :
                                historyLibrary
                        }
                        onEdit={(e) => { setEditingEntry(e); setIsAddModalOpen(true); }}
                        onDelete={handleDeleteEntry}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleWatched={handleToggleWatched}
                        onUpdateEpisode={handleUpdateEpisode}
                        onQuickRate={handleQuickRate}
                        onFindSimilar={setSimilarSource}
                        onClick={handleEntryClick}
                        activeTab={
                          path === '/' ? 'home' :
                            path === '/movies' ? 'movies' :
                              path === '/series' ? 'series' :
                                'history'
                        }
                        isSearching={search.length > 0}
                        isLoading={isInitialSync}
                      />
                    </div>
                  </motion.div>
                } />
              ))}
            </Routes>
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

        <MissingRatingsModal
          isOpen={isMissingRatingsModalOpen}
          onClose={() => setIsMissingRatingsModalOpen(false)}
          onSaved={async () => {
            const freshLib = await api.getLibrary();
            syncFromDB.current = true;
            setLibrary(freshLib);
            addToast('success', 'Manual ratings saved ✨');
          }}
        />
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
                onRepairRatings={handleRepairRatings}
              />
            </motion.div>
          </div>
        )}


      </AnimatePresence>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
