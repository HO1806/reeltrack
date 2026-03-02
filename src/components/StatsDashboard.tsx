import React from 'react';
import { LibraryEntry } from '../types';
import { Film, Tv, Clock, BarChart3, Star, TrendingUp } from 'lucide-react';
import { formatRuntime } from '../utils';

interface StatsDashboardProps {
  library: LibraryEntry[];
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ library }) => {
  const total = library.length;
  const movies = library.filter(e => e.type === 'movie').length;
  const series = library.filter(e => e.type === 'series').length;

  const totalMinutes = library
    .filter(e => e.status === 'watched')
    .reduce((acc, curr) => {
      if (curr.type === 'movie') return acc + curr.runtime;
      return acc + (curr.runtime * curr.currentEpisode); // Rough estimate for series
    }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const statusCounts = {
    watched: library.filter(e => e.status === 'watched').length,
    watching: library.filter(e => e.status === 'watching').length,
    want_to_watch: library.filter(e => e.status === 'want_to_watch').length,
    dropped: library.filter(e => e.status === 'dropped').length,
  };

  const genres: Record<string, number> = {};
  library.forEach(e => e.genres.forEach(g => genres[g] = (genres[g] || 0) + 1));
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const ratings: Record<number, number> = {};
  library.forEach(e => {
    if (e.rating.overall) {
      const r = Math.round(e.rating.overall);
      ratings[r] = (ratings[r] || 0) + 1;
    }
  });

  const topMovies = library
    .filter(e => e.type === 'movie' && e.rating.overall)
    .sort((a, b) => (b.rating.overall || 0) - (a.rating.overall || 0))
    .slice(0, 5);

  const topSeries = library
    .filter(e => e.type === 'series' && e.rating.overall)
    .sort((a, b) => (b.rating.overall || 0) - (a.rating.overall || 0))
    .slice(0, 5);

  return (
    <div className="px-2 sm:px-4 py-4 space-y-10 animate-fade-in max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex items-center gap-6">
        <h2 className="font-bebas text-5xl tracking-wider text-white">Your Stats</h2>
        <div className="h-[2px] flex-1 bg-gradient-to-r from-accent/20 to-transparent" />
      </div>

      {/* Hero Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Titles', value: total, icon: BarChart3, color: 'text-accent' },
          { label: 'Movies', value: movies, icon: Film, color: 'text-blue-500' },
          { label: 'Series', value: series, icon: Tv, color: 'text-purple-500' },
          { label: 'Hours Watched', value: `${hours}h ${mins}m`, icon: Clock, color: 'text-green-500' },
        ].map((stat, i) => (
          <div key={i} className="stat-card group">
            <div className={`p-4 rounded-2xl bg-white/[0.04] ${stat.color} transition-all duration-500 group-hover:scale-105`}>
              <stat.icon size={26} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1">{stat.label}</div>
              <div className="text-3xl font-bebas tracking-wide">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Top Lists */}
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <Star size={16} /> Top Rated Movies
            </h3>
            <div className="space-y-2">
              {topMovies.map((m, idx) => (
                <div key={m.id} className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bebas text-sm shrink-0 ${idx === 0 ? 'bg-accent/20 text-accent shadow-[0_0_12px_rgba(245,197,24,0.3)]' :
                      idx === 1 ? 'bg-white/10 text-white/60' :
                        idx === 2 ? 'bg-orange-500/10 text-orange-400' :
                          'bg-white/5 text-text-muted'
                      }`}>{idx + 1}</div>
                    {m.poster && <img src={m.poster} className="w-8 h-12 rounded-lg object-cover" />}
                    <div>
                      <div className="text-sm font-bold group-hover:text-accent transition-colors">{m.title}</div>
                      <div className="text-[10px] text-text-secondary">{m.year}</div>
                    </div>
                  </div>
                  <div className="text-accent font-bebas text-xl">
                    {m.ultimate_score ? Math.round(m.ultimate_score) : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <Star size={16} /> Top Rated Series
            </h3>
            <div className="space-y-2">
              {topSeries.map((s, idx) => (
                <div key={s.id} className="glass-panel p-4 rounded-2xl flex items-center justify-between group hover:border-accent/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bebas text-sm shrink-0 ${idx === 0 ? 'bg-accent/20 text-accent shadow-[0_0_12px_rgba(245,197,24,0.3)]' :
                      idx === 1 ? 'bg-white/10 text-white/60' :
                        idx === 2 ? 'bg-orange-500/10 text-orange-400' :
                          'bg-white/5 text-text-muted'
                      }`}>{idx + 1}</div>
                    {s.poster && <img src={s.poster} className="w-8 h-12 rounded-lg object-cover" />}
                    <div>
                      <div className="text-sm font-bold group-hover:text-accent transition-colors">{s.title}</div>
                      <div className="text-[10px] text-text-secondary">{s.year}</div>
                    </div>
                  </div>
                  <div className="text-accent font-bebas text-xl">
                    {s.ultimate_score ? Math.round(s.ultimate_score) : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Columns: Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Status Breakdown */}
          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <TrendingUp size={18} /> Status Distribution
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-12">
              <div
                className="w-40 h-40 rounded-full relative shrink-0"
                style={{
                  background: `conic-gradient(
                    #22c55e 0% ${(statusCounts.watched / total) * 100}%,
                    #3b82f6 ${(statusCounts.watched / total) * 100}% ${((statusCounts.watched + statusCounts.watching) / total) * 100}%,
                    #eab308 ${((statusCounts.watched + statusCounts.watching) / total) * 100}% ${((statusCounts.watched + statusCounts.watching + statusCounts.want_to_watch) / total) * 100}%,
                    #ef4444 ${((statusCounts.watched + statusCounts.watching + statusCounts.want_to_watch) / total) * 100}% 100%
                  )`
                }}
              >
                <div className="absolute inset-5 bg-card rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted -mb-0.5">Total</span>
                  <span className="font-bebas text-2xl">{total}</span>
                </div>
              </div>
              <div className="space-y-2 flex-1 w-full">
                {[
                  { label: 'Watched', count: statusCounts.watched, color: 'bg-green-500' },
                  { label: 'Watching', count: statusCounts.watching, color: 'bg-blue-500' },
                  { label: 'Watchlist', count: statusCounts.want_to_watch, color: 'bg-yellow-500' },
                  { label: 'Dropped', count: statusCounts.dropped, color: 'bg-red-500' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      <span className="text-text-secondary">{s.label}</span>
                    </div>
                    <span className="font-bold">{s.count} ({total ? Math.round((s.count / total) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Genres */}
          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent">Top Genres</h3>
            <div className="space-y-4">
              {topGenres.map(([genre, count]) => (
                <div key={genre} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{genre}</span>
                    <span className="text-text-secondary">{count}</span>
                  </div>
                  <div className="w-full bg-white/[0.04] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-accent/80 to-accent h-full rounded-full transition-all duration-700 hover:brightness-125"
                      style={{ width: `${(count / (topGenres[0]?.[1] || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="glass-panel p-8 rounded-3xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent">Rating Distribution</h3>
            <div className="flex items-end justify-between h-40 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => {
                const count = ratings[r] || 0;
                const maxCount = Math.max(...Object.values(ratings), 1);
                return (
                  <div key={r} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Hover count label */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-accent text-background text-[9px] font-bold px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-lg">
                      {count}
                    </div>
                    <div
                      className="w-full bg-accent/[0.15] group-hover:bg-accent rounded-t-lg transition-all duration-500 animate-bar-grow"
                      style={{ height: `${Math.max((count / maxCount) * 100, 4)}%` }}
                    />
                    <span className="text-[10px] font-bold text-text-secondary group-hover:text-accent transition-colors">{r}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
