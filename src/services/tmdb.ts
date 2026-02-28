const BASE_URL = 'https://api.themoviedb.org/3';

export async function searchTMDB(query: string, apiKey: string) {
  const response = await fetch(`${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('TMDB Search failed');
  const data = await response.json();
  return data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
}

export async function getDetails(id: number, type: 'movie' | 'tv', apiKey: string) {
  const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${apiKey}`);
  if (!response.ok) throw new Error('TMDB Details failed');
  return response.json();
}

export async function getExternalIds(id: number, type: 'movie' | 'tv', apiKey: string) {
  const response = await fetch(`${BASE_URL}/${type}/${id}/external_ids?api_key=${apiKey}`);
  if (!response.ok) throw new Error('TMDB External IDs failed');
  return response.json();
}

export async function getCredits(id: number, type: 'movie' | 'tv', apiKey: string) {
  const response = await fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${apiKey}`);
  if (!response.ok) throw new Error('TMDB Credits failed');
  return response.json();
}

export async function getSimilar(id: number, type: 'movie' | 'tv', apiKey: string) {
  const response = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${apiKey}`);
  if (!response.ok) throw new Error('TMDB Similar failed');
  const data = await response.json();
  return data.results.map((item: any) => ({
    id: item.id,
    title: item.title || item.name,
    year: new Date(item.release_date || item.first_air_date).getFullYear(),
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
    type: type === 'movie' ? 'movie' : 'series',
    overview: item.overview,
    rating: item.vote_average
  }));
}

export async function getRecommendations(id: number, type: 'movie' | 'tv', apiKey: string) {
  const response = await fetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${apiKey}`);
  if (!response.ok) throw new Error('TMDB Recommendations failed');
  const data = await response.json();
  return data.results.map((item: any) => ({
    id: item.id,
    title: item.title || item.name,
    year: new Date(item.release_date || item.first_air_date).getFullYear(),
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '',
    type: type === 'movie' ? 'movie' : 'series',
    overview: item.overview,
    rating: item.vote_average
  }));
}

export async function getExtendedCredits(id: number, type: 'movie' | 'tv', apiKey: string) {
  const credits = await getCredits(id, type, apiKey);
  
  const director = type === 'movie'
    ? credits.crew.find((c: any) => c.job === 'Director')
    : credits.crew.find((c: any) => c.job === 'Executive Producer') || credits.crew[0]; // Fallback for TV

  const cast = credits.cast.slice(0, 10).map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
  }));

  return {
    director: director ? {
      name: director.name,
      profile: director.profile_path ? `https://image.tmdb.org/t/p/w185${director.profile_path}` : null
    } : null,
    cast
  };
}

export async function getTMDBMetadata(tmdbId: number, type: 'movie' | 'tv', apiKey: string) {
  const [details, externalIds, credits] = await Promise.all([
    getDetails(tmdbId, type, apiKey),
    getExternalIds(tmdbId, type, apiKey),
    getCredits(tmdbId, type, apiKey)
  ]);

  const director = type === 'movie' 
    ? credits.crew.find((c: any) => c.job === 'Director')?.name || ''
    : details.created_by?.[0]?.name || '';

  const cast = credits.cast.slice(0, 5).map((c: any) => c.name);
  const imdbId = externalIds.imdb_id;

  return {
    title: details.title || details.name,
    year: new Date(details.release_date || details.first_air_date).getFullYear(),
    genres: details.genres.map((g: any) => g.name),
    poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '',
    description: details.overview,
    director,
    cast,
    runtime: details.runtime || (details.episode_run_time?.[0] || 0),
    seasons: details.number_of_seasons || 0,
    tmdbId,
    imdbId,
    vote_average: details.vote_average,
    streamingUrl: imdbId ? `stremio:///detail/${type === 'movie' ? 'movie' : 'series'}/${imdbId}` : ''
  };
}
