export type MediaType = 'movie' | 'series' | 'tv';
export type WatchStatus = 'watched' | 'watching' | 'want_to_watch' | 'dropped';

export interface Rating {
  story: number | null;
  acting: number | null;
  visuals: number | null;
  overall: number | null;
}

export interface LibraryEntry {
  id: string;
  type: MediaType;
  title: string;
  year: number;
  genres: string[];
  poster: string;
  description: string;
  director: string;
  cast: string[];
  runtime: number;
  seasons: number;
  currentSeason: number;
  currentEpisode: number;
  status: WatchStatus;
  rating: Rating;
  rewatchCount: number;
  streamingUrl: string;
  imdbId: string;
  tmdbId: number;
  tmdbPopularity: number;
  vote_average?: number;
  personalNote: string;
  dateAdded: string;
  dateWatched: string | null;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  notifiedUnrated: boolean;
  imdb_score?: number;
  mc_score?: number;
  rt_critics?: number;
  rt_audience?: number;
  imdb_10?: number; // Deprecated
  m_val?: number;   // Deprecated
  rc_val?: number;  // Deprecated
  ra_val?: number;  // Deprecated
  ultimate_score?: number; // Calculated client-side now
}

export interface Settings {
  tmdbApiKey: string;
  groqApiKey: string;
  showPosters: boolean;
  defaultSort: string;
  bestStreak: number;
  currentStreak: number;
  lastWatchedDate: string | null;
  theme?: string;
}

export type NotificationType =
  | 'UNRATED_WATCHED'
  | 'MISSING_METADATA'
  | 'MISSING_SCORE'
  | 'MISSING_IMDB_ID'
  | 'DUPLICATE_DETECTED'
  | 'IMPORT_COMPLETE'
  | 'STREAK_MILESTONE';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  entryId: string | null;
  read: boolean;
  createdAt: string;
}

export interface StremioImportItem {
  imdb_id: string | null;
  title: string;
  year?: number;
  type: MediaType;
  status: WatchStatus;
}

export interface StremioImport {
  exported_at: string;
  source: string;
  version: string;
  items: StremioImportItem[];
}

export interface Suggestion {
  title: string;
  year: number;
  type: MediaType;
  reason: string;
  alreadyInWatchlist: boolean;
  imdb_id: string | null;
  poster?: string | null;
}
