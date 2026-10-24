// TMDB (séries e filmes). Precisa de uma chave própria em js/config.js.
import { config } from '../../config.js';
import { fetchJson } from '../http.js';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

export const isAvailable = () => Boolean(config.tmdbApiKey);

const url = (path, params = {}) => {
    const qs = new URLSearchParams({ api_key: config.tmdbApiKey, ...params });
    return `${BASE}${path}?${qs}`;
};

export async function searchWorks(query, { limit = 6 } = {}) {
    if (!isAvailable()) throw new Error('TMDB sem chave');
    const json = await fetchJson(url('/search/multi', { query }));
    const items = (json.results || []).filter((i) => i.media_type === 'tv' || i.media_type === 'movie').slice(0, limit);

    return items.map((item) => {
        const isTv = item.media_type === 'tv';
        const category = isTv ? 'Série' : 'Filme';
        const base = {
            title: item.name || item.title || '',
            category,
            coverImage: item.poster_path ? IMG + item.poster_path : '',
            description: item.overview || '',
            genres: [],
            rating: 0,
            airDay: '',
            tags: [category],
            seasons: isTv
                ? [{ name: '1ª Temporada', type: 'TV', totalEps: 12, watched: [] }]
                : [{ name: 'Filme', type: 'Filme', totalEps: 1, watched: [] }],
        };

        // A busca não traz as temporadas; ao escolher uma série, buscamos os detalhes.
        if (isTv) {
            base.loadDetails = async () => {
                try {
                    const d = await fetchJson(url(`/tv/${item.id}`));
                    const genres = (d.genres || []).map((g) => g.name);
                    const seasons = (d.seasons || [])
                        .filter((s) => s.season_number > 0 && s.episode_count > 0)
                        .map((s) => ({ name: s.name || `${s.season_number}ª Temporada`, type: 'TV', totalEps: s.episode_count, watched: [] }));
                    return {
                        ...base,
                        genres,
                        tags: [category, ...genres.slice(0, 3)],
                        seasons: seasons.length ? seasons : base.seasons,
                    };
                } catch {
                    return base;
                }
            };
        }
        return base;
    });
}

// O TMDB não tem busca de "temporada avulsa": o formulário cai no cadastro manual.
export async function searchSeasons() { return []; }
