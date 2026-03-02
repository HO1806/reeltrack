import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';

interface BulkAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    tmdbApiKey: string;
    onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

interface ProcessItem {
    id: string;
    imdbId: string;
    status: 'idle' | 'loading' | 'success' | 'error';
    error?: string;
    result?: any;
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    tmdbApiKey,
    onToast
}) => {
    const [items, setItems] = useState<ProcessItem[]>([
        { id: Math.random().toString(), imdbId: '', status: 'idle' }
    ]);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAddRow = () => {
        setItems([...items, { id: Math.random().toString(), imdbId: '', status: 'idle' }]);
    };

    const handleRemoveRow = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        } else {
            setItems([{ id: Math.random().toString(), imdbId: '', status: 'idle' }]);
        }
    };

    const handleInputChange = (id: string, value: string) => {
        setItems(items.map(item => item.id === id ? { ...item, imdbId: value.trim() } : item));
    };

    const handleProcess = async () => {
        if (!tmdbApiKey) {
            onToast('error', 'TMDB API Key is required to fetch metadata');
            return;
        }

        const validItems = items.filter(item => item.imdbId.startsWith('tt'));
        if (validItems.length === 0) {
            onToast('error', 'Please enter at least one valid IMDb ID (starting with "tt")');
            return;
        }

        setIsProcessing(true);
        let successCount = 0;

        // Process one by one to avoid hitting rate limits too hard and to show individual progress
        for (const item of validItems) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'loading' } : i));

            try {
                const result = await api.fetchFromImdb(item.imdbId, tmdbApiKey);
                if (result.success) {
                    // Save to library via backend
                    await api.syncLibrary([result.entry]);
                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', result: result.entry } : i));
                    successCount++;
                } else {
                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error } : i));
                }
            } catch (err: any) {
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
            }
        }

        setIsProcessing(false);
        if (successCount > 0) {
            onToast('success', `Successfully added ${successCount} titles!`);
            onSuccess();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-accent/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center text-accent">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bebas tracking-wide">Bulk IMDb Discovery</h2>
                            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Complete your missing data</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-text-muted hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-3 text-blue-400">
                        <AlertCircle size={20} className="shrink-0" />
                        <p className="text-xs leading-relaxed">
                            Enter IMDb IDs (e.g., <code className="bg-blue-500/20 px-1 rounded text-blue-200">tt8079248</code>) to fetch full metadata and calculate the Ultimate Score automatically.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0">
                                    {index + 1}
                                </div>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={item.imdbId}
                                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                                        placeholder="tt#######"
                                        disabled={isProcessing || item.status === 'success'}
                                        className={`input-field w-full pl-4 pr-10 py-3 ${item.status === 'success' ? 'border-green-500/50 text-green-400' :
                                                item.status === 'error' ? 'border-red-500/50' : ''
                                            }`}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {item.status === 'loading' && <Loader2 size={16} className="animate-spin text-accent" />}
                                        {item.status === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                                        {item.status === 'error' && (
                                            <div className="group relative">
                                                <AlertCircle size={16} className="text-red-500" />
                                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-red-500 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                                    {item.error || 'Failed'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveRow(item.id)}
                                    disabled={isProcessing || item.status === 'success'}
                                    className="p-3 hover:bg-red-500/10 text-text-muted hover:text-red-400 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleAddRow}
                        disabled={isProcessing}
                        className="w-full py-4 border-2 border-dashed border-white/5 hover:border-accent/30 rounded-2xl flex items-center justify-center gap-2 text-text-muted hover:text-accent transition-all group"
                    >
                        <Plus size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add another ID</span>
                    </button>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/5 bg-elevated/30 flex gap-4">
                    <button
                        onClick={onClose}
                        className="btn-secondary flex-1 py-4 text-sm font-bold uppercase tracking-widest rounded-2xl"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleProcess}
                        disabled={isProcessing || items.every(i => !i.imdbId || i.status === 'success')}
                        className="btn-primary flex-[2] py-4 text-sm font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 relative overflow-hidden"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                <span>Fetch Metadata & Rate</span>
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
