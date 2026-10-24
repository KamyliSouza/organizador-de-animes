// Fachada das fontes de busca. As telas só conhecem este arquivo.
import { config } from '../../config.js';

export const SOURCES = [
    { id: 'mal', label: 'MyAnimeList (MAL)', load: () => import('./jikan.js') },
    { id: 'anilist', label: 'AniList (Anime)', load: () => import('./anilist.js') },
    { id: 'tmdb', label: 'Séries e Filmes (TMDB)', load: () => import('./tmdb.js') },
];

export function sourceAvailable(id) {
    if (id === 'tmdb') return Boolean(config.tmdbApiKey);
    return SOURCES.some((s) => s.id === id);
}

const providerOf = (id) => {
    const src = SOURCES.find((s) => s.id === id);
    if (!src) throw new Error('Fonte desconhecida: ' + id);
    return src.load();
};

/** Resultados no formato: { title, category, coverImage, description, genres, rating, airDay, tags, seasons, loadDetails? } */
export async function searchWorks(sourceId, query, options) {
    return (await providerOf(sourceId)).searchWorks(query, options);
}

/** Resultados no formato: { name, eps } */
export async function searchSeasons(sourceId, query) {
    return (await providerOf(sourceId)).searchSeasons(query);
}
