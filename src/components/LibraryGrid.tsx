import { motion } from 'motion/react';
import { LibraryEntry } from '../types';
import { MovieCard } from './MovieCard';
import { Plus, Search, Film } from 'lucide-react';
import { MovieCardSkeleton } from './Skeleton';

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
  isLoading?: boolean;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

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
  isSearching = false,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-8 px-4 sm:px-6 py-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <MovieCardSkeleton key={i} />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center py-28 px-6 text-center"
      >
        {isSearching ? (
          <>
            <div className="w-24 h-24 bg-white/[0.04] rounded-full flex items-center justify-center mb-8 text-text-muted border border-white/[0.06]">
              <Search size={44} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-bebas tracking-widest mb-3 uppercase text-white">Zero Matrix Matches</h2>
            <p className="text-text-secondary text-sm max-w-md">No entries found within these parameters. Adjust your search logic.</p>
          </>
        ) : (
          <>
            <div className="relative mb-8 flex justify-center animate-breathe">
              <div className="absolute inset-0 bg-accent/20 blur-[60px] rounded-full w-48 h-48 -translate-x-12 -translate-y-12"></div>
              <div className="w-24 h-24 bg-accent/[0.1] rounded-full flex items-center justify-center text-accent shadow-accent-glow border border-accent/[0.2] relative z-10">
                <Film size={44} strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-4xl font-bebas tracking-widest mb-3 uppercase text-white relative z-10">Your Matrix is Empty</h2>
            <p className="text-white/80 text-sm max-w-md mb-10 relative z-10">Initiate your collection by registering your first title into the master database.</p>
            {onAdd && (
              <button
                onClick={onAdd}
                className="btn-primary px-10 py-4 rounded-2xl shadow-accent-glow flex items-center gap-3 text-base"
              >
                <Plus size={22} />
                REGISTER NEW TITLE
              </button>
            )}
          </>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-8 px-4 sm:px-6 py-6"
    >
      {entries.map((entry, index) => (
        <motion.div key={entry.id} variants={item}>
          <MovieCard
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
        </motion.div>
      ))}
    </motion.div>
  );
};
