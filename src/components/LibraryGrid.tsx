import React from 'react';
import { LibraryEntry } from '../types';
import { MovieCard } from './MovieCard';
import { Plus, Search, Film, Popcorn, Sparkles, Star } from 'lucide-react';

interface LibraryGridProps {
  entries: LibraryEntry[];
  onEdit: (entry: LibraryEntry) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleWatched: (id: string) => void;
  onUpdateEpisode: (id: string, delta: number) => void;
  onQuickRate: (id: string, rating: number) => void;
  onFindSimilar: (entry: LibraryEntry) => void;
  onAdd?: () => void;
  onClick?: (entry: LibraryEntry) => void;
  activeTab: string;
  isSearching?: boolean;
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  entries,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleWatched,
  onUpdateEpisode,
  onQuickRate,
  onFindSimilar,
  onAdd,
  onClick,
  activeTab,
  isSearching = false
}) => {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
        {isSearching ? (
          <>
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-text-muted">
              <Search size={40} />
            </div>
            <h2 className="text-2xl font-bebas tracking-wide mb-2">No titles match your search</h2>
            <p className="text-text-muted max-w-md">Try adjusting your filters or search terms to find what you're looking for.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-accent">
              <Film size={40} />
            </div>
            <h2 className="text-2xl font-bebas tracking-wide mb-2">Your collection is empty</h2>
            <p className="text-text-muted max-w-md mb-8">Start building your cinematic library by adding your first movie or series.</p>
            {onAdd && (
              <button onClick={onAdd} className="bg-accent text-background px-6 py-2 rounded-full font-bold uppercase tracking-widest flex items-center gap-2">
                <Plus size={20} />
                Add Your First Title
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6 p-6">
      {entries.map((entry, index) => (
        <MovieCard 
          key={entry.id}
          entry={entry}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onToggleWatched={onToggleWatched}
          onUpdateEpisode={onUpdateEpisode}
          onQuickRate={onQuickRate}
          onFindSimilar={onFindSimilar}
          onClick={onClick}
          index={index}
        />
      ))}
    </div>
  );
};
