// MyAnimeList, via API pública Jikan.
import { fetchJson } from '../http.js';
import { dayToPortuguese, firstSeason, starsFrom } from './shared.js';

const BASE = 'https://api.jikan.moe/v4/anime';

export async function searchWorks(query, { limit = 5 } = {}) {
    const json = await fetchJson(`${BASE}?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (json.data || []).map((a) => {
        const genres = (a.genres || []).map((g) => g.name);
        const type = a.type || 'TV';
        return {
            title: a.title_english || a.title || '',
            category: 'Anime',
            coverImage: a.images?.jpg?.large_image_url || '',
            description: a.synopsis || '',
            genres,
            rating: starsFrom(a.score, 10),
            airDay: dayToPortuguese(a.broadcast?.day),
            tags: ['Anime', type, ...genres.slice(0, 3)],
            seasons: [firstSeason(type, a.episodes)],
        };
    });
}

export async function searchSeasons(query) {
    const json = await fetchJson(`${BASE}?q=${encodeURIComponent(query)}&limit=4`);
    return (json.data || []).map((a) => ({ name: a.title_english || a.title || '', eps: a.episodes || 12 }));
}
