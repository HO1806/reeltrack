import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LibraryEntry, Settings } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRuntime(minutes: number) {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function generateId() {
  return crypto.randomUUID();
}

export function getGenreAverages(library: LibraryEntry[]) {
  const genreStats: Record<string, { total: number; count: number }> = {};

  library.forEach(entry => {
    if (entry.rating.overall !== null) {
      entry.genres.forEach(genre => {
        if (!genreStats[genre]) genreStats[genre] = { total: 0, count: 0 };
        genreStats[genre].total += entry.rating.overall!;
        genreStats[genre].count += 1;
      });
    }
  });

  const averages: Record<string, number> = {};
  Object.entries(genreStats).forEach(([genre, stats]) => {
    averages[genre] = stats.total / stats.count;
  });

  return averages;
}

export function computeSmartScore(entry: LibraryEntry, library: LibraryEntry[]) {
  if (entry.status === 'watched') return 0;

  let score = 50;
  const genreAverages = getGenreAverages(library);

  // Genre match bonus
  entry.genres.forEach(genre => {
    const avg = genreAverages[genre];
    if (avg) {
      score += (avg * 5);
    }
  });

  // Popularity bonus
  if (entry.tmdbPopularity > 100) score += 10;
  else if (entry.tmdbPopularity > 50) score += 5;

  // Recency bonus (added > 6 months ago)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (new Date(entry.dateAdded) < sixMonthsAgo) {
    score += 8;
  }

  // Diversity bonus (if not in top genre)
  const sortedGenres = Object.entries(genreAverages).sort((a, b) => b[1] - a[1]);
  const topGenre = sortedGenres[0]?.[0];
  if (topGenre && !entry.genres.includes(topGenre)) {
    score += 5;
  }

  return Math.min(100, score);
}

export function updateStreak(settings: Settings, library: LibraryEntry[]): Settings {
  const today = new Date().toISOString().split('T')[0];
  const lastWatchedDate = settings.lastWatchedDate;

  // Check if anything was watched today
  const watchedToday = library.some(e => e.dateWatched?.split('T')[0] === today);

  if (!watchedToday) return settings;

  const newSettings = { ...settings };

  if (lastWatchedDate === today) {
    // Already updated today
    return settings;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastWatchedDate === yesterdayStr) {
    newSettings.currentStreak += 1;
  } else {
    newSettings.currentStreak = 1;
  }

  if (newSettings.currentStreak > newSettings.bestStreak) {
    newSettings.bestStreak = newSettings.currentStreak;
  }

  newSettings.lastWatchedDate = today;
  return newSettings;
}

export function isDuplicate(title: string, year: number, library: LibraryEntry[]) {
  const normTitle = normalizeTitle(title);
  return library.some(e => normalizeTitle(e.title) === normTitle && e.year === year);
}
