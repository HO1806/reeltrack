import React, { useState } from 'react';
import { X, Key, Monitor, Database, Trash2, Eye, EyeOff, Download, Upload, ExternalLink, SortAsc, Sparkles } from 'lucide-react';
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
  onClearData: () => Promise<void>;
  onRepairRatings: () => Promise<void>;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen, onClose, settings, onUpdateSettings, onExport, onImportBackup, onClearData, onRepairRatings
}) => {
  const [showTmdb, setShowTmdb] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full glass-panel-elevated animate-slide-in-right rounded-l-3xl overflow-hidden">
      <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="text-2xl font-bebas tracking-wider text-accent">Settings</h2>
        <button onClick={onClose} className="p-2.5 hover:bg-white/[0.06] rounded-xl transition-all duration-300 text-text-secondary hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
        {/* API Keys */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Key size={20} />
            </div>
            <h3 className="font-bebas text-lg tracking-wider text-white">API Configuration</h3>
          </div>

          <div className="space-y-5">
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
                  className="input-field w-full pr-12 !py-3 !text-xs"
                  placeholder="Paste your TMDB API key..."
                />
                <button onClick={() => setShowTmdb(!showTmdb)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent transition-colors">
                  {showTmdb ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Groq API Key</label>
                <a href="https://console.groq.com/keys" target="_blank" className="text-[10px] text-accent hover:underline flex items-center gap-1">
                  Get Key <ExternalLink size={10} />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showGroq ? "text" : "password"}
                  value={settings.groqApiKey}
                  onChange={(e) => onUpdateSettings({ ...settings, groqApiKey: e.target.value })}
                  className="input-field w-full pr-12 !py-3 !text-xs"
                  placeholder="Paste your Groq API key..."
                />
                <button onClick={() => setShowGroq(!showGroq)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent transition-colors">
                  {showGroq ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue">
              <Monitor size={20} />
            </div>
            <h3 className="font-bebas text-lg tracking-wider text-white">Preferences</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-5 glass-panel rounded-2xl">
              <div>
                <p className="text-sm font-bold">Show Posters</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Display artwork on cards</p>
              </div>
              <button
                onClick={() => onUpdateSettings({ ...settings, showPosters: !settings.showPosters })}
                className={cn(
                  "settings-toggle",
                  settings.showPosters ? "bg-accent" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "toggle-dot",
                  settings.showPosters ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Default Sort Method</label>
              <select
                value={settings.defaultSort}
                onChange={(e) => onUpdateSettings({ ...settings, defaultSort: e.target.value })}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-accent/30 transition-all cursor-pointer appearance-none"
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
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center text-purple">
              <Database size={20} />
            </div>
            <h3 className="font-bebas text-lg tracking-wider text-white">Data Management</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button onClick={onExport} className="glass-panel p-5 rounded-2xl flex items-center gap-4 hover:border-white/[0.15] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center text-green group-hover:scale-105 transition-transform">
                <Download size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Export Backup</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Download JSON snapshot</p>
              </div>
            </button>
            <button onClick={onImportBackup} className="glass-panel p-5 rounded-2xl flex items-center gap-4 hover:border-white/[0.15] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue group-hover:scale-105 transition-transform">
                <Upload size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Import Backup</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Restore from JSON file</p>
              </div>
            </button>
            <button onClick={onRepairRatings} className="glass-panel p-5 rounded-2xl flex items-center gap-4 hover:border-white/[0.15] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                <Sparkles size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Repair Ratings</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Force refresh all library scores</p>
              </div>
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-6 border-t border-red/10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red/10 flex items-center justify-center text-red shadow-[0_0_20px_rgba(248,113,113,0.15)]">
              <Trash2 size={20} />
            </div>
            <h3 className="font-bebas text-lg tracking-wider text-red">Danger Zone</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">To clear all data, type <span className="text-red font-bold">DELETE</span> below.</p>
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE..."
              className="w-full bg-white/[0.03] border border-red/20 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-red/50 transition-all placeholder:text-text-muted"
            />
            <button
              disabled={confirmDelete !== 'DELETE'}
              onClick={async () => { await onClearData(); setConfirmDelete(''); }}
              className="w-full py-4 bg-red/10 text-red border border-red/20 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-red hover:text-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(248,113,113,0.1)]"
            >
              Clear All Library Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
