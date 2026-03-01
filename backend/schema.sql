CREATE DATABASE IF NOT EXISTS reeltrack;
USE reeltrack;

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
);

CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    tmdbApiKey TEXT,
    geminiApiKey TEXT,
    showPosters BOOLEAN,
    defaultSort VARCHAR(50),
    bestStreak INT,
    currentStreak INT,
    lastWatchedDate DATE
);
