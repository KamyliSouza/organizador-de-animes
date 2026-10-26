// MyAnimeList, via API pública Jikan (https://jikan.moe).
// O Jikan é gratuito e limita a ~3 pedidos por segundo (e ~60 por minuto); quando o MAL está
// lento ele também responde 5xx. Por isso aqui os pedidos saem espaçados, repetem sozinhos em
// falhas passageiras e respostas iguais ficam guardadas por alguns minutos.
import { fetchJson } from '../http.js';
import { dayToPortuguese, firstSeason, seasonTypeOf, starsFrom } from './shared.js';

const BASE = 'https://api.jikan.moe/v4/anime';
const GAP_MS = 400;          // intervalo mínimo entre pedidos (limite do Jikan: 3/s)
const CACHE_MS = 5 * 60 * 1000;
const MAX_CACHE = 60;
const MAX_SEQUELS = 6;       // quantas sequências seguir ao escolher uma obra
const SKIP_TYPES = new Set(['music', 'cm', 'pv']);   // clipes/comerciais não são temporadas

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map();     // url -> { at, promise }
let nextSlot = 0;

async function waitForSlot() {
    const slot = Math.max(Date.now(), nextSlot);
    nextSlot = slot + GAP_MS;
    const wait = slot - Date.now();
    if (wait > 0) await sleep(wait);
}

function get(path) {
    const url = BASE + path;
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;

    const promise = fetchJson(url, { timeout: 20000, retries: 2, retryDelay: 1200, gate: waitForSlot });
    cache.set(url, { at: Date.now(), promise });
    promise.catch(() => cache.delete(url));          // falhas não ficam guardadas
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return promise;
}

const titleOf = (a) => a?.title_english || a?.title || '';

/** Uma sequência do MAL -> temporada do app. `index` é a posição (2 = 2ª). */
function seasonFrom(a, index) {
    const type = seasonTypeOf(a.type);
    return {
        name: type === 'TV' ? `${index}ª Temporada` : titleOf(a),
        type,
        totalEps: a.episodes || (type === 'Filme' ? 1 : 12),
        watched: [],
    };
}

/** Segue "Sequência" -> "Sequência"... e devolve as temporadas seguintes. Falhas só encurtam a lista. */
async function loadSequels(malId) {
    const seasons = [];
    const seen = new Set([malId]);
    let current = malId;
    try {
        for (let i = 0; i < MAX_SEQUELS; i++) {
            const rel = await get(`/${current}/relations`);
            const group = (rel.data || []).find((r) => String(r.relation).toLowerCase() === 'sequel');
            const next = (group?.entry || []).find((e) => e.type === 'anime' && !seen.has(e.mal_id));
            if (!next) break;
            seen.add(next.mal_id);
            const detail = (await get(`/${next.mal_id}`)).data;
            if (!detail) break;
            if (!SKIP_TYPES.has(String(detail.type || '').toLowerCase())) seasons.push(seasonFrom(detail, seasons.length + 2));
            current = next.mal_id;
        }
    } catch (err) {
        console.warn('MAL: não consegui carregar todas as sequências', err);
    }
    return seasons;
}

export async function searchWorks(query, { limit = 5 } = {}) {
    const json = await get(`?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (json.data || []).map((a) => {
        const genres = (a.genres || []).map((g) => g.name);
        const type = a.type || 'TV';
        const result = {
            sourceRef: a.mal_id ? `mal:${a.mal_id}` : '',
            title: titleOf(a),
            category: 'Anime',
            coverImage: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '',
            description: a.synopsis || '',
            genres,
            rating: starsFrom(a.score, 10),
            airDay: dayToPortuguese(a.broadcast?.day),
            tags: ['Anime', type, ...genres.slice(0, 3)],
            seasons: [firstSeason(type, a.episodes)],
        };

        // A busca só traz a obra; as sequências (2ª temporada, filmes...) vêm ao escolhê-la.
        if (a.mal_id && seasonTypeOf(type) === 'TV') {
            result.loadDetails = async () => {
                const sequels = await loadSequels(a.mal_id);
                return sequels.length ? { ...result, seasons: [...result.seasons, ...sequels] } : result;
            };
        }
        return result;
    });
}

export async function searchSeasons(query) {
    const json = await get(`?q=${encodeURIComponent(query)}&limit=4`);
    return (json.data || []).map((a) => ({ name: titleOf(a), eps: a.episodes || 12 }));
}
