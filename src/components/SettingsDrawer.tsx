import React, { useState } from 'react';
import { X, Key, Monitor, Database, Trash2, Eye, EyeOff, Download, Upload, ExternalLink, SortAsc } from 'lucide-react';
import { Settings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (s: Settings) => void;
  onExport: () => void;
  onImportBackup: () => void;
  onClearData: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen, onClose, settings, onUpdateSettings, onExport, onImportBackup, onClearData
}) => {
  const [showTmdb, setShowTmdb] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-2xl font-bebas tracking-wider text-accent">Settings</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
        {/* API Keys */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-accent">
            <Key size={18} />
            <h3 className="font-bebas text-lg tracking-wider">API Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">TMDB API Key</label>
                <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-[10px] text-accent hover:underline flex items-center gap-1">
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <div className="relative">
                <input 
                  type={showTmdb ? "text" : "password"}
                  value={settings.tmdbApiKey}
                  onChange={(e) => onUpdateSettings({ ...settings, tmdbApiKey: e.target.value })}
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-accent/50 transition-all"
                  placeholder="Paste your TMDB API key..."
                />
                <button onClick={() => setShowTmdb(!showTmdb)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                  {showTmdb ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Gemini API Key</label>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-accent hover:underline flex items-center gap-1">
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <div className="relative">
                <input 
                  type={showGemini ? "text" : "password"}
                  value={settings.geminiApiKey}
                  onChange={(e) => onUpdateSettings({ ...settings, geminiApiKey: e.target.value })}
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-accent/50 transition-all"
                  placeholder="Paste your Gemini API key..."
                />
                <button onClick={() => setShowGemini(!showGemini)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                  {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-accent">
            <Monitor size={18} />
            <h3 className="font-bebas text-lg tracking-wider">Preferences</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="text-xs font-bold">Show Posters</p>
                <p className="text-[9px] text-text-muted uppercase tracking-wider">Display artwork</p>
              </div>
              <button 
                onClick={() => onUpdateSettings({ ...settings, showPosters: !settings.showPosters })}
                className={cn(
                  "w-10 h-5 rounded-full transition-all relative",
                  settings.showPosters ? "bg-accent" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                  settings.showPosters ? "left-6" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Default Sort Method</label>
              <select 
                value={settings.defaultSort}
                onChange={(e) => onUpdateSettings({ ...settings, defaultSort: e.target.value })}
                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-accent/50 transition-all cursor-pointer"
              >
                <option value="smartScore">Smart Score (Recommended)</option>
                <option value="dateAdded">Recently Added</option>
                <option value="rating">Highest Rated</option>
                <option value="title">Alphabetical (A-Z)</option>
                <option value="year">Release Year</option>
              </select>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-accent">
            <Database size={18} />
            <h3 className="font-bebas text-lg tracking-wider">Data Management</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <button onClick={onExport} className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
              <Download size={16} /> Export Backup
            </button>
            <button onClick={onImportBackup} className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
              <Upload size={16} /> Import Backup
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-6 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-3 text-red-500">
            <Trash2 size={18} />
            <h3 className="font-bebas text-lg tracking-wider">Danger Zone</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">To clear all data, type <span className="text-red-500 font-bold">DELETE</span> below.</p>
            <input 
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE..."
              className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-red-500 transition-all"
            />
            <button 
              disabled={confirmDelete !== 'DELETE'}
              onClick={() => { onClearData(); setConfirmDelete(''); }}
              className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All Library Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
