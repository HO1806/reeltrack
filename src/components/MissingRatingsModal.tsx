import React, { useState, useEffect } from 'react';
import { X, Search, Save, Loader2, Star, Film, Tv, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import { cn } from '../utils';

interface MissingRatingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const MissingRatingsModal: React.FC<MissingRatingsModalProps> = ({
    isOpen,
    onClose,
    onSaved
}) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadItems();
        } else {
            // Reset state on close
            setItems([]);
            setSearchQuery('');
            setHasChanges(false);
        }
    }, [isOpen]);

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await api.getMissingRatings();
            setItems(data);
            setHasChanges(false);
        } catch (err) {
            console.error('Failed to load missing ratings', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (id: string, field: string, value: string) => {
        setHasChanges(true);
        setItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        [field]: value === '' ? null : value,
                    }
                    : item
            )
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Filter out items that actually had a change (by comparing to their original or checking non-nulls)
            // To be safe and simple, we can just save all items that are currently loaded 
            // or optionally specifically track dirtied items. Here we'll send the whole list.
            const payload = items.map((item) => ({
                id: item.id,
                imdb_score: item.imdb_score,
                mc_score: item.mc_score,
                rt_critics: item.rt_critics,
                rt_audience: item.rt_audience,
            }));

            await api.saveRatings(payload);
            onSaved(); // Trigger library refresh
            onClose();
        } catch (err) {
            console.error('Failed to save ratings', err);
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = items.filter((item) =>
        item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[200]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-x-4 top-[5%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-auto sm:w-[900px] h-[90vh] max-h-[900px] bg-[#0a0a0a] border border-white/10 rounded-[32px] shadow-2xl flex flex-col z-[201] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-bebas tracking-wider text-white">Manual Rating Entry</h2>
                                <p className="text-sm font-medium text-text-muted">
                                    Provide exact scores to unlock the Ultimate Score for these items.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-white/10 shrink-0 bg-background relative z-10">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search missing items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-6 bg-background/50">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
                                    <Loader2 size={32} className="animate-spin text-accent" />
                                    <span className="text-sm font-bold uppercase tracking-widest">Fetching Missing Ratings...</span>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
                                    <Star size={48} className="opacity-20" />
                                    <span className="text-lg font-bold">No Missing Ratings</span>
                                    <p className="text-sm">Your library is completely enriched.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="group flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 bg-white/[0.03] border border-white/[0.05] p-3 sm:pr-6 rounded-2xl hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                                        >
                                            {/* Left: Poster & Title */}
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-12 h-16 sm:w-14 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                                                    {item.poster ? (
                                                        <img src={`https://image.tmdb.org/t/p/w92${item.poster}`} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                                            {item.type === 'movie' ? <Film size={16} /> : <Tv size={16} />}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <h3 className="text-sm sm:text-base font-bold text-white truncate truncate-2-lines leading-tight">
                                                        {item.title}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-xs text-text-muted font-black uppercase tracking-widest">
                                                        <span>{item.year || 'N/A'}</span>
                                                        <span>•</span>
                                                        <span className="text-accent">{item.type}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Score Inputs */}
                                            <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap shrink-0 ml-16 sm:ml-0">
                                                <div className="flex flex-col gap-1 w-[70px]">
                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted text-center">IMDb</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        placeholder="e.g. 8.5"
                                                        value={item.imdb_score ?? ''}
                                                        onChange={(e) => handleInputChange(item.id, 'imdb_score', e.target.value)}
                                                        className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-sm font-bold focus:bg-white/10 focus:border-accent/50 focus:outline-none transition-all placeholder:text-white/10 placeholder:font-normal"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 w-[70px]">
                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted text-center">Meta</label>
                                                    <input
                                                        type="number"
                                                        placeholder="e.g. 85"
                                                        value={item.mc_score ?? ''}
                                                        onChange={(e) => handleInputChange(item.id, 'mc_score', e.target.value)}
                                                        className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-sm font-bold focus:bg-white/10 focus:border-accent/50 focus:outline-none transition-all placeholder:text-white/10 placeholder:font-normal"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 w-[70px]">
                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted text-center">Critics</label>
                                                    <input
                                                        type="number"
                                                        placeholder="e.g. 92"
                                                        value={item.rt_critics ?? ''}
                                                        onChange={(e) => handleInputChange(item.id, 'rt_critics', e.target.value)}
                                                        className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-sm font-bold focus:bg-white/10 focus:border-accent/50 focus:outline-none transition-all placeholder:text-white/10 placeholder:font-normal"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 w-[70px]">
                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted text-center">Audience</label>
                                                    <input
                                                        type="number"
                                                        placeholder="e.g. 88"
                                                        value={item.rt_audience ?? ''}
                                                        onChange={(e) => handleInputChange(item.id, 'rt_audience', e.target.value)}
                                                        className="bg-white/5 border border-white/10 rounded-lg py-2 text-center text-sm font-bold focus:bg-white/10 focus:border-accent/50 focus:outline-none transition-all placeholder:text-white/10 placeholder:font-normal"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end shrink-0">
                            <button
                                onClick={handleSave}
                                disabled={loading || saving || !hasChanges}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
                                    hasChanges && !saving
                                        ? "bg-accent text-background shadow-accent-glow hover:scale-105"
                                        : "bg-white/5 text-white/30 cursor-not-allowed"
                                )}
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
