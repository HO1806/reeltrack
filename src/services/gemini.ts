import { GoogleGenAI } from "@google/genai";
import { LibraryEntry, Suggestion } from '../types';

export async function getAISuggestions(library: LibraryEntry[], apiKey: string): Promise<Suggestion[]> {
  const highlyRated = library
    .filter(e => e.rating.overall && e.rating.overall >= 7)
    .sort((a, b) => (b.rating.overall || 0) - (a.rating.overall || 0))
    .slice(0, 10)
    .map(e => `${e.title} (${e.year}) — ${e.genres.join(', ')} — rated ${e.rating.overall}/10`)
    .join('\n');

  const disliked = library
    .filter(e => e.rating.overall && e.rating.overall <= 5)
    .sort((a, b) => (a.rating.overall || 0) - (b.rating.overall || 0))
    .slice(0, 5)
    .map(e => `${e.title} (${e.year}) — ${e.genres.join(', ')} — rated ${e.rating.overall}/10`)
    .join('\n');

  const favorites = library
    .filter(e => e.isFavorite)
    .map(e => `${e.title} (${e.year}) — ${e.type}`)
    .join('\n');

  const prompt = `You are a personal movie and series recommendation engine with excellent taste.
  
The user has the following taste profile:

FAVORITES (absolute favorites):
${favorites || 'None yet'}

HIGHLY RATED (loved these):
${highlyRated || 'None yet'}

DISLIKED (low ratings):
${disliked || 'None yet'}

ALREADY IN LIBRARY (DO NOT RECOMMEND THESE):
${library.map(e => `${e.title} (${e.year})`).join('\n') || 'None yet'}

Your task: Suggest exactly 10 NEW movies or series this user would love based on their favorites and high ratings.
Never suggest titles already in their library (watched or unwatched).
For each, write one sentence explaining WHY based on their specific taste.

Respond ONLY with a valid JSON array, no markdown, no explanation, just the array:
[
  {
    "title": "...",
    "year": 2019,
    "type": "movie or series",
    "reason": "Because you loved X and Y which share similar themes...",
    "imdb_id": "tt... if you know it confidently, else null",
    "poster": "URL to the poster image if you can find one, else null"
  }
]`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  const text = response.text;
  if (!text) throw new Error('No suggestions returned');
  
  try {
    // Clean up markdown if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Invalid JSON returned from AI');
  }
}
