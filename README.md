# ReelTrack

A powerful and elegant tracking application for movie and series enthusiasts. Organize your collection, track your progress, rate everything with a proprietary scoring system, and discover new favorites — all in a cinematic dark-mode interface.

## Features

- **Library Management**: Add, edit, and categorize your favorite movies and TV shows.
- **Smart Tracking**: Keep track of watched episodes and seasons for series.
- **Ultimate Score™**: Proprietary scoring system that aggregates IMDb, Metacritic, and Rotten Tomatoes ratings into a single composite metric.
- **Auto Rater**: Background worker that automatically fetches and enriches missing ratings from multiple sources using rotating OMDB API keys.
- **Manual Rating Modal**: Fill in missing scores manually for items the Auto Rater can't reach.
- **Stats Dashboard**: Visualize your watching habits, streaks, score distributions, and genre breakdowns.
- **Stremio Integration**: Browser userscript for syncing watched status directly from Stremio.
- **Discovery**: Search for titles using TMDB integration, get similar recommendations, and use the Surprise Me feature.
- **Premium UI**: Cinematic dark-mode interface with glassmorphism, gold accent lighting, and smooth Framer Motion animations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4 |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Database | MySQL (via XAMPP) |
| Rating Engine | Python (Rater.py) |
| APIs | TMDB, OMDB (multi-key rotation) |

## Project Structure

```
reeltrack/
├── src/                    # React frontend source
│   ├── components/         # UI components (Navbar, FilterBar, LibraryGrid, etc.)
│   ├── services/           # API client & TMDB service
│   └── index.css           # Design system & theme tokens
├── backend/
│   ├── server.js           # Express API server
│   ├── autoRater.js        # Background rating enrichment worker
│   ├── limitHelper.js      # OMDB API key rate-limit tracker
│   └── schema.sql          # MySQL database schema
├── Rater.py                # Python scoring engine (IMDb/MC/RT scraper)
├── DESIGN.md               # UI/UX design system & theme reference
├── CLAUDE.md               # AI agent rules & project context
├── start.bat               # One-click startup script
└── stremio-reeltrack-sync.user.js  # Stremio browser userscript
```

## Setup & Running

1. **Prerequisites**: Node.js, Python 3, XAMPP (MySQL + Apache).

2. **Install dependencies**:

   ```bash
   npm install
   cd backend && npm install
   ```

3. **Environment**: Create `.env` files with your API keys:
   - Root `.env`: Database credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
   - `backend/.env`: `OMDB_API_KEYS=key1,key2,...` and `PORT=3001`

4. **Database**: Import `backend/schema.sql` into MySQL via phpMyAdmin or CLI.

5. **Development**:

   ```bash
   npm run dev          # Vite dev server (port 3000)
   cd backend && node server.js   # API server (port 3001)
   ```

6. **Quick Start**: Run `start.bat` to launch everything at once.

## Deployment (XAMPP)

This project is pre-configured for **XAMPP (Apache)**.

1. Build the project: `npm run deploy`
2. Accessible at: `http://localhost/reeltrack/`

## Design System

The full design system — colors, typography, animations, and component classes — is documented in [`DESIGN.md`](DESIGN.md). Any UI changes must follow these guidelines.
