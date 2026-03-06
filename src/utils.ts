import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LibraryEntry, Settings } from './types';

export function calculateUltimateScore(entry: Partial<LibraryEntry>): number | null {
  // 1. Resolve source scores with scale check
  let imdb = entry.imdb_score ?? entry.imdb_10;
  // If IMDb is on 10-scale (e.g. 8.1), scale it to 100
  if (imdb != null && imdb > 0 && imdb < 11) imdb *= 10;

  const mc = entry.mc_score ?? entry.m_val;
  const rc = entry.rt_critics ?? entry.rc_val;
  const ra = entry.rt_audience ?? entry.ra_val;

  // Require ALL four sources to be present and valid
  if (!imdb || isNaN(imdb) || imdb <= 0) return null;
  if (!mc || isNaN(mc) || mc <= 0) return null;
  if (!rc || isNaN(rc) || rc <= 0) return null;
  if (!ra || isNaN(ra) || ra <= 0) return null;

  let scoreSum = 0;
  let weightSum = 0;

  // IMDB: 40%
  if (imdb != null && !isNaN(imdb) && imdb > 0) {
    scoreSum += imdb * 0.40;
    weightSum += 0.40;
  }
  // Metacritic: 40%
  if (mc != null && !isNaN(mc) && mc > 0) {
    scoreSum += mc * 0.40;
    weightSum += 0.40;
  }
  // Rotten Tomatoes: 20% (Avg of critics and audience)
  // If one is missing, use the other at full 20% weight.
  // If both are missing, weight sum doesn't increase.
  const rtParts = [rc, ra].filter(v => v != null && !isNaN(v as number) && v > 0) as number[];
  if (rtParts.length > 0) {
    const rtAvg = rtParts.reduce((a, b) => a + b, 0) / rtParts.length;
    scoreSum += rtAvg * 0.20;
    weightSum += 0.20;
  }

  if (weightSum === 0) return null;

  // Normalizing by weightSum ensures a consistent 0-100 scale regardless of missing sources
  return Math.round(scoreSum / weightSum);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRuntime(minutes: number) {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m} m` : `${m} m`;
}

export function normalizeTitle(title: string) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

  let score = 30; // Reduced base
  const genreAverages = getGenreAverages(library);

  // 1. Ultimate Score Bonus (Primary)
  const ultimateScore = calculateUltimateScore(entry);
  const ratingValue = ultimateScore !== null ? (ultimateScore / 10) : 0;
  if (ratingValue > 0) {
    score += (ratingValue * 5); // Max 50 points from rating
  }

  // 2. Genre match bonus
  entry.genres.forEach(genre => {
    const avg = genreAverages[genre];
    if (avg) {
      score += (avg * 2);
    }
  });

  // 3. Popularity bonus (Reduced weight)
  if (entry.tmdbPopularity > 100) score += 5;
  else if (entry.tmdbPopularity > 50) score += 2;

  // 4. Recency bonus (added > 6 months ago)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (new Date(entry.dateAdded) < sixMonthsAgo) {
    score += 5;
  }

  // 5. Diversity bonus (if not in top genre)
  const sortedGenres = Object.entries(genreAverages).sort((a, b) => b[1] - a[1]);
  const topGenre = sortedGenres[0]?.[0];
  if (topGenre && !entry.genres.includes(topGenre)) {
    score += 3;
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
