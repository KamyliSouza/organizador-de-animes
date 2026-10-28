// Modelo de dados de uma obra (anime, filme, série, mangá ou light novel) e regras de progresso.
// Nada aqui mexe em tela ou em rede: só dados.
import { safeUrl, toInt } from '../core/dom.js';

export const STATUSES = {
    watching: { label: 'Assistindo', icon: 'play' },
    planned: { label: 'Quero ver', icon: 'clock' },
    completed: { label: 'Concluído', icon: 'check' },
    on_hold: { label: 'Em espera', icon: 'pause' },
    dropped: { label: 'Dropado', icon: 'ban' },
};
export const STATUS_KEYS = Object.keys(STATUSES);
/** Na seção "Ler" (mangás e light novels) dois status mudam de nome; as chaves no banco são as mesmas. */
const READ_STATUS_LABELS = { watching: 'Lendo', planned: 'Quero ler' };
/** Status "pausados": marcar um episódio tira a obra deles (volta para Assistindo/Concluído). */
const PAUSED = new Set(['on_hold', 'dropped']);

/** Quantas obras a pessoa pode fixar como favoritas no perfil. */
export const MAX_FAVORITES = 8;
/** Tamanho máximo da análise (o texto que a pessoa escreve sobre a obra e que aparece no feed). */
export const MAX_REVIEW = 2000;

// A biblioteca tem duas seções: "Assistir" (anime, filme, série) e "Ler" (mangá, light novel).
export const WATCH_CATEGORIES = ['Anime', 'Filme', 'Série'];
export const READ_CATEGORIES = ['Mangá', 'Light novel'];
export const CATEGORIES = [...WATCH_CATEGORIES, ...READ_CATEGORIES];
export const CATEGORY_CLASS = { Anime: 'anime', Filme: 'filme', 'Série': 'serie', 'Mangá': 'manga', 'Light novel': 'novel' };
export const SECTIONS = {
    watch: { label: 'Assistir', categories: WATCH_CATEGORIES },
    read: { label: 'Ler', categories: READ_CATEGORIES },
};
export const SECTION_KEYS = Object.keys(SECTIONS);
export const sectionOfCategory = (category) => (READ_CATEGORIES.includes(category) ? 'read' : 'watch');
export const sectionOf = (entry) => sectionOfCategory(entry?.category);
export const isReading = (entry) => sectionOf(entry) === 'read';

/** Nome do status na seção ("Assistindo" ou "Lendo"...). */
export const statusLabel = (status, section = 'watch') => (section === 'read' && READ_STATUS_LABELS[status]) || STATUSES[status]?.label || '';
/** Status da seção como lista [chave, { label, icon }], na ordem de sempre. */
export const statusesOf = (section = 'watch') => Object.entries(STATUSES).map(([k, st]) => [k, { ...st, label: statusLabel(k, section) }]);

/** Países de origem aceitos no selo (mangá coreano = manhwa, chinês = manhua). */
const ORIGIN_RX = /^[A-Z]{2}$/;
/** Selo de origem: só aparece para obras que não são do Japão. */
export function originLabel(entry) {
    const o = entry?.origin;
    if (!o || o === 'JP') return '';
    const comic = entry.category === 'Mangá';
    if (o === 'KR') return comic ? 'Manhwa' : 'Coreia';
    if (o === 'CN' || o === 'TW') return comic ? 'Manhua' : (o === 'CN' ? 'China' : 'Taiwan');
    return o;
}

export const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_LABELS = {
    Segunda: 'Segunda-feira', 'Terça': 'Terça-feira', Quarta: 'Quarta-feira', Quinta: 'Quinta-feira',
    Sexta: 'Sexta-feira', 'Sábado': 'Sábado', Domingo: 'Domingo',
};

export const SEASON_TYPES = ['TV', 'OVA', 'Filme', 'Especial'];
export const MINUTES_PER_EPISODE = 24;
export const MAX_EPISODES = 5000;
export const MAX_CHAPTERS = 99999;
export const MAX_VOLUMES = 9999;

const cleanText = (v, max) => String(v ?? '').trim().slice(0, max);

/** Código da obra na fonte de busca, ex.: "mal:52991", "anilist:154587", "tmdb:tv-1399", "malmanga:2" (mangá/novel têm prefixo próprio porque o MAL repete os números). */
const REF_RX = /^[a-z]{2,10}:[a-z0-9_-]{1,30}$/;
const cleanRef = (v) => { const r = String(v ?? '').trim().toLowerCase(); return REF_RX.test(r) ? r : ''; };

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
    const category = CATEGORIES.includes(e?.category) ? e.category : 'Anime';
    const reading = READ_CATEGORIES.includes(category);
    const seasons = !reading && Array.isArray(e?.seasons) ? e.seasons.slice(0, 100).map(normalizeSeason) : [];
    // mangá/novel: o progresso são contadores. Com total conhecido, o lido nunca passa dele.
    const chaptersTotal = reading ? toInt(e?.chaptersTotal, 0, MAX_CHAPTERS, 0) : 0;
    const volumesTotal = reading ? toInt(e?.volumesTotal, 0, MAX_VOLUMES, 0) : 0;
    const chaptersRead = reading ? toInt(e?.chaptersRead, 0, chaptersTotal || MAX_CHAPTERS, 0) : 0;
    const volumesRead = reading ? toInt(e?.volumesRead, 0, volumesTotal || MAX_VOLUMES, 0) : 0;
    return {
        id: e?.id != null ? String(e.id) : '',
        title: cleanText(e?.title, 200),
        category,
        status: STATUS_KEYS.includes(e?.status) ? e.status : 'planned',
        rating: toInt(e?.rating, 0, 5, 0),
        tags: cleanList(e?.tags, 20, 30),
        airDay: DAYS.includes(e?.airDay) ? e.airDay : '',
        notes: cleanText(e?.notes, 5000),
        coverImage: safeUrl(e?.coverImage),
        description: cleanText(e?.description, 10000),
        genres: cleanList(e?.genres, 20, 40),
        seasons: reading ? [] : (seasons.length ? seasons : [defaultSeason()]),
        chaptersRead, chaptersTotal, volumesRead, volumesTotal,
        origin: reading && ORIGIN_RX.test(String(e?.origin ?? '')) ? String(e.origin) : '',
        favorite: e?.favorite === true,
        sourceRef: cleanRef(e?.sourceRef),
        review: cleanText(e?.review, MAX_REVIEW),
        reviewSpoiler: e?.reviewSpoiler === true,
        createdAt: typeof e?.createdAt === 'string' ? e.createdAt : '',
    };
}

export function emptyEntry() {
    return {
        id: '', title: '', category: 'Anime', status: 'watching', rating: 0, tags: [], airDay: '',
        notes: '', coverImage: '', description: '', genres: [], seasons: [defaultSeason()],
        chaptersRead: 0, chaptersTotal: 0, volumesRead: 0, volumesTotal: 0, origin: '',
        favorite: false, sourceRef: '', review: '', reviewSpoiler: false, createdAt: '',
    };
}

/** Obra nova em branco para a seção ("Ler" começa como mangá, em "Lendo"). */
export function emptyEntryFor(section = 'watch') {
    const base = emptyEntry();
    return section === 'read' ? { ...base, category: 'Mangá', seasons: [] } : base;
}

export const cloneEntry = (e) => JSON.parse(JSON.stringify(e));

// --- progresso ---------------------------------------------------------

/**
 * Progresso de leitura. A régua é o total de capítulos; se ele não existe, o de volumes.
 * `known` = false quando não há total nenhum (ex.: obra em publicação): aí só se mostra o que já foi lido.
 */
export function readProgress(entry) {
    const ct = entry.chaptersTotal || 0;
    const vt = entry.volumesTotal || 0;
    const unit = ct > 0 || vt === 0 ? 'cap' : 'vol';
    const total = unit === 'cap' ? ct : vt;
    const done = unit === 'cap' ? (entry.chaptersRead || 0) : (entry.volumesRead || 0);
    const exact = total > 0 ? Math.min(100, (done / total) * 100) : 0;
    return { total, done, unit, known: total > 0, pct: Math.min(100, Math.round(exact)), exact };
}

/** "Cap. 120 / 450 · Vol. 14" (o que existir). */
export function readSummary(entry) {
    const part = (label, done, total) => (total > 0 ? `${label} ${done} / ${total}` : done > 0 ? `${label} ${done}` : '');
    const out = [part('Cap.', entry.chaptersRead || 0, entry.chaptersTotal || 0), part('Vol.', entry.volumesRead || 0, entry.volumesTotal || 0)].filter(Boolean);
    return out.join(' · ') || 'Sem progresso';
}

export function progressOf(entry) {
    if (isReading(entry)) {
        const r = readProgress(entry);
        return { total: r.total, watched: r.done, pct: r.pct, exact: r.exact };
    }
    let total = 0;
    let watched = 0;
    for (const s of entry.seasons) { total += s.totalEps; watched += s.watched.length; }
    const exact = total > 0 ? (watched / total) * 100 : 0;
    return { total, watched, pct: Math.min(100, Math.round(exact)), exact };
}

/**
 * Ajusta o status geral conforme os episódios vistos (mesma regra do tracker original).
 * Uma obra "Dropado" ou "Em espera" volta a "Assistindo" (ou "Concluído") quando você marca um
 * episódio, mas não muda só porque o total de episódios foi editado (revive: false).
 */
export function syncStatus(entry, { revive = true } = {}) {
    if (!revive && PAUSED.has(entry.status)) return entry;
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

/** Marca todos os episódios de todas as temporadas como vistos (obra concluída). */
export function markAllWatched(entry) {
    if (isReading(entry)) {   // lido tudo: o que tem total conhecido vai até o fim
        if (entry.chaptersTotal > 0) entry.chaptersRead = entry.chaptersTotal;
        if (entry.volumesTotal > 0) entry.volumesRead = entry.volumesTotal;
        return entry;
    }
    for (const season of entry.seasons) season.watched = Array.from({ length: season.totalEps }, (_, i) => i + 1);
    return entry;
}

/**
 * Troca o status de uma obra (seletor do card). Ao mudar PARA "Concluído", todos os episódios
 * ficam como vistos (a mesma regra do formulário). Retorna true se o status mudou.
 */
export function applyStatus(entry, next) {
    if (!STATUSES[next] || entry.status === next) return false;
    entry.status = next;
    if (next === 'completed') markAllWatched(entry);
    return true;
}

// --- leitura (mangá e light novel) ---------------------------------------

/** Igual ao syncStatus dos episódios, para capítulos/volumes. */
export function syncReadStatus(entry, { revive = true } = {}) {
    if (!revive && PAUSED.has(entry.status)) return entry;
    const r = readProgress(entry);
    const started = (entry.chaptersRead || 0) > 0 || (entry.volumesRead || 0) > 0;
    if (r.known && r.done >= r.total) entry.status = 'completed';
    else if (started) entry.status = 'watching';
    return entry;
}

/** +1 Cap: lê mais um capítulo (não passa do total, se ele existir). Retorna true se mudou algo. */
export function addNextChapter(entry) {
    const max = entry.chaptersTotal > 0 ? entry.chaptersTotal : MAX_CHAPTERS;
    if ((entry.chaptersRead || 0) >= max) return false;
    entry.chaptersRead = (entry.chaptersRead || 0) + 1;
    syncReadStatus(entry);
    return true;
}

/**
 * Grava os contadores (já limitados aos totais). `revive: false` = só mudou um total, então uma obra
 * em espera/dropada não volta sozinha para "Lendo".
 */
export function setReadProgress(entry, { chaptersRead, chaptersTotal, volumesRead, volumesTotal }, { revive = true } = {}) {
    entry.chaptersTotal = toInt(chaptersTotal, 0, MAX_CHAPTERS, 0);
    entry.volumesTotal = toInt(volumesTotal, 0, MAX_VOLUMES, 0);
    entry.chaptersRead = toInt(chaptersRead, 0, entry.chaptersTotal || MAX_CHAPTERS, 0);
    entry.volumesRead = toInt(volumesRead, 0, entry.volumesTotal || MAX_VOLUMES, 0);
    syncReadStatus(entry, { revive });
    return entry;
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

// --- duplicadas e favoritos -------------------------------------------------

/** "Sousou no Frieren!" e "sousou  no frieren" viram a mesma chave. */
export const titleKey = (title) => String(title ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Procura na biblioteca uma obra igual à candidata: mesmo código da fonte (mal/anilist/tmdb)
 * ou mesmo título (sem acento, maiúsculas ou pontuação). `ignoreId` é a própria obra, na edição.
 */
export function findDuplicate(entries, { title = '', sourceRef = '' } = {}, ignoreId = '') {
    const key = titleKey(title);
    const ref = cleanRef(sourceRef);
    return entries.find((e) => {
        if (ignoreId && e.id === ignoreId) return false;
        if (ref && e.sourceRef === ref) return true;
        return key !== '' && titleKey(e.title) === key;
    }) || null;
}

/** Favoritos da seção (o limite de MAX_FAVORITES vale para "Assistir" e para "Ler" separadamente). */
export const favoriteCount = (entries, section = null) => entries.filter((e) => e.favorite && (!section || sectionOf(e) === section)).length;

/** Deixa só os primeiros `max` favoritos de cada seção (usado ao importar backups). */
export function capFavorites(entries, max = MAX_FAVORITES) {
    const n = { watch: 0, read: 0 };
    return entries.map((e) => (e.favorite && ++n[sectionOf(e)] > max ? { ...e, favorite: false } : e));
}

// --- listas ------------------------------------------------------------

const createdMs = (e) => (e.createdAt ? Date.parse(e.createdAt) || 0 : Number(e.id) || 0);

export function filterEntries(entries, { status = 'all', category = 'all', query = '', section = 'all' } = {}) {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
        if (section !== 'all' && sectionOf(e) !== section) return false;
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
