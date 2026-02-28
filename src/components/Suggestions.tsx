import React, { useState, useEffect } from 'react';
import { LibraryEntry, Suggestion } from '../types';
import { Sparkles, RefreshCcw, Plus, Play, Search, Loader2, ExternalLink } from 'lucide-react';
import { getAISuggestions } from '../services/gemini';
import { cn } from '../utils';
import { motion } from 'motion/react';

interface SuggestionsProps {
  library: LibraryEntry[];
  geminiApiKey: string;
  onAdd: (suggestion: Suggestion) => void;
  onSelect: (suggestion: Suggestion) => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Suggestions: React.FC<SuggestionsProps> = ({
  library, geminiApiKey, onAdd, onSelect, onToast
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  useEffect(() => {
    if (geminiApiKey && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [geminiApiKey]);

  const fetchSuggestions = async (keyToUse = geminiApiKey) => {
    if (!keyToUse) {
      onToast('info', 'Please provide a Gemini API key');
      return;
    }
    setIsLoading(true);
    try {
      const results = await getAISuggestions(library, keyToUse);
      setSuggestions(results);
      onToast('success', 'AI Suggestions updated!');
    } catch (e: any) {
      onToast('error', e.message || 'Failed to get suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  if (!geminiApiKey && !suggestions.length) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
        <div className="glass-panel p-10 rounded-3xl text-center space-y-6">
          <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
            <Sparkles size={40} />
          </div>
          <h2 className="text-3xl font-bebas tracking-wide">AI Recommendations</h2>
          <p className="text-text-secondary">
            Get personalized movie and series suggestions based on your library and ratings using Gemini Flash.
          </p>
          <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              <span>Enter Gemini API Key</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-accent hover:underline flex items-center gap-1">
                Get Free Key <ExternalLink size={10} />
              </a>
            </div>
            <input 
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Paste your key here..."
              className="input-field w-full text-center"
            />
            <button 
              onClick={() => fetchSuggestions(tempApiKey)}
              disabled={!tempApiKey || isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              Generate Suggestions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bebas tracking-wider text-accent flex items-center gap-3">
            <Sparkles size={28} /> AI Suggestions
          </h2>
          <p className="text-xs text-text-secondary font-medium">
            Based on your {library.filter(e => e.rating.overall).length} rated titles
          </p>
        </div>
        <button 
          onClick={() => fetchSuggestions()}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2 self-start"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
          Refresh Suggestions
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 size={48} className="text-accent animate-spin" />
          <p className="text-text-secondary font-medium animate-pulse">Analyzing your taste profile...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {suggestions.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel overflow-hidden rounded-[2rem] border border-white/5 hover:border-accent/30 transition-all group flex flex-col sm:flex-row h-full"
            >
              {/* Poster */}
              <div 
                className="w-full sm:w-40 shrink-0 aspect-[2/3] sm:aspect-auto relative bg-white/5 cursor-pointer"
                onClick={() => onSelect(s)}
              >
                {s.poster ? (
                  <img src={s.poster} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-accent/20 font-bebas text-4xl">
                    {s.title.substring(0, 2)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent sm:hidden" />
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="cursor-pointer" onClick={() => onSelect(s)}>
                      <h3 className="font-bebas text-2xl tracking-wide group-hover:text-accent transition-colors">{s.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{s.year}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{s.type}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 italic">
                    "{s.reason}"
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                  <button 
                    onClick={() => onAdd(s)}
                    className="flex-1 bg-accent text-background px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  >
                    <Plus size={14} /> Add to Library
                  </button>
                  {s.imdb_id && (
                    <button 
                      onClick={() => window.open(`stremio:///detail/${s.type === 'movie' ? 'movie' : 'series'}/${s.imdb_id}`, '_blank')}
                      className="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <Play size={14} fill="currentColor" /> Watch Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
