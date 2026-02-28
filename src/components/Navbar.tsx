import React, { useState } from 'react';
import { 
  Bell, 
  Plus, 
  Dices, 
  Settings as SettingsIcon,
  Download,
  X,
  Star,
  Film
} from 'lucide-react';
import { cn } from '../utils';
import { LibraryEntry, Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdd: () => void;
  onSurprise: () => void;
  onImport: () => void;
  onSettings: () => void;
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
  notifications,
  onMarkRead,
  onMarkAllRead,
  isSaved
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
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
    <nav className="fixed top-0 left-0 right-0 h-[60px] bg-background/80 backdrop-blur-xl border-b border-white/5 z-[100] flex items-center justify-between px-6">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <Film size={20} className="text-accent" />
        <h1 className="font-bebas text-[28px] tracking-[3px] text-white leading-none">REELTRACK</h1>
      </div>

      {/* Center: Tabs */}
      <div className="hidden lg:flex items-center gap-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "text-[13px] font-bold uppercase tracking-[0.1em] transition-all relative py-2",
              activeTab === tab.id ? "text-accent" : "text-text-secondary hover:text-white"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="navTab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {isSaved && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-green text-[10px] font-bold uppercase tracking-widest"
          >
            <span>✓ Saved</span>
          </motion.div>
        )}

        <div className="flex items-center gap-1">
          <button 
            onClick={onSurprise}
            title="Surprise Me"
            className="p-2 text-text-secondary hover:text-accent transition-colors"
          >
            <Dices size={18} />
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "p-2 text-text-secondary hover:text-accent transition-colors relative",
                showNotifications && "text-accent"
              )}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-accent text-background text-[9px] font-bold rounded-full flex items-center justify-center border border-background">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-[280px] glass-panel rounded-2xl overflow-hidden z-[110]"
                >
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Notifications</h3>
                    <button 
                      onClick={onMarkAllRead}
                      className="text-[9px] font-bold uppercase tracking-widest text-accent hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { onMarkRead(n.id); setShowNotifications(false); }}
                            className={cn(
                              "p-3 rounded-xl transition-all cursor-pointer flex gap-3",
                              n.read ? "opacity-50" : "bg-white/5 hover:bg-white/10"
                            )}
                          >
                            <div className="mt-1">
                              {n.type === 'UNRATED_WATCHED' ? <Star size={14} className="text-accent" /> : <Bell size={14} className="text-text-secondary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] leading-relaxed">{n.message}</p>
                              <p className="text-[9px] text-text-muted mt-1">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center text-text-muted text-[10px] uppercase tracking-widest">
                        No notifications
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={onImport}
            title="Import from Stremio"
            className="p-2 text-text-secondary hover:text-accent transition-colors"
          >
            <Download size={18} />
          </button>

          <button 
            onClick={onSettings}
            title="Settings"
            className="p-2 text-text-secondary hover:text-accent transition-colors"
          >
            <SettingsIcon size={18} />
          </button>
        </div>

        <button 
          onClick={onAdd}
          className="bg-accent text-background px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </div>
    </nav>
  );
};
