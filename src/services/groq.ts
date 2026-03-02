import { LibraryEntry, Suggestion } from '../types';

export async function getAISuggestions(library: LibraryEntry[], apiKey: string, type: 'movie' | 'series'): Promise<Suggestion[]> {
    const highlyRated = library
        .filter(e => e.rating.overall && e.rating.overall >= 7 && e.type === type)
        .sort((a, b) => (b.rating.overall || 0) - (a.rating.overall || 0))
        .slice(0, 10)
        .map(e => `${e.title} (${e.year}) — ${e.genres.join(', ')} — rated ${e.rating.overall}/10`)
        .join('\n');

    const disliked = library
        .filter(e => e.rating.overall && e.rating.overall <= 5 && e.type === type)
        .sort((a, b) => (a.rating.overall || 0) - (b.rating.overall || 0))
        .slice(0, 5)
        .map(e => `${e.title} (${e.year}) — ${e.genres.join(', ')} — rated ${e.rating.overall}/10`)
        .join('\n');

    const favorites = library
        .filter(e => e.isFavorite && e.type === type)
        .map(e => `${e.title} (${e.year}) — ${e.type}`)
        .join('\n');

    const prompt = `You are a personal ${type === 'movie' ? 'movie' : 'series (TV show)'} recommendation engine with excellent taste.
  
The user has the following taste profile FOR ${type === 'movie' ? 'MOVIES' : 'SERIES'}:

FAVORITES (absolute favorites):
${favorites || 'None yet'}

HIGHLY RATED (loved these):
${highlyRated || 'None yet'}

DISLIKED (low ratings):
${disliked || 'None yet'}

ALREADY IN LIBRARY (DO NOT RECOMMEND THESE):
${library.map(e => `${e.title} (${e.year})`).join('\n') || 'None yet'}

Your task: Suggest exactly 10 NEW ${type === 'movie' ? 'movies' : 'series'} this user would love based on their favorites and high ratings.
Never suggest titles already in their library (watched or unwatched). The user has explicitly listed everything they have in the "ALREADY IN LIBRARY" section. Ensure zero overlaps.
For each, write one sentence explaining WHY based on their specific taste.

Respond ONLY with a valid JSON array, no markdown, no explanation, just the array:
[
  {
    "title": "...",
    "year": 2019,
    "type": "${type}",
    "reason": "Because you loved X and Y which share similar themes...",
    "imdb_id": "tt... if you know it confidently, else null",
    "poster": "URL to the poster image if you can find one, else null"
  }
]`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq API error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) throw new Error('No suggestions returned');

    try {
        // The response could be wrapped in an object like { "suggestions": [...] } or just an array.
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Handle case where format differs slightly
        if (Array.isArray(parsed)) {
            return parsed;
        } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            return parsed.suggestions;
        } else {
            // Find the first array value among object keys
            const possibleArray = Object.values(parsed).find(v => Array.isArray(v));
            if (possibleArray) return possibleArray as Suggestion[];
            throw new Error('Could not find an array in the response structure.');
        }
    } catch (e) {
        console.error('Failed to parse Groq response:', text);
        throw new Error('Invalid JSON returned from AI');
    }
}
