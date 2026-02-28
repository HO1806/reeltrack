import React, { useState, useRef } from 'react';
import { X, Upload, FileJson, Loader2, CheckCircle } from 'lucide-react';
import { StremioImport, LibraryEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateId, normalizeTitle } from '../utils';
import { getTMDBMetadata, searchTMDB } from '../services/tmdb';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: LibraryEntry[]) => void;
  tmdbApiKey: string;
  existingLibrary: LibraryEntry[];
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen, onClose, onImport, tmdbApiKey, existingLibrary, onToast
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImport = async (data: StremioImport) => {
    setIsImporting(true);
    const newItems = data.items;
    setProgress({ current: 0, total: newItems.length });

    const importedEntries: LibraryEntry[] = [];
    let skipped = 0;

    for (const item of newItems) {
      // Deduplicate
      const exists = existingLibrary.find(e => 
        (item.imdb_id && e.imdbId === item.imdb_id) || 
        normalizeTitle(e.title) === normalizeTitle(item.title)
      );

      if (exists) {
        skipped++;
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        continue;
      }

      // Create skeleton
      const skeleton: LibraryEntry = {
        id: generateId(),
        title: item.title,
        type: item.type,
        year: 0,
        genres: [],
        poster: '',
        description: '',
        director: '',
        cast: [],
        runtime: 0,
        seasons: 0,
        currentSeason: 1,
        currentEpisode: 1,
        status: item.status || 'want_to_watch',
        rating: { story: null, acting: null, visuals: null, overall: null },
        rewatchCount: 0,
        streamingUrl: item.imdb_id ? `stremio:///detail/${item.type === 'movie' ? 'movie' : 'series'}/${item.imdb_id}` : '',
        imdbId: item.imdb_id || '',
        tmdbId: 0,
        tmdbPopularity: 0,
        personalNote: '',
        dateAdded: new Date().toISOString(),
        dateWatched: null,
        tags: [],
        isFavorite: false,
        isPinned: false,
        notifiedUnrated: false
      };

      // Fetch metadata if possible
      if (tmdbApiKey) {
        try {
          // Wait 300ms to respect rate limits
          await new Promise(r => setTimeout(r, 300));
          
          let tmdbId = 0;
          if (item.imdb_id) {
            // Find by external ID would be better but search works too
            const results = await searchTMDB(item.title, tmdbApiKey);
            const match = results.find((r: any) => r.title === item.title || r.name === item.title);
            if (match) tmdbId = match.id;
          } else {
            const results = await searchTMDB(item.title, tmdbApiKey);
            if (results.length > 0) tmdbId = results[0].id;
          }

          if (tmdbId) {
            const metadata = await getTMDBMetadata(tmdbId, item.type === 'movie' ? 'movie' : 'tv', tmdbApiKey);
            Object.assign(skeleton, metadata);
          }
        } catch (e) {
          console.error(`Failed to fetch metadata for ${item.title}`);
        }
      }

      importedEntries.push(skeleton);
      setProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    onImport(importedEntries);
    onToast('success', `Import complete: ${importedEntries.length} added, ${skipped} skipped`);
    setIsImporting(false);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        processImport(json);
      } catch (err) {
        onToast('error', 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full">
          <X size={20} />
        </button>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileJson size={32} />
          </div>
          <h2 className="text-2xl font-bebas tracking-wide">Import from Stremio</h2>
          <p className="text-sm text-text-secondary">
            Upload the JSON file exported from the Stremio Web companion script.
          </p>

          {isImporting ? (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center gap-3 text-accent">
                <Loader2 size={24} className="animate-spin" />
                <span className="font-bold">Fetching Metadata...</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-accent h-full transition-all duration-300" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-text-secondary">
                {progress.current} / {progress.total} items processed
              </div>
            </div>
          ) : (
            <div className="py-8">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/10 hover:border-accent/50 hover:bg-accent/5 p-10 rounded-2xl transition-all group"
              >
                <Upload size={32} className="mx-auto mb-4 text-text-secondary group-hover:text-accent transition-colors" />
                <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary">Click to upload JSON</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".json" 
                className="hidden" 
              />
            </div>
          )}

          <div className="text-[10px] text-text-secondary uppercase tracking-widest leading-relaxed">
            Metadata fetching respects TMDB rate limits (1 req / 300ms).<br />
            Existing entries will not be overwritten.
          </div>
        </div>
      </motion.div>
    </div>
  );
};
