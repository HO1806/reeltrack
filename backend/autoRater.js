const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const path = require('path');
// Load both the root .env (DB creds) and the backend/.env (OMDB keys, ports)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { isLimitReached, setLimitReached } = require('./limitHelper');

// Configuration
const BATCH_SIZE = 1; // Process one at a time for stability
const INTERVAL_MS = 12 * 60 * 60 * 1000; // Run every 12 hours
const RUN_ONCE = process.argv.includes('--once');
const PYTHON_SCRIPT = 'python';

// Load OMDB API Keys dynamically from .env (comma-separated)
// e.g. OMDB_API_KEYS=key1,key2,key3
let omdbApiKeys = (process.env.OMDB_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

if (omdbApiKeys.length === 0) {
    console.warn('[AutoRater] WARNING: No OMDB_API_KEYS found in .env. Add OMDB_API_KEYS=key1,key2 to backend/.env');
}

let currentKeyIndex = 0;

/**
 * Validate a single OMDB API key by probing a well-known IMDb entry.
 * Returns true if the key works, false if expired or limited.
 */
async function validateApiKey(key) {
    try {
        const res = await fetch(`https://www.omdbapi.com/?i=tt0111161&apikey=${key}`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data.Response === 'True') return true;
        const err = (data.Error || '').toLowerCase();
        if (err.includes('limit') || err.includes('invalid')) return false;
        return false;
    } catch {
        return false;
    }
}

/**
 * Get the next working OMDB API key.
 * Skips keys that are exhausted or invalid.
 * Returns null if no keys are available.
 */
async function getWorkingOMDBKey() {
    const total = omdbApiKeys.length;
    for (let i = 0; i < total; i++) {
        const key = omdbApiKeys[currentKeyIndex % total];
        currentKeyIndex++;
        const ok = await validateApiKey(key);
        if (ok) {
            console.log(`[AutoRater] API key ...${key.slice(-4)} validated OK.`);
            return key;
        }
        console.log(`[AutoRater] API key ...${key.slice(-4)} is exhausted or invalid. Trying next...`);
    }
    return null; // All keys exhausted
}

// Ensure unique execution
let isProcessing = false;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runRaterScript(imdbId, apiKey, entryType) {
    if (!imdbId) return { error: 'No IMDb ID' };

    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, '..', 'Rater.py');
        const args = [scriptPath, imdbId];
        if (apiKey) args.push(apiKey);
        if (entryType) args.push('--type', entryType);

        const pyProg = spawn(PYTHON_SCRIPT, args, { windowsHide: true });
        let output = '';

        pyProg.stdout.on('data', (data) => {
            output += data.toString();
        });

        pyProg.stderr.on('data', (data) => {
            console.error(`[AutoRater stderr for ${imdbId}]:`, data.toString());
        });

        pyProg.on('close', (code) => {
            if (code !== 0) {
                console.error(`[AutoRater error] Process exited with code ${code} for ${imdbId}`);
                return resolve({ error: 'Process failed' });
            }
            try {
                // Rater.py outputs pure JSON on the last line
                const lines = output.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const raterResult = JSON.parse(lastLine);
                resolve(raterResult);
            } catch (err) {
                console.error(`[AutoRater error] Failed to parse output for ${imdbId}:`, output);
                resolve({ error: 'Parse failed' });
            }
        });
    });
}

async function processBatch() {
    if (isProcessing) {
        console.log('[AutoRater] Skipped cycle: Previous batch is still running.');
        return;
    }
    isProcessing = true;

    if (isLimitReached()) {
        console.log('[AutoRater] OMDB API limit was reached today. Pausing all metadata/rating fetches until tomorrow.');
        isProcessing = false;
        if (RUN_ONCE) process.exit(0);
        return;
    }

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'reeltrack'
        });

        console.log(`[AutoRater] Connected to DB. Querying for missing metadata...`);

        // Get TMDB API key from settings
        const [settingsRows] = await connection.query('SELECT tmdbApiKey FROM settings WHERE id = 1');
        const tmdbApiKey = settingsRows.length > 0 ? settingsRows[0].tmdbApiKey : null;

        if (!tmdbApiKey) {
            console.log(`[AutoRater] No TMDB API key found in settings. TMDB metadata fetch will be skipped.`);
        }

        // Find items with missing ratings OR missing crucial metadata
        // Now includes items with NULL or empty imdbId OR empty genres
        const query = `
            SELECT id, imdb_score, mc_score, rt_critics, rt_audience, imdbId, title, year, type, tmdbId, poster, description, director, cast, genres, runtime, vote_average, rating_needs_rescan
            FROM library 
            WHERE 
              (
                (imdb_score IS NULL OR imdb_score = 0 
                 OR mc_score IS NULL OR mc_score = 0 
                 OR rt_critics IS NULL OR rt_critics = 0 
                 OR rt_audience IS NULL OR rt_audience = 0)
                OR rating_needs_rescan = TRUE
              )
              AND imdbId IS NOT NULL AND imdbId != ''
              AND (enriched_at IS NULL OR enriched_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
        `;

        const [entries] = await connection.query(query);


        if (entries.length === 0) {
            console.log(`[AutoRater] Database is fully enriched. Sleeping...`);
        } else {
            console.log(`[AutoRater] Found ${entries.length} items needing enrichment. Processing in chunks of ${BATCH_SIZE}...`);

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const chunk = entries.slice(i, i + BATCH_SIZE);
                console.log(`[AutoRater] Processing chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}...`);

                let stopBatch = false;

                const promises = chunk.map(async (entry) => {
                    try {
                        let currentImdbId = entry.imdbId;
                        let tmdbUpdates = {};

                        // 1. Fetch from TMDB if missing crucial info (including runtime)
                        if (tmdbApiKey && (!entry.tmdbId || !entry.poster || !entry.runtime || (entry.type === 'movie' && !entry.director) || !entry.genres || entry.genres === '[]')) {
                            try {
                                const type = entry.type === 'series' ? 'tv' : 'movie';
                                let targetTmdbId = entry.tmdbId;

                                // A. Find TMDB ID by IMDb ID if we have it
                                if (!targetTmdbId && currentImdbId) {
                                    const findRes = await fetch(`https://api.themoviedb.org/3/find/${currentImdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`);
                                    if (findRes.ok) {
                                        const findData = await findRes.json();
                                        const found = type === 'tv' ? findData.tv_results?.[0] : findData.movie_results?.[0];
                                        if (found) targetTmdbId = found.id;
                                    }
                                }

                                // B. Find TMDB ID by Title search if still missing
                                if (!targetTmdbId) {
                                    const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${tmdbApiKey}&query=${encodeURIComponent(entry.title)}${entry.year ? `&year=${entry.year}` : ''}`;
                                    const searchRes = await fetch(searchUrl);
                                    if (searchRes.ok) {
                                        const searchData = await searchRes.json();
                                        if (searchData.results?.length > 0) {
                                            targetTmdbId = searchData.results[0].id;
                                        }
                                    }
                                }

                                if (targetTmdbId) {
                                    tmdbUpdates.tmdbId = targetTmdbId;
                                    const detailRes = await fetch(`https://api.themoviedb.org/3/${type}/${targetTmdbId}?api_key=${tmdbApiKey}&append_to_response=credits,external_ids`);

                                    if (detailRes.ok) {
                                        const details = await detailRes.json();

                                        if (!entry.poster) tmdbUpdates.poster = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
                                        if (!entry.description) tmdbUpdates.description = details.overview || '';
                                        if (!entry.runtime || entry.runtime === 0) {
                                            tmdbUpdates.runtime = type === 'movie' ? details.runtime : (details.episode_run_time?.[0] || 0);
                                        }

                                        if (!entry.genres || entry.genres === '[]') {
                                            tmdbUpdates.genres = JSON.stringify(details.genres?.map(g => g.name) || []);
                                        }

                                        if (type === 'movie' && !entry.director) {
                                            tmdbUpdates.director = details.credits?.crew?.find(c => c.job === 'Director')?.name || '';
                                        }
                                        if (!entry.cast || entry.cast === '[]') {
                                            tmdbUpdates.cast = JSON.stringify(details.credits?.cast?.slice(0, 5).map(c => c.name) || []);
                                        }

                                        // Store vote_average for IMDb fallback
                                        if (details.vote_average > 0) {
                                            tmdbUpdates.vote_average = details.vote_average;
                                        }

                                        // Try to recover missing IMDb ID
                                        if (!currentImdbId && details.external_ids?.imdb_id) {
                                            currentImdbId = details.external_ids.imdb_id;
                                            tmdbUpdates.imdbId = currentImdbId;
                                        }
                                    }
                                }
                            } catch (tmdbErr) {
                                console.error(`[AutoRater] Error fetching TMDB for ${entry.title}:`, tmdbErr.message);
                            }
                        }

                        // 2. Fetch Ratings via Rater.py if any ratings are missing (NULL or 0)
                        let ratingUpdates = {};
                        let needsRescan = false;
                        const needsRatings = !entry.imdb_score || !entry.mc_score || !entry.rt_critics || !entry.rt_audience || entry.rating_needs_rescan;

                        if (currentImdbId && needsRatings) {
                            // Get a validated, working API key before every entry
                            const apiKey = await getWorkingOMDBKey();
                            if (!apiKey) {
                                console.log(`[AutoRater] !!! All OMDB API keys exhausted. Stopping batch and recording limit...`);
                                setLimitReached();
                                stopBatch = true;
                                return { id: entry.id, success: false, limit: true };
                            }

                            // Pass entry type so Rater.py knows to always scrape MC for series
                            const entryType = entry.type === 'series' ? 'series' : 'movie';
                            const result = await runRaterScript(currentImdbId, apiKey, entryType);

                            if (result) {
                                if (result.imdb_10 === 'LIMIT' || result.error?.includes('LIMIT')) {
                                    console.log(`[AutoRater] !!! OMDB API Limit Reached across all keys. Stopping batch and recording limit...`);
                                    setLimitReached();
                                    stopBatch = true;
                                    return { id: entry.id, success: false, limit: true };
                                }

                                if (!result.error) {
                                    // For rescan entries: if OMDB now has definitive data, ALWAYS overwrite
                                    const isRescan = !!entry.rating_needs_rescan;

                                    if (result.imdb_10 > 0 && (!entry.imdb_score || entry.imdb_score === 0 || isRescan)) {
                                        ratingUpdates.imdb_score = result.imdb_10;
                                    }
                                    if (result.m_val > 0 && (!entry.mc_score || entry.mc_score === 0 || isRescan)) {
                                        ratingUpdates.mc_score = result.m_val;
                                    }
                                    if (result.rc_val > 0 && (!entry.rt_critics || entry.rt_critics === 0 || isRescan)) {
                                        ratingUpdates.rt_critics = result.rc_val;
                                    }
                                    if (result.ra_val > 0 && (!entry.rt_audience || entry.rt_audience === 0 || isRescan)) {
                                        ratingUpdates.rt_audience = result.ra_val;
                                    }

                                    // Track if MC came from a non-definitive source
                                    if (result.mc_source === 'metacritic_user') {
                                        needsRescan = true;
                                    }
                                }
                            }

                            // IMDb fallback: if Rater.py didn't return an IMDb score, use TMDb vote_average * 10
                            const effectiveVoteAvg = tmdbUpdates.vote_average || entry.vote_average;
                            if (!ratingUpdates.imdb_score && (!entry.imdb_score || entry.imdb_score === 0) && effectiveVoteAvg > 0) {
                                ratingUpdates.imdb_score = Math.round(effectiveVoteAvg * 10);
                                needsRescan = true;
                                console.log(`[AutoRater] Using TMDb vote_average (${effectiveVoteAvg}) as IMDb fallback for: ${entry.title}`);
                            }
                        }

                        // Set or clear the rescan flag
                        if (needsRescan) {
                            ratingUpdates.rating_needs_rescan = true;
                        } else if (entry.rating_needs_rescan && Object.keys(ratingUpdates).length > 0) {
                            // Rescan entry got definitive data — clear the flag
                            ratingUpdates.rating_needs_rescan = false;
                        }

                        const updates = { ...tmdbUpdates, ...ratingUpdates };

                        // Always mark as enriched so we don't spam requests for unrateable items
                        updates.enriched_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

                        if (Object.keys(updates).length > 0) {
                            const keys = Object.keys(updates);
                            const values = Object.values(updates);
                            const setString = keys.map(k => `${k} = ?`).join(', ');

                            await connection.query(
                                `UPDATE library SET ${setString} WHERE id = ?`,
                                [...values, entry.id]
                            );
                            console.log(`[AutoRater] ✓ Enriched: ${entry.title}${updates.imdbId ? ` (Recovered IMDb ID: ${updates.imdbId})` : ''}`);
                            return { id: entry.id, success: true };
                        } else {
                            console.log(`[AutoRater] ✗ No new data found for: ${entry.title}`);
                            return { id: entry.id, success: false };
                        }
                    } catch (err) {
                        console.error(`[AutoRater] Error updating ${entry.title}:`, err);
                        return { id: entry.id, success: false };
                    }
                });

                await Promise.all(promises);
                if (stopBatch) break;
                await sleep(500); // 500ms delay between items
            }
            console.log(`[AutoRater] Batch complete.`);
        }

    } catch (dbError) {
        console.error('[AutoRater] Database Error:', dbError);
    } finally {
        if (connection) await connection.end();
        isProcessing = false;

        if (RUN_ONCE) {
            console.log('[AutoRater] Run-once mode complete. Exiting.');
            process.exit(0);
        }
    }
}

// Start loop
console.log(`[AutoRater] Initializing background worker. Cycle interval: ${INTERVAL_MS / 1000}s`);

// Run immediately on boot
processBatch();

if (!RUN_ONCE) {
    setInterval(processBatch, INTERVAL_MS);
}
