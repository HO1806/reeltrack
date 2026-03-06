import { LibraryEntry, Settings } from '../types';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

export const api = {
    async getLibrary(): Promise<LibraryEntry[]> {
        const response = await fetch(`${API_BASE_URL}/library`);
        if (!response.ok) throw new Error('Failed to fetch library');
        return response.json();
    },

    async addEntry(entry: LibraryEntry): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
        });
        if (!response.ok) throw new Error('Failed to add entry');
    },

    async updateEntry(id: string, entry: LibraryEntry): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/library/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
        });
        if (!response.ok) throw new Error('Failed to update entry');
    },

    async deleteEntry(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/library/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete entry');
    },

    async clearLibrary(): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/library`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to clear library');
    },

    async syncLibrary(localLibrary: LibraryEntry[]): Promise<LibraryEntry[]> {
        try {
            const remoteLibrary = await this.getLibrary();
            const remoteMap = new Map<string, LibraryEntry>(remoteLibrary.map(e => [e.id, e]));

            const entriesToSync = localLibrary.map(localEntry => {
                const remoteEntry = remoteMap.get(localEntry.id);
                if (!remoteEntry) {
                    return localEntry;
                } else {
                    return {
                        ...localEntry,
                        imdb_score: localEntry.imdb_score ?? remoteEntry.imdb_score ?? localEntry.imdb_10 ?? remoteEntry.imdb_10,
                        mc_score: localEntry.mc_score ?? remoteEntry.mc_score ?? localEntry.m_val ?? remoteEntry.m_val,
                        rt_critics: localEntry.rt_critics ?? remoteEntry.rt_critics ?? localEntry.rc_val ?? remoteEntry.rc_val,
                        rt_audience: localEntry.rt_audience ?? remoteEntry.rt_audience ?? localEntry.ra_val ?? remoteEntry.ra_val,
                    };
                }
            });

            // Process locally synced library through backend in chunks 
            // Avoids Network/Browser JSON stringification payload drops and timeouts for massive imports >500 items
            const chunkSize = 100;
            for (let i = 0; i < entriesToSync.length; i += chunkSize) {
                const chunk = entriesToSync.slice(i, i + chunkSize);
                const response = await fetch(`${API_BASE_URL}/library/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entries: chunk }),
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Bulk sync chunk failed (index ${i}): ${response.status} - ${errText}`);
                }
            }

            // Return fresh data from remote once fully ingested
            return await this.getLibrary();
        } catch (err) {
            console.error('🚨 SYNC LIBRARY FATAL ERROR:', err);
            return localLibrary;
        }
    },

    async fetchFromImdb(imdbId: string, tmdbApiKey: string): Promise<{ success: boolean; entry: LibraryEntry; error?: string }> {
        const response = await fetch(`${API_BASE_URL}/library/fetch-from-imdb`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imdbId, tmdbApiKey }),
        });
        if (!response.ok) throw new Error('Failed to fetch from IMDb via backend');
        return await response.json();
    },

    async runBatchRater(force = false): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/rate/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force })
        });
        if (!response.ok) throw new Error('Failed to run batch rater');
        return response.json();
    },

    async rateSingle(id: string, imdbId: string): Promise<{ ultimate_score: number; imdb_10: number; m_val: number; rc_val: number; ra_val: number } | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/rate/single`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, imdbId }),
            });
            if (!response.ok) return null;
            const result = await response.json();
            if (result.success) {
                return {
                    ultimate_score: result.ultimate_score,
                    imdb_10: result.imdb_10,
                    m_val: result.m_val,
                    rc_val: result.rc_val,
                    ra_val: result.ra_val,
                };
            }
            return null;
        } catch {
            return null;
        }
    },

    async enrichSuggestions(items: any[], tmdbApiKey: string): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/suggestions/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, tmdbApiKey }),
        });
        if (!response.ok) throw new Error('Failed to enrich suggestions');
        const result = await response.json();
        return result.success ? result.items : items;
    },

    async getSettings(): Promise<Partial<Settings>> {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
    },

    async updateSettings(settings: Partial<Settings>): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        if (!response.ok) throw new Error('Failed to save settings');
    },

    async stremioWebSync(items: { imdbId: string; title: string; type: string; isWatched: boolean; year?: number }[]): Promise<{ success: boolean; added: number; skipped: number; watchedUpdated: number }> {
        try {
            const response = await fetch(`${API_BASE_URL}/library/stremio-web-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            if (!response.ok) throw new Error('Failed to sync Stremio Web data');
            return await response.json();
        } catch (e) {
            console.error('Stremio Web Sync error:', e);
            throw e;
        }
    },

    async getLimitStatus(): Promise<{ limitReached: boolean }> {
        try {
            const response = await fetch(`${API_BASE_URL}/limits/status`);
            if (!response.ok) return { limitReached: false };
            return await response.json();
        } catch (e) {
            return { limitReached: false };
        }
    },

    async getSyncStatus(): Promise<{ total: number; synced: number; missingScoreCount: number; isApiLimited: boolean }> {
        try {
            const response = await fetch(`${API_BASE_URL}/sync-status`);
            if (!response.ok) return { total: 0, synced: 0, missingScoreCount: 0, isApiLimited: false };
            return await response.json();
        } catch (e) {
            return { total: 0, synced: 0, missingScoreCount: 0, isApiLimited: false };
        }
    },

    async getStats(): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        return response.json();
    },

    async getMissingRatings(): Promise<any[]> {
        const response = await fetch(`${API_BASE_URL}/missing-ratings`);
        if (!response.ok) throw new Error('Failed to fetch missing ratings');
        return await response.json();
    },

    async saveRatings(items: any[]): Promise<{ success: boolean; updatedCount: number }> {
        const response = await fetch(`${API_BASE_URL}/save-ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
        });
        if (!response.ok) throw new Error('Failed to save ratings');
        return await response.json();
    }
};
