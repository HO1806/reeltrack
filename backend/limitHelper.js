const fs = require('fs');
const path = require('path');

const limitFile = path.join(__dirname, 'omdb_limit.json');

function isLimitReached() {
    if (!fs.existsSync(limitFile)) return false;
    try {
        const data = JSON.parse(fs.readFileSync(limitFile, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        return data.date === today;
    } catch (e) {
        return false;
    }
}

function setLimitReached() {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(limitFile, JSON.stringify({ date: today }));
    console.log(`[LimitHelper] OMDB API Limit recorded for ${today}. All metadata fetching is paused.`);
}

module.exports = { isLimitReached, setLimitReached };
