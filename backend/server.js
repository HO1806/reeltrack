require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

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
                imdb_10 FLOAT,
                m_val FLOAT,
                rc_val FLOAT,
                ra_val FLOAT,
                ultimate_score FLOAT,
                UNIQUE KEY unique_imdb (imdbId),
                UNIQUE KEY unique_title_year_type (title, year, type)
            )
        `);

        // Run migrations to add columns and indices that may not exist
        const migrations = [
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS tmdbPopularity FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS vote_average FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS imdb_10 FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS m_val FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS rc_val FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS ra_val FLOAT',
            'ALTER TABLE library ADD COLUMN IF NOT EXISTS ultimate_score FLOAT',
            'ALTER TABLE library ADD UNIQUE INDEX unique_imdb (imdbId)',
            'ALTER TABLE library ADD UNIQUE INDEX unique_title_year_type (title, year, type)'
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
                ultimate_score FLOAT,
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
        'imdb_10', 'm_val', 'rc_val', 'ra_val', 'ultimate_score'
    ];

    const data = {};
    columns.forEach(col => {
        if (entry[col] !== undefined) {
            let val = entry[col];
            if (['genres', 'cast', 'rating', 'tags'].includes(col)) {
                val = JSON.stringify(val);
            } else if (['isFavorite', 'isPinned', 'notifiedUnrated'].includes(col)) {
                val = !!val;
            } else if (col === 'dateAdded' || col === 'dateWatched') {
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
        const entries = req.body.entries;
        if (!Array.isArray(entries)) return res.status(400).json({ error: 'Expected an array of entries' });
        if (entries.length === 0) return res.json({ success: true });

        // Process in chunks of 100 to avoid "too many placeholders" error in MySQL
        const chunkSize = 100;
        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);
            const formattedData = chunk.map(formatEntryForSQL);
            const keys = Object.keys(formattedData[0]);

            const insertValues = formattedData.map(obj => keys.map(k => obj[k]));
            const placeholders = formattedData.map(() => `(${keys.map(() => '?').join(',')})`).join(',');

            const updatePattern = keys.map(k => `${k}=VALUES(${k})`).join(',');

            const query = `
                INSERT INTO library (${keys.join(',')}) 
                VALUES ${placeholders} 
                ON DUPLICATE KEY UPDATE ${updatePattern}
            `;

            await pool.query(query, insertValues.flat());
        }

        res.json({ success: true });
    } catch (err) {
        console.error('POST /library/sync error:', err);
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

const { spawn } = require('child_process');
const path = require('path');

// Shared helper: run Rater.py for a single IMDb ID and return parsed result
async function runRaterScript(imdbId) {
    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, '..', 'Rater.py');

    return new Promise((resolve) => {
        const proc = spawn(pythonPath, [scriptPath, imdbId]);
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
        const { id, imdbId } = req.body;
        if (!id || !imdbId) return res.status(400).json({ error: 'id and imdbId are required' });

        const result = await runRaterScript(imdbId);

        if (!result.error) {
            // If entry exists in DB, update it. If not (newly added entry not yet synced), just return the score.
            try {
                await pool.query(
                    'UPDATE library SET imdb_10 = ?, m_val = ?, rc_val = ?, ra_val = ?, ultimate_score = ? WHERE id = ?',
                    [result.imdb_10, result.m_val, result.rc_val, result.ra_val, result.ultimate_score, id]
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
        const raterResult = await runRaterScript(imdbId);
        if (!raterResult.error) {
            entryData.imdb_10 = raterResult.imdb_10;
            entryData.m_val = raterResult.m_val;
            entryData.rc_val = raterResult.rc_val;
            entryData.ra_val = raterResult.ra_val;
            entryData.ultimate_score = raterResult.ultimate_score;
        }

        res.json({ success: true, entry: entryData });
    } catch (err) {
        console.error('fetch-from-imdb error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rate/batch', async (req, res) => {
    try {
        const [entries] = await pool.query('SELECT id, imdbId, title FROM library WHERE imdbId IS NOT NULL AND imdbId != "" LIMIT 50');

        const results = [];
        for (const entry of entries) {
            const raterResult = await runRaterScript(entry.imdbId);
            if (!raterResult.error) {
                await pool.query(
                    'UPDATE library SET imdb_10 = ?, m_val = ?, rc_val = ?, ra_val = ?, ultimate_score = ? WHERE id = ?',
                    [raterResult.imdb_10, raterResult.m_val, raterResult.rc_val, raterResult.ra_val, raterResult.ultimate_score, entry.id]
                );
                results.push({ id: entry.id, title: entry.title, success: true, ultimate_score: raterResult.ultimate_score });
            } else {
                results.push({ id: entry.id, title: entry.title, success: false, error: raterResult.error });
            }
        }

        res.json({ processed: results.length, results });
    } catch (err) {
        console.error('Batch rate error:', err);
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
                    enrichedItem.ultimate_score = cached[0].ultimate_score;
                    enrichedItem.poster = cached[0].poster || enrichedItem.poster;
                    enrichedItems.push(enrichedItem);
                    continue; // Skip the heavy rating
                }
            }

            // 3. Call Rater.py if not cached and has valid IMDb ID
            if (enrichedItem.imdb_id) {
                const raterResult = await runRaterScript(enrichedItem.imdb_id);
                if (!raterResult.error && raterResult.ultimate_score != null) {
                    enrichedItem.ultimate_score = raterResult.ultimate_score;
                    // Save to cache
                    const cacheData = {
                        imdbId: enrichedItem.imdb_id,
                        tmdbId: tmdbData?.id || null,
                        type: item.type,
                        title: item.title,
                        year: item.year,
                        poster: enrichedItem.poster,
                        ultimate_score: raterResult.ultimate_score
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

const PORT = process.env.PORT || 5000;
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});
