import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Dices,
  Settings as SettingsIcon,
  Download,
  X,
  Star,
  Film,
  Menu,
  Sparkles
} from 'lucide-react';
import { cn } from '../utils';
import { LibraryEntry, Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdd: () => void;
  onSurprise: () => void;
  onImport: () => void;
  onSettings: () => void;
  onBulkAdd: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  isSaved?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onAdd,
  onSurprise,
  onImport,
  onSettings,
  onBulkAdd,
  notifications,
  onMarkRead,
  onMarkAllRead,
  isSaved
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const tabs = [
    { id: 'movies', label: 'Movies' },
    { id: 'series', label: 'Series' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'history', label: 'History' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full h-nav glass-panel-elevated z-[150] flex items-center justify-between px-8 animate-cinematic border-b border-white/10">
      {/* Left: Logo & Menu Button */}
      <div className="flex items-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          className="p-2 -ml-2 lg:hidden"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center transition-colors duration-500 shadow-accent-glow group-hover:bg-accent/20">
            <Film size={24} className="text-accent group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h1 className="font-bebas text-[34px] tracking-[5px] text-white leading-none mt-1">REELTRACK</h1>
        </div>
      </div>

      {/* Center: Tabs (Desktop) */}
      <div className="hidden lg:flex items-center gap-10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "text-[13px] font-bold uppercase tracking-[0.15em] transition-all relative py-2",
              activeTab === tab.id ? "text-accent" : "text-text-secondary hover:text-white"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="navTab"
                className="absolute -bottom-1 left-0 right-0 h-[3px] bg-accent rounded-full shadow-[0_0_20px_rgba(245,197,24,0.5)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-6">
        {isSaved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="hidden sm:flex items-center gap-2 text-green text-[10px] font-bold uppercase tracking-widest bg-green/10 px-3 py-1 rounded-full border border-green/20"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            <span>Synced</span>
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            onClick={onSurprise}
            aria-label="Surprise Me"
            title="Surprise Me"
            className="hidden sm:flex group"
          >
            <Dices size={20} className="group-hover:scale-110 transition-transform" />
          </Button>

          {/* Notifications Bell */}
          <div className="relative">
            <Button
              variant="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
              aria-expanded={showNotifications}
              className={cn("relative", showNotifications && "text-accent bg-surface-active")}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-elevated shadow-lg animate-bounce">
                  {unreadCount}
                </span>
              )}
            </Button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  className="absolute top-full right-0 mt-4 w-[320px] glass-panel rounded-3xl overflow-hidden z-[160] shadow-premium"
                >
                  <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">Alerts</h3>
                    <button
                      onClick={onMarkAllRead}
                      className="text-[10px] font-bold uppercase tracking-widest text-accent hover:text-white transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-[440px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => { onMarkRead(n.id); setShowNotifications(false); }}
                            className={cn(
                              "p-4 rounded-2xl transition-all cursor-pointer flex gap-4",
                              n.read ? "opacity-40" : "bg-white/[0.04] hover:bg-white/[0.08]"
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                              {n.type === 'UNRATED_WATCHED' ? <Star size={16} className="text-accent" /> : <Bell size={16} className="text-accent" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] leading-relaxed text-text-primary">{n.message}</p>
                              <p className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1">
                                <Sparkles size={10} /> {new Date(n.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-text-muted flex flex-col items-center gap-3">
                        <Bell size={32} className="opacity-20" />
                        <p className="text-[11px] uppercase tracking-widest">Minimal silence reached</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            variant="icon"
            onClick={onImport}
            aria-label="Import from Stremio"
            title="Import from Stremio"
            className="hidden sm:flex group"
          >
            <Download size={20} className="group-hover:scale-110 transition-transform" />
          </Button>

          <Button
            variant="icon"
            onClick={onSettings}
            aria-label="Settings"
            title="Settings"
            className="group"
          >
            <SettingsIcon size={20} className="group-hover:scale-110 transition-transform" />
          </Button>

          <Button
            variant="icon"
            onClick={onBulkAdd}
            aria-label="Bulk IMDb Discovery"
            title="Bulk IMDb Discovery"
            className="hidden sm:flex group text-accent/70 hover:bg-accent/10"
          >
            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
          </Button>
        </div>

        <Button onClick={onAdd} variant="primary">
          <Plus size={18} />
          <span className="hidden sm:inline">New Entry</span>
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 top-0 left-0 w-full h-screen bg-background/60 z-[140] lg:hidden p-8 flex flex-col justify-center gap-8 text-center"
          >
            <div className="flex flex-col gap-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                  className={cn(
                    "text-5xl font-bebas tracking-[10px] transition-all",
                    activeTab === tab.id ? "text-accent scale-110" : "text-text-secondary hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-12 flex flex-col items-center gap-6">
              <Button
                variant="secondary"
                onClick={() => { onImport(); setIsMenuOpen(false); }}
                className="w-full max-w-[280px]"
              >
                <Download size={18} /> Import
              </Button>
              <button
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close Menu"
                className="w-12 h-12 rounded-full glass-panel flex items-center justify-center"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
