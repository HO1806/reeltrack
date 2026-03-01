import { LibraryEntry, Settings } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

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

    async syncLibrary(localLibrary: LibraryEntry[]): Promise<LibraryEntry[]> {
        try {
            const remoteLibrary = await this.getLibrary();

            // Basic two-way sync strategy:
            // 1. Add missing local items to remote
            // 2. Fetch all from remote after updates
            const remoteIds = new Set(remoteLibrary.map(e => e.id));

            for (const localEntry of localLibrary) {
                if (!remoteIds.has(localEntry.id)) {
                    await this.addEntry(localEntry);
                }
            }

            return await this.getLibrary();
        } catch (err) {
            console.warn('Sync failed, using local data:', err);
            return localLibrary;
        }
    }
};
