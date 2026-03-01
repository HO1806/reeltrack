require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

        // Ensure table exists
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
                notifiedUnrated BOOLEAN
            )
        `);
        console.log('Database and Library table ready');
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
        'dateAdded', 'dateWatched', 'tags', 'isFavorite', 'isPinned', 'notifiedUnrated'
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
            }
            data[col] = val;
        }
    });
    return data;
}

// Routes
app.get('/api/library', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM library ORDER BY dateAdded DESC');
        res.json(rows.map(row => ({
            ...row,
            genres: row.genres || [],
            cast: row.cast || [],
            rating: row.rating || {},
            tags: row.tags || [],
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

app.post('/api/library', async (req, res) => {
    try {
        const data = formatEntryForSQL(req.body);
        await pool.query('INSERT INTO library SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /library error:', err);
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

app.delete('/api/library/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM library WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
initDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
