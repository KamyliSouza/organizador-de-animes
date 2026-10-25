// Modelo de dados de uma obra (anime, filme ou série) e regras de progresso.
// Nada aqui mexe em tela ou em rede: só dados.
import { safeUrl, toInt } from '../core/dom.js';

export const STATUSES = {
    watching: { label: 'Assistindo', icon: 'play' },
    planned: { label: 'Quero Ver', icon: 'clock' },
    completed: { label: 'Concluído', icon: 'check' },
    dropped: { label: 'Dropado', icon: 'ban' },
};
export const STATUS_KEYS = Object.keys(STATUSES);

export const CATEGORIES = ['Anime', 'Filme', 'Série'];
export const CATEGORY_CLASS = { Anime: 'anime', Filme: 'filme', 'Série': 'serie' };

export const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_LABELS = {
    Segunda: 'Segunda-feira', 'Terça': 'Terça-feira', Quarta: 'Quarta-feira', Quinta: 'Quinta-feira',
    Sexta: 'Sexta-feira', 'Sábado': 'Sábado', Domingo: 'Domingo',
};

export const SEASON_TYPES = ['TV', 'OVA', 'Filme', 'Especial'];
export const MINUTES_PER_EPISODE = 24;
export const MAX_EPISODES = 5000;

const cleanText = (v, max) => String(v ?? '').trim().slice(0, max);

function cleanList(v, maxItems, maxLen) {
    const list = Array.isArray(v) ? v : [];
    const out = [];
    for (const item of list) {
        const t = cleanText(item, maxLen);
        if (t && !out.includes(t)) out.push(t);
        if (out.length >= maxItems) break;
    }
    return out;
}

export const defaultSeason = () => ({ name: '1ª Temporada', type: 'TV', totalEps: 12, watched: [] });

export function normalizeSeason(s, index = 0) {
    const totalEps = toInt(s?.totalEps, 1, MAX_EPISODES, 12);
    const watched = Array.isArray(s?.watched)
        ? [...new Set(s.watched.map((n) => toInt(n, 0, MAX_EPISODES, 0)).filter((n) => n >= 1 && n <= totalEps))].sort((a, b) => a - b)
        : [];
    return {
        name: cleanText(s?.name, 80) || `${index + 1}ª Temporada`,
        type: SEASON_TYPES.includes(s?.type) ? s.type : 'TV',
        totalEps,
        watched,
    };
}

/** Aceita dados "sujos" (backup antigo, API, banco) e devolve uma obra válida. */
export function normalizeEntry(e) {
    const seasons = Array.isArray(e?.seasons) ? e.seasons.slice(0, 100).map(normalizeSeason) : [];
    return {
        id: e?.id != null ? String(e.id) : '',
        title: cleanText(e?.title, 200),
        category: CATEGORIES.includes(e?.category) ? e.category : 'Anime',
        status: STATUS_KEYS.includes(e?.status) ? e.status : 'planned',
        rating: toInt(e?.rating, 0, 5, 0),
        tags: cleanList(e?.tags, 20, 30),
        airDay: DAYS.includes(e?.airDay) ? e.airDay : '',
        notes: cleanText(e?.notes, 5000),
        coverImage: safeUrl(e?.coverImage),
        description: cleanText(e?.description, 10000),
        genres: cleanList(e?.genres, 20, 40),
        seasons: seasons.length ? seasons : [defaultSeason()],
        createdAt: typeof e?.createdAt === 'string' ? e.createdAt : '',
    };
}

export function emptyEntry() {
    return {
        id: '', title: '', category: 'Anime', status: 'watching', rating: 0, tags: [], airDay: '',
        notes: '', coverImage: '', description: '', genres: [], seasons: [defaultSeason()], createdAt: '',
    };
}

export const cloneEntry = (e) => JSON.parse(JSON.stringify(e));

// --- progresso ---------------------------------------------------------

export function progressOf(entry) {
    let total = 0;
    let watched = 0;
    for (const s of entry.seasons) { total += s.totalEps; watched += s.watched.length; }
    const exact = total > 0 ? (watched / total) * 100 : 0;
    return { total, watched, pct: Math.min(100, Math.round(exact)), exact };
}

/**
 * Ajusta o status geral conforme os episódios vistos (mesma regra do tracker original).
 * Uma obra "Dropado" volta a "Assistindo" (ou "Concluído") quando você marca um episódio,
 * mas não muda só porque o total de episódios foi editado (revive: false).
 */
export function syncStatus(entry, { revive = true } = {}) {
    if (!revive && entry.status === 'dropped') return entry;
    const { total, watched } = progressOf(entry);
    if (total > 0 && watched >= total) entry.status = 'completed';
    else if (watched > 0) entry.status = 'watching';
    return entry;
}

/** Marca o próximo episódio não visto (+1 Ep). Retorna true se mudou algo. */
export function addNextEpisode(entry) {
    const season = entry.seasons.find((s) => s.watched.length < s.totalEps) ?? entry.seasons[entry.seasons.length - 1];
    if (!season) return false;
    for (let n = 1; n <= season.totalEps; n++) {
        if (!season.watched.includes(n)) {
            season.watched.push(n);
            season.watched.sort((a, b) => a - b);
            syncStatus(entry);
            return true;
        }
    }
    return false;
}

export function toggleEpisode(entry, seasonIndex, n) {
    const season = entry.seasons[seasonIndex];
    if (!season) return;
    const i = season.watched.indexOf(n);
    if (i > -1) season.watched.splice(i, 1);
    else { season.watched.push(n); season.watched.sort((a, b) => a - b); }
    syncStatus(entry);
}

export function setSeasonWatched(entry, seasonIndex, all) {
    const season = entry.seasons[seasonIndex];
    if (!season) return;
    season.watched = all ? Array.from({ length: season.totalEps }, (_, i) => i + 1) : [];
    syncStatus(entry);
}

export function setSeasonTotal(entry, seasonIndex, total) {
    const season = entry.seasons[seasonIndex];
    if (!season) return;
    season.totalEps = toInt(total, 1, MAX_EPISODES, 1);
    season.watched = season.watched.filter((n) => n <= season.totalEps);
    syncStatus(entry, { revive: false });
}

export function seasonState(season) {
    if (season.totalEps > 0 && season.watched.length >= season.totalEps) return 'done';
    return season.watched.length > 0 ? 'partial' : 'none';
}

// --- listas ------------------------------------------------------------

const createdMs = (e) => (e.createdAt ? Date.parse(e.createdAt) || 0 : Number(e.id) || 0);

export function filterEntries(entries, { status = 'all', category = 'all', query = '' } = {}) {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
        if (status !== 'all' && e.status !== status) return false;
        if (category !== 'all' && e.category !== category) return false;
        if (!q) return true;
        return e.title.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q));
    });
}

export function sortEntries(entries, order = 'recent') {
    const list = [...entries];
    list.sort((a, b) => {
        if (order === 'title') return a.title.localeCompare(b.title, 'pt-BR');
        if (order === 'rating') return b.rating - a.rating;
        if (order === 'progress') return progressOf(b).exact - progressOf(a).exact;
        return createdMs(b) - createdMs(a);
    });
    return list;
}
