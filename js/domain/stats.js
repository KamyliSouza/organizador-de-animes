import { CATEGORIES, DAYS, MINUTES_PER_EPISODE } from './entry.js';

/** Números da biblioteca: contagens, tempo estimado, categorias e gêneros. */
export function computeStats(entries) {
    const stats = {
        total: entries.length,
        watching: 0, planned: 0, completed: 0, on_hold: 0, dropped: 0,
        episodes: 0, hours: 0, days: 0,
        categories: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
        topGenres: [],
    };
    const genres = new Map();

    for (const e of entries) {
        stats[e.status] += 1;
        stats.categories[e.category] += 1;
        for (const g of e.genres) genres.set(g, (genres.get(g) || 0) + 1);
        for (const s of e.seasons) stats.episodes += s.watched.length;
    }

    stats.hours = Math.round((stats.episodes * MINUTES_PER_EPISODE) / 60);
    stats.days = Math.round(stats.hours / 24);
    stats.topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 5);
    return stats;
}

/** Obras "Assistindo" agrupadas pelo dia de lançamento semanal. */
export function groupByAirDay(entries) {
    const groups = Object.fromEntries(DAYS.map((d) => [d, []]));
    for (const e of entries) {
        if (e.status === 'watching' && groups[e.airDay]) groups[e.airDay].push(e);
    }
    return groups;
}
