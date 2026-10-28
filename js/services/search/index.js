// Fachada das fontes de busca. As telas só conhecem este arquivo.
import { config } from '../../config.js';

export const SOURCES = [
    { id: 'anilist', label: 'AniList (Anime)', load: () => import('./anilist.js') },
    { id: 'mal', label: 'MyAnimeList (MAL)', load: () => import('./jikan.js') },
    { id: 'tmdb', label: 'Séries e Filmes (TMDB)', load: () => import('./tmdb.js') },
];

/** Fontes que têm mangás e light novels (a seção "Ler"). O TMDB só tem séries e filmes. */
export const READ_SOURCES = [
    { id: 'anilist', label: 'AniList (Mangá e Novel)' },
    { id: 'mal', label: 'MyAnimeList (Mangá e Novel)' },
];

/** Fonte usada quando a pessoa ainda não escolheu nenhuma. */
export const DEFAULT_SOURCE = 'anilist';

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

/** Mangás e light novels. Resultados no formato: { title, category, origin, coverImage, description, genres, rating, tags, chaptersTotal, volumesTotal, sourceRef } */
export async function searchReadings(sourceId, query, options) {
    if (!READ_SOURCES.some((s) => s.id === sourceId)) throw new Error('Esta fonte não tem mangás: ' + sourceId);
    return (await providerOf(sourceId)).searchReadings(query, options);
}
