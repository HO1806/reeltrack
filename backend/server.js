require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isLimitReached, setLimitReached } = require('./limitHelper');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let isRaterRunning = false;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'reeltrack'
};

// OMDB API Keys for rotation and parallel processing
// Loaded dynamically from OMDB_API_KEYS in backend/.env (comma-separated)
const OMDB_API_KEYS = (process.env.OMDB_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
let currentKeyIndex = 0;

function getNextOMDBKey() {
    const key = OMDB_API_KEYS[currentKeyIndex % OMDB_API_KEYS.length];
    currentKeyIndex++;
    return key;
}

let pool;

async function initDB() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        await connection.end();

        pool = mysql.createPool(dbConfig);

        // Ensure table exists with unique constraints
        await pool.query(`
            CREATE TABLE IF NOT EXISTS library (
                id VARCHAR(50) PRIMARY KEY,
                type VARCHAR(20) NOT NULL,
                title VARCHAR(255) NOT NULL,
                year INT,
                genres JSON,
                poster TEXT,
                description TEXT,
                director VARCHAR(255),
                cast JSON,
                runtime INT,
                seasons INT,
                currentSeason INT,
                currentEpisode INT,
                status VARCHAR(20),
                rating JSON,
                rewatchCount INT,
                streamingUrl TEXT,
                imdbId VARCHAR(20),
                tmdbId INT,
                tmdbPopularity FLOAT,
                vote_average FLOAT,
                personalNote TEXT,
                dateAdded DATETIME,
                dateWatched DATETIME,
                tags JSON,
                isFavorite BOOLEAN,
                isPinned BOOLEAN,
                notifiedUnrated BOOLEAN,
                imdb_score FLOAT,
                mc_score FLOAT,
                rt_critics FLOAT,
                rt_audience FLOAT,
                UNIQUE KEY unique_imdb (imdbId),
                UNIQUE KEY unique_title_year_type (title, year, type)
            )
        `);

        // Run migrations to add columns and indices that may not exist
        const migrations = [
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS tmdbPopularity FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS vote_average FLOAT',
            'ALTER TABLE library RENAME COLUMN imdb_10 TO imdb_score',
            'ALTER TABLE library RENAME COLUMN m_val TO mc_score',
            'ALTER TABLE library RENAME COLUMN rc_val TO rt_critics',
            'ALTER TABLE library RENAME COLUMN ra_val TO rt_audience',
            'ALTER TABLE library DROP COLUMN IF EXISTS ultimate_score',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS rating_needs_rescan BOOLEAN DEFAULT FALSE',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS enriched_at DATETIME',
            'ALTER TABLE library ADD UNIQUE INDEX IF NOT EXISTS unique_imdb (imdbId)',
            'ALTER TABLE library ADD UNIQUE INDEX IF NOT EXISTS unique_title_year_type (title, year, type)'
        ];
        for (const migration of migrations) {
            try { await pool.query(migration); } catch (e) { /* column/index may already exist */ }
        }

        // Create cache for TMDB and ratings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS metadata_cache (
                imdbId VARCHAR(20) PRIMARY KEY,
                tmdbId INT,
                type VARCHAR(20),
                title VARCHAR(255),
                year INT,
                poster TEXT,
                imdb_score FLOAT,
                mc_score FLOAT,
                rt_critics FLOAT,
                rt_audience FLOAT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create table for Settings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT PRIMARY KEY,
                tmdbApiKey TEXT,
                groqApiKey TEXT,
                showPosters BOOLEAN DEFAULT true,
                defaultSort VARCHAR(50) DEFAULT 'smartScore',
                bestStreak INT DEFAULT 0,
                currentStreak INT DEFAULT 0,
                lastWatchedDate DATETIME
            )
        `);

        // Insert default row if empty
        await pool.query(`
            INSERT IGNORE INTO settings (id, tmdbApiKey, groqApiKey, showPosters, defaultSort, bestStreak, currentStreak, lastWatchedDate) 
            VALUES (1, '', '', true, 'smartScore', 0, 0, NULL)
        `);

        console.log('Database and Library tables ready');
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

// Helper to filter and format entry
function formatEntryForSQL(entry) {
    const columns = [
        'id', 'type', 'title', 'year', 'genres', 'poster', 'description',
        'director', 'cast', 'runtime', 'seasons', 'currentSeason',
        'currentEpisode', 'status', 'rating', 'rewatchCount', 'streamingUrl',
        'imdbId', 'tmdbId', 'tmdbPopularity', 'vote_average', 'personalNote',
        'dateAdded', 'dateWatched', 'tags', 'isFavorite', 'isPinned', 'notifiedUnrated',
        'imdb_score', 'mc_score', 'rt_critics', 'rt_audience', 'rating_needs_rescan', 'enriched_at'
    ];

    const data = {};
    columns.forEach(col => {
        if (entry[col] !== undefined) {
            let val = entry[col];
            if (['genres', 'cast', 'rating', 'tags'].includes(col)) {
                val = JSON.stringify(val);
            } else if (['isFavorite', 'isPinned', 'notifiedUnrated'].includes(col)) {
                val = !!val;
            } else if (col === 'dateAdded' || col === 'dateWatched' || col === 'enriched_at') {
                val = val ? new Date(val).toISOString().slice(0, 19).replace('T', ' ') : null;
            } else if (col === 'imdbId' && val === '') {
                val = null;
            } else if (col === 'tmdbId' && (val === 0 || val === '')) {
                val = null;
            }
            data[col] = val;
        }
    });
    return data;
}

// Helper to safely parse JSON
function safeParse(val, fallback) {
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return fallback; }
    }
    return val || fallback;
}

// Routes
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
        if (rows.length > 0) {
            res.json({
                tmdbApiKey: rows[0].tmdbApiKey || '',
                groqApiKey: rows[0].groqApiKey || '',
                showPosters: !!rows[0].showPosters,
                defaultSort: rows[0].defaultSort || 'smartScore',
                bestStreak: rows[0].bestStreak || 0,
                currentStreak: rows[0].currentStreak || 0,
                lastWatchedDate: rows[0].lastWatchedDate
            });
        } else {
            res.json({});
        }
    } catch (err) {
        console.error('GET /settings error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { tmdbApiKey, groqApiKey, showPosters, defaultSort, bestStreak, currentStreak, lastWatchedDate } = req.body;
        const query = `
            UPDATE settings 
            SET tmdbApiKey = ?, groqApiKey = ?, showPosters = ?, defaultSort = ?, bestStreak = ?, currentStreak = ?, lastWatchedDate = ?
            WHERE id = 1
        `;
        const dateVal = lastWatchedDate ? new Date(lastWatchedDate).toISOString().slice(0, 19).replace('T', ' ') : null;
        await pool.query(query, [tmdbApiKey || '', groqApiKey || '', !!showPosters, defaultSort || 'smartScore', bestStreak || 0, currentStreak || 0, dateVal]);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /settings error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM library ORDER BY dateAdded DESC');
        res.json(rows.map(row => ({
            ...row,
            genres: safeParse(row.genres, []),
            cast: safeParse(row.cast, []),
            rating: safeParse(row.rating, {}),
            tags: safeParse(row.tags, []),
            isFavorite: !!row.isFavorite,
            isPinned: !!row.isPinned,
            notifiedUnrated: !!row.notifiedUnrated,
            dateAdded: row.dateAdded,
            dateWatched: row.dateWatched
        })));
    } catch (err) {
        console.error('GET /library error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/library', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE library');
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /library (all) error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Limit Status Endpoint
app.get('/api/limits/status', (req, res) => {
    try {
        const isLimited = isLimitReached();
        res.json({ limitReached: isLimited });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lightweight Sync Status Endpoint — fast SQL counts for real-time progress
app.get('/api/sync-status', async (req, res) => {
    try {
        const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM library');

        const [[{ missingScoreCount }]] = await pool.query(`
            SELECT COUNT(*) as missingScoreCount FROM library 
            WHERE imdb_score IS NULL OR imdb_score = 0 
               OR mc_score IS NULL OR mc_score = 0 
               OR rt_critics IS NULL OR rt_critics = 0 
               OR rt_audience IS NULL OR rt_audience = 0
        `);

        const synced = total - missingScoreCount;
        const isLimited = isLimitReached();
        res.json({ total, synced, missingScoreCount, isApiLimited: isLimited });
    } catch (err) {
        console.error('GET /sync-status error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library', async (req, res) => {
    try {
        const data = formatEntryForSQL(req.body);
        // Use ON DUPLICATE KEY UPDATE to allow updating existing entries by IMDB ID or Title/Year
        await pool.query('INSERT INTO library SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /library error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/sync', async (req, res) => {
    try {
        const rawEntries = req.body.entries;
        if (!Array.isArray(rawEntries)) return res.status(400).json({ error: 'Expected an array of entries' });
        if (rawEntries.length === 0) return res.json({ success: true });

        // Pre-deduplicate by imdbId for the incoming payload
        const map = new Map();
        const deduplicatedEntries = [];
        rawEntries.forEach(entry => {
            if (entry.imdbId) {
                map.set(entry.imdbId, entry);
            } else {
                deduplicatedEntries.push(entry);
            }
        });
        deduplicatedEntries.push(...map.values());

        // Process sequentially in chunks to avoid overwhelming the pool and deadlocks
        const chunkSize = 50;
        for (let i = 0; i < deduplicatedEntries.length; i += chunkSize) {
            const chunk = deduplicatedEntries.slice(i, i + chunkSize);
            const formattedEntries = chunk.map(formatEntryForSQL);

            for (const data of formattedEntries) {
                // Manually resolve unique constraint collisions BEFORE we attempt INSERT
                // If this is a new ID for an existing imdbId, we must delete the old one
                // to prevent the ON DUPLICATE KEY UPDATE from causing a secondary unique key failure.
                if (data.imdbId) {
                    await pool.query('DELETE FROM library WHERE imdbId = ? AND id != ?', [data.imdbId, data.id]);
                }

                // Same for unique_title_year_type
                if (data.type && data.title && data.year) {
                    await pool.query('DELETE FROM library WHERE type = ? AND title = ? AND year = ? AND id != ?', [data.type, data.title, data.year, data.id]);
                }

                const keys = Object.keys(data);
                const protectedFields = [
                    'imdb_score', 'mc_score', 'rt_critics', 'rt_audience',
                    'tmdbId', 'poster', 'description', 'director', 'cast'
                ];

                const updatePattern = keys
                    .filter(k => k !== 'id')
                    .map(k => {
                        if (protectedFields.includes(k)) {
                            // Only update if the new value is "better" (not null, 0, empty string, or empty array)
                            return `${k} = IF(
                                VALUES(${k}) IS NOT NULL 
                                AND VALUES(${k}) != '' 
                                AND VALUES(${k}) != 0 
                                AND VALUES(${k}) != '[]', 
                                VALUES(${k}), 
                                ${k}
                            )`;
                        }
                        return `${k} = VALUES(${k})`;
                    })
                    .join(', ');

                const query = `INSERT INTO library (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updatePattern}`;
                const values = keys.map(k => data[k]);

                await pool.query(query, values);
            }
        }
        res.json({ success: true });

        // Trigger AutoRater background run immediately if not already running
        if (!isRaterRunning) {
            isRaterRunning = true;
            console.log('[Server] Spawning background autoRater...');
            const autoRaterPath = path.join(__dirname, 'autoRater.js');
            const child = spawn('node', [autoRaterPath, '--once'], {
                windowsHide: true
            });

            child.on('exit', (code) => {
                isRaterRunning = false;
                console.log(`[Server] Background autoRater finished (code ${code}). Lock released.`);
            });

            child.unref();
        } else {
            console.log('[Server] AutoRater is already running. Skipping spawn.');
        }

    } catch (err) {
        console.error('POST /library/sync error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Stremio Web Library Sync — accepts raw localStorage data from browser
app.post('/api/library/stremio-web-sync', async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Expected a non-empty array of items' });
        }

        console.log(`[StremioSync] Received ${items.length} items from Stremio Web`);

        // Get existing library for dedup
        const [existingRows] = await pool.query('SELECT imdbId, title, year, type FROM library WHERE imdbId IS NOT NULL');
        const existingImdbIds = new Set(existingRows.map(r => r.imdbId));

        let added = 0;
        let skipped = 0;
        let watchedUpdated = 0;

        for (const item of items) {
            if (!item.imdbId || !item.title) {
                skipped++;
                continue;
            }

            if (existingImdbIds.has(item.imdbId)) {
                // Item exists — only update watched status if Stremio says it's watched
                if (item.isWatched) {
                    await pool.query(
                        `UPDATE library SET status = 'watched', dateWatched = COALESCE(dateWatched, NOW()) WHERE imdbId = ? AND status != 'watched'`,
                        [item.imdbId]
                    );
                    watchedUpdated++;
                }
                skipped++;
                continue;
            }

            // New item — create skeleton entry
            const id = `stremio_${item.imdbId}_${Date.now()}`;
            const type = item.type === 'series' ? 'series' : 'movie';
            const status = item.isWatched ? 'watched' : 'want_to_watch';
            const streamingUrl = `stremio:///detail/${type}/${item.imdbId}`;

            const data = {
                id,
                type,
                title: item.title,
                year: item.year || 0,
                genres: '[]',
                poster: '',
                description: '',
                director: '',
                cast: '[]',
                runtime: 0,
                seasons: 0,
                currentSeason: 1,
                currentEpisode: 1,
                status,
                rating: '{"story":null,"acting":null,"visuals":null,"overall":null}',
                rewatchCount: 0,
                streamingUrl,
                imdbId: item.imdbId,
                tmdbId: null,
                tmdbPopularity: 0,
                vote_average: null,
                personalNote: '',
                dateAdded: new Date().toISOString().slice(0, 19).replace('T', ' '),
                dateWatched: status === 'watched' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
                tags: '[]',
                isFavorite: false,
                isPinned: false,
                notifiedUnrated: false,
                imdb_score: null,
                mc_score: null,
                rt_critics: null,
                rt_audience: null
            };

            try {
                const keys = Object.keys(data);
                const values = Object.values(data);
                await pool.query(
                    `INSERT INTO library (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE title = VALUES(title)`,
                    values
                );
                added++;
            } catch (insertErr) {
                console.error(`[StremioSync] Failed to insert ${item.title}:`, insertErr.message);
            }
        }

        console.log(`[StremioSync] Complete: ${added} added, ${skipped} skipped, ${watchedUpdated} watched-status updated`);

        // Trigger AutoRater for new entries
        if (added > 0 && !isRaterRunning) {
            isRaterRunning = true;
            console.log('[StremioSync] Spawning background autoRater for new entries...');
            const autoRaterPath = path.join(__dirname, 'autoRater.js');
            const child = spawn('node', [autoRaterPath, '--once'], { windowsHide: true });
            child.on('exit', (code) => {
                isRaterRunning = false;
                console.log(`[StremioSync] Background autoRater finished (code ${code}).`);
            });
            child.unref();
        }

        res.json({ success: true, added, skipped, watchedUpdated });

    } catch (err) {
        console.error('POST /library/stremio-web-sync error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/library/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = formatEntryForSQL(req.body);
        await pool.query('UPDATE library SET ? WHERE id = ?', [data, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('PUT /library error:', err);
        res.status(500).json({ error: err.message });
    }
});


// Shared helper: run Rater.py for a single IMDb ID and return parsed result
async function runRaterScript(imdbId, apiKey = null) {
    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, '..', 'Rater.py');

    return new Promise((resolve) => {
        const args = [scriptPath, imdbId];
        if (apiKey) args.push(apiKey);

        const proc = spawn(pythonPath, args, { windowsHide: true });
        let output = '';
        let errOutput = '';

        proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
        proc.stderr.on('data', (chunk) => { errOutput += chunk.toString(); });

        proc.on('close', () => {
            try {
                const result = JSON.parse(output.trim());
                resolve(result);
            } catch (e) {
                resolve({ error: `Parse error: ${errOutput || output}` });
            }
        });

        proc.on('error', (err) => {
            resolve({ error: `Failed to start Python: ${err.message}` });
        });
    });
}

// Rate a single entry by IMDb ID — called automatically from the frontend after adding/importing
app.post('/api/rate/single', async (req, res) => {
    try {
        if (isLimitReached()) {
            return res.status(429).json({ success: false, error: 'OMDB API Daily Limit Reached. Please try again tomorrow.' });
        }

        const { id, imdbId } = req.body;
        if (!id || !imdbId) return res.status(400).json({ error: 'id and imdbId are required' });

        const apiKey = getNextOMDBKey();
        const result = await runRaterScript(imdbId, apiKey);

        if (result && (result.imdb_10 === 'LIMIT' || result.error?.includes('LIMIT'))) {
            setLimitReached();
            return res.status(429).json({ success: false, error: 'OMDB API Daily Limit Reached. Please try again tomorrow.' });
        }

        if (!result.error) {
            // If entry exists in DB, update it. If not (newly added entry not yet synced), just return the score.
            try {
                await pool.query(
                    'UPDATE library SET imdb_score = ?, mc_score = ?, rt_critics = ?, rt_audience = ? WHERE id = ?',
                    [result.imdb_10, result.m_val, result.rc_val, result.ra_val, id]
                );
            } catch (dbErr) {
                console.warn('DB update skipped (entry may not be committed yet):', dbErr.message);
            }
            res.json({ success: true, ...result });
        } else {
            res.json({ success: false, error: result.error });
        }
    } catch (err) {
        console.error('Rate single error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fetch all entries that are missing at least one rating for the Manual Rating Modal
app.get('/api/missing-ratings', async (req, res) => {
    try {
        const query = `
            SELECT id, title, year, type, poster, imdb_score, mc_score, rt_critics, rt_audience 
            FROM library 
            WHERE imdb_score IS NULL OR mc_score IS NULL OR rt_critics IS NULL OR rt_audience IS NULL 
            ORDER BY year DESC, title ASC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('GET /missing-ratings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save manually input ratings
app.post('/api/save-ratings', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Invalid items array' });
        }

        const updates = items.map(item => {
            // Treat empty strings as NULL in DB
            const formatScore = (val) => (val === '' || val === undefined || isNaN(val)) ? null : parseFloat(val);

            return pool.query(
                `UPDATE library SET imdb_score = ?, mc_score = ?, rt_critics = ?, rt_audience = ? WHERE id = ?`,
                [formatScore(item.imdb_score), formatScore(item.mc_score), formatScore(item.rt_critics), formatScore(item.rt_audience), item.id]
            );
        });

        await Promise.all(updates);
        res.json({ success: true, updatedCount: items.length });
    } catch (err) {
        console.error('POST /save-ratings error:', err);
        res.status(500).json({ error: err.message });
    }
});

async function getTMDBMetadata(imdbId, tmdbApiKey) {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`);
    if (!findRes.ok) throw new Error('TMDB Find failed');
    const findData = await findRes.json();

    let tmdbData = null;
    let type = 'movie';
    if (findData.movie_results?.length > 0) {
        tmdbData = findData.movie_results[0];
        type = 'movie';
    } else if (findData.tv_results?.length > 0) {
        tmdbData = findData.tv_results[0];
        type = 'tv';
    } else {
        throw new Error('Title not found in TMDB for this IMDb ID');
    }

    const tmdbId = tmdbData.id;

    const detailsRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbApiKey}`);
    const details = await detailsRes.json();

    const creditsRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=${tmdbApiKey}`);
    const credits = await creditsRes.json();

    const director = type === 'movie'
        ? credits.crew?.find(c => c.job === 'Director')?.name || ''
        : details.created_by?.[0]?.name || '';

    const cast = credits.cast?.slice(0, 5).map(c => c.name) || [];

    return {
        id: Date.now().toString(),
        type: type === 'movie' ? 'movie' : 'series',
        title: details.title || details.name,
        year: new Date(details.release_date || details.first_air_date).getFullYear() || new Date().getFullYear(),
        genres: details.genres?.map(g => g.name) || [],
        poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '',
        description: details.overview || '',
        director,
        cast,
        runtime: details.runtime || (details.episode_run_time?.[0] || 0),
        seasons: details.number_of_seasons || 0,
        currentSeason: 1,
        currentEpisode: 1,
        tmdbId,
        imdbId,
        tmdbPopularity: details.popularity || 0,
        vote_average: details.vote_average || 0,
        streamingUrl: imdbId ? `stremio:///detail/${type === 'movie' ? 'movie' : 'series'}/${imdbId}` : '',
        status: 'want_to_watch',
        rating: { story: null, acting: null, visuals: null, overall: null },
        rewatchCount: 0,
        personalNote: '',
        dateAdded: new Date().toISOString(),
        dateWatched: null,
        tags: [],
        isFavorite: false,
        isPinned: false,
        notifiedUnrated: false
    };
}

app.post('/api/library/fetch-from-imdb', async (req, res) => {
    try {
        const { imdbId, tmdbApiKey } = req.body;
        if (!imdbId || !tmdbApiKey) return res.status(400).json({ error: 'imdbId and tmdbApiKey are required' });

        // 1. Fetch TMDB Metadata
        const entryData = await getTMDBMetadata(imdbId, tmdbApiKey);

        // 2. Fetch Ratings via Rater.py
        if (isLimitReached()) {
            return res.status(429).json({ success: false, error: 'OMDB API Daily Limit Reached. Cannot fetch ratings.' });
        }
        const apiKey = getNextOMDBKey();
        const raterResult = await runRaterScript(imdbId, apiKey);
        if (raterResult && (raterResult.imdb_10 === 'LIMIT' || raterResult.error?.includes('LIMIT'))) {
            setLimitReached();
            return res.status(429).json({ success: false, error: 'OMDB API Daily Limit Reached. Cannot fetch ratings.' });
        }

        if (!raterResult.error) {
            entryData.imdb_score = raterResult.imdb_10;
            entryData.mc_score = raterResult.m_val;
            entryData.rt_critics = raterResult.rc_val;
            entryData.rt_audience = raterResult.ra_val;
        }

        res.json({ success: true, entry: entryData });
    } catch (err) {
        console.error('fetch-from-imdb error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Batch rate entries
app.post('/api/rate/batch', async (req, res) => {
    const { force, items } = req.body;
    try {
        if (isLimitReached()) {
            return res.status(429).json({ success: false, error: 'OMDB API Daily Limit Reached. Batch rating cancelled until tomorrow.' });
        }

        let entriesToProcess = [];

        if (items && Array.isArray(items)) {
            entriesToProcess = items;
        } else {
            const query = force
                ? 'SELECT id, imdbId, title FROM library WHERE imdbId IS NOT NULL AND imdbId != ""'
                : 'SELECT id, imdbId, title FROM library WHERE imdbId IS NOT NULL AND imdbId != "" AND (imdb_score IS NULL OR imdb_score = 0 OR mc_score IS NULL OR mc_score = 0 OR rt_critics IS NULL OR rt_critics = 0 OR rt_audience IS NULL OR rt_audience = 0)';

            const [dbEntries] = await pool.query(query);
            entriesToProcess = dbEntries;
        }

        console.log(`[BatchRater] Processing ${entriesToProcess.length} items in parallel chunks of 4 (Force: ${force || 'false'})`);

        const results = [];
        const chunkSize = 4;
        let limitHitDuringBatch = false;

        for (let i = 0; i < entriesToProcess.length; i += chunkSize) {
            if (isLimitReached() || limitHitDuringBatch) break;

            const chunk = entriesToProcess.slice(i, i + chunkSize);
            console.log(`[BatchRater] Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(entriesToProcess.length / chunkSize)}...`);

            const promises = chunk.map(async (entry) => {
                if (!entry.id || !entry.imdbId) return { id: entry.id, success: false, error: 'Missing IMDb ID' };
                try {
                    const apiKey = getNextOMDBKey();
                    const raterResult = await runRaterScript(entry.imdbId, apiKey);

                    if (raterResult && (raterResult.imdb_10 === 'LIMIT' || raterResult.error?.includes('LIMIT'))) {
                        setLimitReached();
                        limitHitDuringBatch = true;
                        return { id: entry.id, title: entry.title, success: false, error: 'OMDB API Daily Limit Reached' };
                    }

                    if (raterResult && !raterResult.error) {
                        await pool.query(
                            'UPDATE library SET imdb_score = ?, mc_score = ?, rt_critics = ?, rt_audience = ? WHERE id = ?',
                            [raterResult.imdb_10, raterResult.m_val, raterResult.rc_val, raterResult.ra_val, entry.id]
                        );
                        return { id: entry.id, title: entry.title, success: true };
                    } else {
                        return { id: entry.id, title: entry.title, success: false, error: raterResult?.error || 'Unknown error' };
                    }
                } catch (itemErr) {
                    console.error(`[BatchRater] Error processing ${entry.title}:`, itemErr);
                    return { id: entry.id, title: entry.title, success: false, error: itemErr.message };
                }
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults);
        }

        if (limitHitDuringBatch || isLimitReached()) {
            return res.status(429).json({
                success: false,
                error: 'OMDB API Daily Limit Reached during batch processing. Stopped early.',
                processed: results.length,
                results
            });
        }

        res.json({ processed: results.length, results });
    } catch (err) {
        console.error('Batch rate fatal error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/library/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Attempting to delete entry: ${id}`);
        const [result] = await pool.query('DELETE FROM library WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            console.warn(`No entry found with id: ${id}`);
        } else {
            console.log(`Successfully deleted entry: ${id}`);
        }
        res.json({ success: true, affectedRows: result.affectedRows });
    } catch (err) {
        console.error(`Error deleting entry ${req.params.id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/suggestions/enrich', async (req, res) => {
    try {
        const { items, tmdbApiKey } = req.body;
        if (!Array.isArray(items) || !tmdbApiKey) {
            return res.status(400).json({ error: 'items array and tmdbApiKey are required' });
        }

        const enrichedItems = [];
        for (const item of items) {
            let imdbId = item.imdb_id;
            let tmdbData = null;
            const type = item.type === 'series' ? 'tv' : 'movie';

            // 1. If no reliable imdbId, search TMDB by title
            if (!imdbId || imdbId === 'null') {
                const searchRes = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${tmdbApiKey}&query=${encodeURIComponent(item.title)}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.results && searchData.results.length > 0) {
                        tmdbData = searchData.results[0];
                        // Get external IDs to find imdbId
                        const extRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbData.id}/external_ids?api_key=${tmdbApiKey}`);
                        if (extRes.ok) {
                            const extData = await extRes.json();
                            imdbId = extData.imdb_id;
                        }
                    }
                }
            } else {
                // We have an imdbId, we can find the TMDB data
                const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`);
                if (findRes.ok) {
                    const findData = await findRes.json();
                    tmdbData = type === 'tv' ? findData.tv_results?.[0] : findData.movie_results?.[0];
                }
            }

            let enrichedItem = {
                ...item,
                imdb_id: imdbId && imdbId !== 'null' ? imdbId : null,
                poster: tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null
            };

            // 2. Check Database Cache
            if (enrichedItem.imdb_id) {
                const [cached] = await pool.query('SELECT * FROM metadata_cache WHERE imdbId = ?', [enrichedItem.imdb_id]);
                if (cached.length > 0) {
                    enrichedItem.imdb_score = cached[0].imdb_score;
                    enrichedItem.mc_score = cached[0].mc_score;
                    enrichedItem.rt_critics = cached[0].rt_critics;
                    enrichedItem.rt_audience = cached[0].rt_audience;
                    enrichedItem.poster = cached[0].poster || enrichedItem.poster;
                    enrichedItems.push(enrichedItem);
                    continue; // Skip the heavy rating
                }
            }

            // 3. Call Rater.py if not cached and has valid IMDb ID
            if (enrichedItem.imdb_id) {
                const raterResult = await runRaterScript(enrichedItem.imdb_id);
                if (!raterResult.error && raterResult.imdb_10 != null) {
                    enrichedItem.imdb_score = raterResult.imdb_10;
                    enrichedItem.mc_score = raterResult.m_val;
                    enrichedItem.rt_critics = raterResult.rc_val;
                    enrichedItem.rt_audience = raterResult.ra_val;

                    // Save to cache
                    const cacheData = {
                        imdbId: enrichedItem.imdb_id,
                        tmdbId: tmdbData?.id || null,
                        type: item.type,
                        title: item.title,
                        year: item.year,
                        poster: enrichedItem.poster,
                        imdb_score: raterResult.imdb_10,
                        mc_score: raterResult.m_val,
                        rt_critics: raterResult.rc_val,
                        rt_audience: raterResult.ra_val
                    };
                    await pool.query('INSERT IGNORE INTO metadata_cache SET ?', [cacheData]);
                }
            }

            enrichedItems.push(enrichedItem);
        }

        res.json({ success: true, items: enrichedItems });
    } catch (err) {
        console.error('Enrichment error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        // 1. Basic Counts
        const [[{ total, movies, series }]] = await pool.query(
            "SELECT COUNT(*) as total, SUM(IF(type='movie', 1, 0)) as movies, SUM(IF(type IN ('series','tv'), 1, 0)) as series FROM library"
        );

        // 2. Operational Hours (Watched items only, strictly metadata-driven)
        const [[{ totalMinutes }]] = await pool.query(`
            SELECT SUM(
                CASE 
                    WHEN type = 'movie' THEN IFNULL(runtime, 0)
                    ELSE IFNULL(runtime, 0) * IFNULL(currentEpisode, 0)
                END
            ) as totalMinutes
            FROM library 
            WHERE status = 'watched'
        `);


        // 3. Mission Status
        const [statusRows] = await pool.query(
            "SELECT status, COUNT(*) as count FROM library GROUP BY status"
        );
        const statusCounts = { watched: 0, watching: 0, want_to_watch: 0, dropped: 0 };
        statusRows.forEach(r => statusCounts[r.status] = r.count);

        // 4. Rating Spectrum (Normalized to 1-10)
        // We calculate the weighted score average in SQL to get distribution
        const [ratingRows] = await pool.query(`
            SELECT ROUND(
                (IFNULL(imdb_score, 0) * 0.4 + IFNULL(mc_score, 0) * 0.4 + IFNULL((rt_critics + rt_audience)/2, 0) * 0.2) / 10
            ) as bucket, COUNT(*) as count
            FROM library
            WHERE (imdb_score > 0 OR mc_score > 0 OR rt_critics > 0 OR rt_audience > 0)
            GROUP BY bucket
            HAVING bucket BETWEEN 1 AND 10
        `);
        const ratings = {};
        ratingRows.forEach(r => ratings[r.bucket] = r.count);

        // 5. Genre Affinity Matrix (JS aggregation for maximum DB compatibility)
        const [allGenres] = await pool.query("SELECT genres FROM library");
        const genreCounts = {};
        allGenres.forEach(row => {
            try {
                const gs = typeof row.genres === 'string' ? JSON.parse(row.genres) : row.genres;
                if (Array.isArray(gs)) {
                    gs.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
                }
            } catch (e) { }
        });
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // 6. Top Rated Sidebar Data
        // Robust formula: Weighted average of available sources. 
        // IMDb(40%), MC(40%), RT(20%). RT is avg of critics and audience.
        const topFormula = `(
            IFNULL(imdb_score, 0) * 0.4 + 
            IFNULL(mc_score, 0) * 0.4 + 
            (CASE 
                WHEN rt_critics > 0 AND rt_audience > 0 THEN (rt_critics + rt_audience) / 2
                WHEN rt_critics > 0 THEN rt_critics
                WHEN rt_audience > 0 THEN rt_audience
                ELSE 0
            END) * 0.2
        )`;

        const [topMovies] = await pool.query(`
            SELECT id, title, year, poster, ROUND(${topFormula}, 0) as score 
            FROM library WHERE type = 'movie' 
            ORDER BY score DESC LIMIT 15
        `);
        const [topSeries] = await pool.query(`
            SELECT id, title, year, poster, ROUND(${topFormula}, 0) as score 
            FROM library WHERE type IN ('series', 'tv') 
            ORDER BY score DESC LIMIT 15
        `);



        res.json({
            total: total || 0,
            movies: movies || 0,
            series: series || 0,
            totalMinutes: totalMinutes || 0,
            statusCounts,
            ratings,
            topGenres: topGenres,
            topMovies,
            topSeries
        });
    } catch (err) {
        console.error('GET /api/stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;

initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});
