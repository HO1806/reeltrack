import React, { useState, useRef } from 'react';
import { X, Upload, FileJson, Loader2, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { StremioImport, LibraryEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateId, normalizeTitle } from '../utils';
import { getExternalIds, searchTMDB } from '../services/tmdb';
import { api } from '../services/api';

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
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: 'metadata' as 'metadata' | 'scoring' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImport = async (data: StremioImport) => {
    setIsImporting(true);
    const newItems = data.items;
    setProgress({ current: 0, total: newItems.length, phase: 'metadata' });

    const importedEntries: LibraryEntry[] = [];
    let skipped = 0;

    for (const item of newItems) {
      const exists = existingLibrary.find(e => {
        const hasImdbMatch = item.imdb_id && e.imdbId === item.imdb_id;
        const hasTitleMatch = normalizeTitle(e.title) === normalizeTitle(item.title);
        const hasYearMatch = (!e.year || !item.year) || (e.year === item.year);
        return hasImdbMatch || (hasTitleMatch && hasYearMatch);
      });

      if (exists) {
        skipped++;
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        continue;
      }

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

  const handleOpenStremioWeb = () => {
    window.open('https://web.stremio.com/#/library', '_blank');
    onToast('info', 'Click the purple "⚡ Sync to ReelTrack" button on Stremio Web');
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
        className="relative w-full max-w-lg bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full">
          <X size={20} />
        </button>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileJson size={32} />
          </div>
          <h2 className="text-2xl font-bebas tracking-wide">Import Library</h2>
          <p className="text-sm text-text-secondary">
            Sync from Stremio Web or upload a JSON export file.
          </p>

          {isImporting ? (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center gap-3 text-accent">
                <Loader2 size={24} className="animate-spin" />
                <span className="font-bold">Fetching Metadata + Ratings</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-text-secondary">
                Processing {progress.current} / {progress.total} items — fetching metadata
              </div>
            </div>
          ) : (
            <div className="py-6 space-y-4">
              {/* Stremio Web Sync Button */}
              <button
                onClick={handleOpenStremioWeb}
                className="w-full border-2 border-[#7B5BF5]/30 hover:border-[#7B5BF5]/60 hover:bg-[#7B5BF5]/10 p-6 rounded-2xl transition-all group flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-[#7B5BF5]/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#7B5BF5]/30 transition-colors">
                  <RefreshCw size={24} className="text-[#7B5BF5]" />
                </div>
                <div className="text-left flex-1">
                  <span className="text-sm font-bold text-text-primary block">Sync from Stremio Web</span>
                  <span className="text-xs text-text-secondary">Opens Stremio — click the ⚡ button there</span>
                </div>
                <ExternalLink size={16} className="text-text-secondary group-hover:text-[#7B5BF5] transition-colors" />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-text-secondary uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* File Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/10 hover:border-accent/50 hover:bg-accent/5 p-6 rounded-2xl transition-all group flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/10 transition-colors">
                  <Upload size={24} className="text-text-secondary group-hover:text-accent transition-colors" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary block">Upload JSON File</span>
                  <span className="text-xs text-text-secondary">From the Stremio export script</span>
                </div>
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
            New entries will be auto-enriched with metadata & ratings.<br />
            Existing entries will not be overwritten.
          </div>
        </div>
      </motion.div>
    </div>
  );
};
