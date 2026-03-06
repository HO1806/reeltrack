import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Settings as SettingsIcon,
  Download,
  X,
  Star,
  Film,
  Menu,
  Sparkles,
  Dices,
  Pause
} from 'lucide-react';
import { cn } from '../utils';
import { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';

interface NavbarProps {
  onAdd: () => void;
  onSurprise: (type: 'movie' | 'series') => void;
  onImport: () => void;
  onSettings: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  totalItems: number;
  syncedItems: number;
  missingScoreCount?: number;
  isApiLimited?: boolean;
  onMissingRatingsClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onAdd,
  onSurprise,
  onImport,
  onSettings,
  notifications,
  onMarkRead,
  onMarkAllRead,
  totalItems,
  syncedItems,
  missingScoreCount = 0,
  isApiLimited = false,
  onMissingRatingsClick
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSurprisePrompt, setShowSurprisePrompt] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read).length;

  const tabs = [
    { id: '/', label: 'Home' },
    { id: '/movies', label: 'Movies' },
    { id: '/series', label: 'Series' },
    { id: '/rated', label: 'Rated' },
    { id: '/history', label: 'History' },
    { id: '/stats', label: 'Stats' },
  ];

  // SVG Circular Progress
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const syncPercentage = totalItems > 0 ? (syncedItems / totalItems) * 100 : 100;
  const strokeDashoffset = circumference - (syncPercentage / 100) * circumference;

  const getSyncTooltip = () => {
    if (totalItems === syncedItems) return 'Everything is fully synced!';
    if (isApiLimited) return 'Background sync paused: OMDb API daily limit reached. Will resume tomorrow.';
    return `Syncing in background: ${syncedItems}/${totalItems} items Enriched`;
  };

  const getSyncText = () => {
    if (syncPercentage === 100) return "Synced";
    if (isApiLimited) return "Paused";
    return `${syncedItems}/${totalItems}`;
  };

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
        <Link to="/" className="flex items-center gap-4 group cursor-pointer decoration-transparent">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center transition-colors duration-500 shadow-accent-glow group-hover:bg-accent/20">
            <Film size={24} className="text-accent group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h1 className="font-bebas text-[34px] tracking-[5px] text-white leading-none mt-1">REELTRACK</h1>
        </Link>
      </div>

      {/* Center: Tabs (Desktop) */}
      <div className="hidden lg:flex items-center gap-10">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.id || (tab.id !== '/' && location.pathname.startsWith(tab.id));
          return (
            <Link
              key={tab.id}
              to={tab.id}
              className={cn(
                "text-[13px] font-bold uppercase tracking-[0.15em] transition-all relative py-2 decoration-transparent",
                isActive ? "text-accent" : "text-text-secondary hover:text-white"
              )}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="navTab"
                  className="absolute -bottom-1 left-0 right-0 h-[3px] bg-accent rounded-full shadow-[0_0_20px_rgba(245,197,24,0.5)]"
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-6">

        {/* Sync Progress Indicator */}
        <button
          onClick={onMissingRatingsClick}
          title={getSyncTooltip()}
          className="hidden sm:flex items-center gap-2 group cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            {isApiLimited ? (
              <Pause size={14} className="text-red-500/80 fill-current ml-px" />
            ) : (
              <>
                <svg width="16" height="16" className="absolute inset-0 rotate-[-90deg]">
                  <circle
                    cx="8" cy="8" r={radius}
                    fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-white/10"
                  />
                  <circle
                    cx="8" cy="8" r={radius}
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={cn(
                      "transition-all duration-1000",
                      syncPercentage === 100 ? "text-green" : "text-accent"
                    )}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                {syncPercentage === 100 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-1.5 h-1.5 bg-green rounded-full shadow-[0_0_10px_#10b981]" />
                  </motion.div>
                )}
              </>
            )}
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest transition-colors",
            isApiLimited ? "text-red-500/80 font-bold" : syncPercentage === 100 ? "text-green" : "text-accent group-hover:text-accent-light"
          )}>
            {getSyncText()}
          </span>
        </button>

        <div className="flex items-center gap-2 relative">
          {/* Surprise Me Feature */}
          <Button
            variant="icon"
            onClick={() => setShowSurprisePrompt(!showSurprisePrompt)}
            aria-label="Surprise Me"
            title="Surprise Me"
            className={cn("hidden sm:flex group relative", showSurprisePrompt && "text-accent bg-surface-active")}
          >
            <Dices size={20} className="group-hover:scale-110 transition-transform" />
          </Button>

          {/* Surprise Selection Popup */}
          <AnimatePresence>
            {showSurprisePrompt && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                className="absolute top-full lg:left-0 right-0 mt-4 w-[280px] glass-panel rounded-3xl overflow-hidden z-[160] shadow-premium p-4 flex flex-col gap-3"
              >
                <div className="text-center font-bold text-[11px] uppercase tracking-widest text-text-muted mb-2">I should recommend a...</div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setShowSurprisePrompt(false); onSurprise('movie'); navigate('/movies'); }}
                  >
                    Movie
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setShowSurprisePrompt(false); onSurprise('series'); navigate('/series'); }}
                  >
                    Series
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
            onClick={onSettings}
            aria-label="Settings"
            title="Settings"
            className="group"
          >
            <SettingsIcon size={20} className="group-hover:scale-110 transition-transform" />
          </Button>
        </div>

        {/* Change New Entry explicitly to 'Import' using the specified aesthetic */}
        <Button onClick={onImport} variant="primary">
          <Download size={18} />
          <span className="hidden sm:inline">Import</span>
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
                <Link
                  key={tab.id}
                  to={tab.id}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "text-5xl font-bebas tracking-[10px] transition-all decoration-transparent",
                    (location.pathname === tab.id || (tab.id !== '/' && location.pathname.startsWith(tab.id))) ? "text-accent scale-110" : "text-text-secondary hover:text-white"
                  )}
                >
                  {tab.label}
                </Link>
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
