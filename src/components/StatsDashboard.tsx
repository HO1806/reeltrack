import React, { useState, useEffect } from 'react';
import { LibraryEntry } from '../types';
import { Film, Tv, Clock, BarChart3, Star, TrendingUp, Loader2 } from 'lucide-react';
import { formatRuntime } from '../utils';
import { api } from '../services/api';

interface StatsDashboardProps {
  library: LibraryEntry[];
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ library }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [library.length]); // Refresh stats when library count changes

  if (loading || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-4">
        <Loader2 className="animate-spin text-accent" size={40} />
        <p className="font-bebas tracking-widest text-lg">COLLECTING MISSION DATA...</p>
      </div>
    );
  }

  const { total, movies, series, totalMinutes, statusCounts, ratings, topGenres, topMovies, topSeries } = stats;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <div className="px-4 py-2 animate-fade-in max-w-[1920px] mx-auto h-[calc(100vh-80px)] grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6 overflow-hidden">
      {/* Column 1: Top Rated Series Sidebar */}
      <div className="hidden lg:flex flex-col h-full glass-cockpit rounded-2xl overflow-hidden border-r border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-3">
            <Tv size={14} className="text-purple-500" /> TOP SERIES
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {topSeries.map((s: any, idx: number) => (
            <div key={s.id} className="flex items-center justify-between group p-2 rounded-xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center font-bebas text-xs shrink-0 bg-white/5 text-text-muted">
                  {idx + 1}
                </div>
                {s.poster && <img src={s.poster} className="w-8 h-12 rounded-md object-cover shadow-2xl" />}
                <div className="truncate max-w-[140px]">
                  <div className="text-[11px] font-black truncate group-hover:text-accent transition-colors leading-tight">{s.title}</div>
                  <div className="text-[9px] text-text-muted font-bold">{s.year}</div>
                </div>
              </div>
              <div className="text-accent font-bebas text-sm bg-accent/5 px-2 py-0.5 rounded-lg border border-accent/10">
                {s.score ? Math.round(s.score) : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Center Console */}
      <div className="flex flex-col h-full space-y-6 pt-2 overflow-y-auto lg:overflow-visible custom-scrollbar">

        {/* Hero Stats - Scaled Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'TOTAL ASSETS', value: total, icon: BarChart3, color: 'text-accent' },
            { label: 'CINEMATIC', value: movies, icon: Film, color: 'text-blue-500' },
            { label: 'EPISODIC', value: series, icon: Tv, color: 'text-purple-500' },
            { label: 'OPERATIONAL HRS', value: `${hours}H ${mins}M`, icon: Clock, color: 'text-green-500' },
          ].map((stat, i) => (
            <div key={i} className="glass-cockpit group flex items-center p-5 gap-5 transition-all duration-500 hover:scale-[1.02] hover:border-accent/40 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 opacity-5">
                <stat.icon size={48} />
              </div>
              <div className={`p-4 rounded-2xl bg-white/[0.04] ${stat.color} transition-all duration-500 group-hover:scale-110 shrink-0 shadow-lg`}>
                <stat.icon size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted leading-tight mb-1">{stat.label}</div>
                <div className="text-3xl font-bebas tracking-widest text-white group-hover:text-accent transition-colors drop-shadow-md">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row - Scaled Up */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          <div className="glass-cockpit p-8 rounded-3xl space-y-6 flex flex-col justify-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent flex items-center gap-3">
              <TrendingUp size={16} /> MISSION STATUS
            </h3>
            <div className="flex items-center gap-12 justify-center">
              <div
                className="w-44 h-44 rounded-full relative shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-white/5"
                style={{
                  background: total > 0 ? `conic-gradient(
                    #22c55e 0% ${(statusCounts.watched / total) * 100}%,
                    #3b82f6 ${(statusCounts.watched / total) * 100}% ${((statusCounts.watched + statusCounts.watching) / total) * 100}%,
                    #eab308 ${((statusCounts.watched + statusCounts.watching) / total) * 100}% ${((statusCounts.watched + statusCounts.watching + statusCounts.want_to_watch) / total) * 100}%,
                    #ef4444 ${((statusCounts.watched + statusCounts.watching + statusCounts.want_to_watch) / total) * 100}% 100%
                  )` : '#111'
                }}
              >
                <div className="absolute inset-6 bg-[#08080f] rounded-full flex flex-col items-center justify-center border border-white/10 shadow-inner">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-1">TOTAL OPS</span>
                  <span className="font-bebas text-4xl text-white">{total}</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Watched', count: statusCounts.watched, color: 'bg-green-500' },
                  { label: 'Watching', count: statusCounts.watching, color: 'bg-blue-500' },
                  { label: 'Watchlist', count: statusCounts.want_to_watch, color: 'bg-yellow-500' },
                  { label: 'Dropped', count: statusCounts.dropped, color: 'bg-red-500' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-6 text-xs group cursor-default">
                    <div className="flex items-center gap-3 w-24">
                      <div className={`w-2 h-2 rounded-full ${s.color} shadow-[0_0_10px_currentColor] group-hover:scale-125 transition-transform`} />
                      <span className="text-text-muted font-black uppercase tracking-widest group-hover:text-text-primary transition-colors">{s.label}</span>
                    </div>
                    <span className="font-bebas text-lg text-white translate-y-[1px] group-hover:text-accent transition-colors">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-cockpit p-8 rounded-3xl space-y-6 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent flex items-center gap-3">
              RATING SIGNAL SPECTRUM
            </h3>
            <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => {
                const count = ratings[r] || 0;
                const maxCount = Math.max(...Object.values(ratings) as number[], 1);
                return (
                  <div key={r} className="flex-1 flex flex-col items-center gap-3 group relative">
                    <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bebas text-accent">{count}</div>
                    <div
                      className="w-full bg-accent/20 group-hover:bg-accent/80 rounded-t-md transition-all duration-500 border-x border-t border-accent/20 relative"
                      style={{ height: `${Math.max((count / maxCount) * 100, 5)}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
                    </div>
                    <span className="text-[10px] font-black text-text-muted group-hover:text-accent transition-colors">{r}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Genres Row - Scaled Up */}
        <div className="glass-cockpit p-8 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent">GENRE AFFINITY MATRIX</h3>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted opacity-60">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span>LIVE DATA FEED</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {topGenres.map(([genre, count]: [string, number]) => (
              <div key={genre} className="space-y-3 group cursor-default">
                <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em]">
                  <span className="text-text-primary group-hover:text-accent transition-colors">{genre}</span>
                  <span className="text-accent drop-shadow-[0_0_8px_rgba(245,197,24,0.4)] font-bebas text-lg">{count}</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5 p-[1px]">
                  <div
                    className="bg-gradient-to-r from-accent/40 via-accent to-accent h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(245,197,24,0.3)] rounded-full"
                    style={{ width: `${(count / (topGenres[0]?.[1] || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3: Top Rated Movies Sidebar */}
      <div className="hidden lg:flex flex-col h-full glass-cockpit rounded-2xl overflow-hidden border-l border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-3">
            <Film size={14} className="text-blue-500" /> TOP MOVIES
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {topMovies.map((m: any, idx: number) => (
            <div key={m.id} className="flex items-center justify-between group p-2 rounded-xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center font-bebas text-xs shrink-0 bg-white/5 text-text-muted">
                  {idx + 1}
                </div>
                {m.poster && <img src={m.poster} className="w-8 h-12 rounded-md object-cover shadow-2xl" />}
                <div className="truncate max-w-[140px]">
                  <div className="text-[11px] font-black truncate group-hover:text-accent transition-colors leading-tight">{m.title}</div>
                  <div className="text-[9px] text-text-muted font-bold">{m.year}</div>
                </div>
              </div>
              <div className="text-accent font-bebas text-sm bg-accent/5 px-2 py-0.5 rounded-lg border border-accent/10">
                {m.score ? Math.round(m.score) : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

