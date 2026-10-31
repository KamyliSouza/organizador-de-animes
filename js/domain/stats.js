import { DAYS, DEFAULT_SECTION, MINUTES_PER_EPISODE, SECTIONS, isReading, normalizeSection, sectionOf } from './entry.js';

/**
 * Números de uma aba da biblioteca (anime, manga ou novel): contagens por status, categorias e gêneros.
 * Anime soma episódios e tempo estimado; Mangá e Light Novel somam capítulos e volumes lidos.
 */
export function computeStats(entries, section = DEFAULT_SECTION) {
    section = normalizeSection(section);
    const list = entries.filter((e) => sectionOf(e) === section);
    const stats = {
        section,
        total: list.length,
        watching: 0, planned: 0, completed: 0, on_hold: 0, dropped: 0,
        episodes: 0, hours: 0, days: 0,
        chapters: 0, volumes: 0,
        categories: Object.fromEntries(SECTIONS[section].categories.map((c) => [c, 0])),
        topGenres: [],
    };
    const genres = new Map();

    for (const e of list) {
        stats[e.status] += 1;
        stats.categories[e.category] += 1;
        for (const g of e.genres) genres.set(g, (genres.get(g) || 0) + 1);
        if (isReading(e)) {
            stats.chapters += e.chaptersRead || 0;
            stats.volumes += e.volumesRead || 0;
        } else {
            for (const s of e.seasons) stats.episodes += s.watched.length;
        }
    }

    stats.hours = Math.round((stats.episodes * MINUTES_PER_EPISODE) / 60);
    stats.days = Math.round(stats.hours / 24);
    stats.topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 5);
    return stats;
}

/** Obras "Assistindo" agrupadas pelo dia de lançamento semanal (só a aba Anime tem agenda). */
export function groupByAirDay(entries) {
    const groups = Object.fromEntries(DAYS.map((d) => [d, []]));
    for (const e of entries) {
        if (e.status === 'watching' && !isReading(e) && groups[e.airDay]) groups[e.airDay].push(e);
    }
    return groups;
}
