// AniList (GraphQL).
import { cleanHtmlText } from '../../core/dom.js';
import { fetchJson } from '../http.js';
import { firstSeason, readCategoryOf, readRef, seasonTypeOf, starsFrom } from './shared.js';

const URL = 'https://graphql.anilist.co';

const WORKS_QUERY = `
query ($search: String, $perPage: Int) {
  Page (perPage: $perPage) {
    media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id idMal title { english romaji }
      episodes averageScore description coverImage { large } genres format
      relations { edges { relationType node { title { english romaji } episodes format } } }
    }
  }
}`;

const SEASONS_QUERY = `
query ($search: String, $perPage: Int) {
  Page (perPage: $perPage) {
    media (search: $search, type: ANIME, sort: SEARCH_MATCH) { title { english romaji } episodes }
  }
}`;

const READINGS_QUERY = `
query ($search: String, $perPage: Int) {
  Page (perPage: $perPage) {
    media (search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id idMal title { english romaji }
      chapters volumes averageScore description coverImage { large } genres format countryOfOrigin
    }
  }
}`;

async function gql(query, variables) {
    const json = await fetchJson(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        retries: 1,
    });
    return json?.data?.Page?.media || [];
}

export async function searchWorks(query, { limit = 5 } = {}) {
    const media = await gql(WORKS_QUERY, { search: query, perPage: limit });
    return media.map((a) => {
        const genres = a.genres || [];
        const format = a.format || 'TV';
        const seasons = [firstSeason(format, a.episodes)];

        let n = 2;
        for (const edge of a.relations?.edges || []) {
            if (['SEQUEL', 'PARENT'].includes(edge.relationType) && edge.node) {
                seasons.push({
                    name: `${n}ª Temporada`,
                    type: seasonTypeOf(edge.node.format),
                    totalEps: edge.node.episodes || 12,
                    watched: [],
                });
                n++;
            }
        }

        return {
            // mesmo código do MAL quando existe, assim a mesma obra vinda das duas fontes é reconhecida
            sourceRef: a.idMal ? `mal:${a.idMal}` : a.id ? `anilist:${a.id}` : '',
            title: a.title?.english || a.title?.romaji || '',
            category: 'Anime',
            coverImage: a.coverImage?.large || '',
            description: cleanHtmlText(a.description),
            genres,
            rating: starsFrom(a.averageScore, 100),
            airDay: '',
            tags: ['Anime', format, ...genres.slice(0, 3)],
            seasons,
        };
    });
}

export async function searchSeasons(query) {
    const media = await gql(SEASONS_QUERY, { search: query, perPage: 4 });
    return media.map((a) => ({ name: a.title?.english || a.title?.romaji || '', eps: a.episodes || 12 }));
}

/** Mangás e light novels. Resultado: { sourceRef, title, category, origin, coverImage, description, genres, rating, tags, chaptersTotal, volumesTotal } */
export async function searchReadings(query, { limit = 5 } = {}) {
    const media = await gql(READINGS_QUERY, { search: query, perPage: limit });
    return media.map((a) => {
        const genres = a.genres || [];
        const category = readCategoryOf(a.format);
        return {
            sourceRef: readRef(a.idMal, a.id),
            title: a.title?.english || a.title?.romaji || '',
            category,
            origin: /^[A-Z]{2}$/.test(a.countryOfOrigin || '') ? a.countryOfOrigin : '',
            coverImage: a.coverImage?.large || '',
            description: cleanHtmlText(a.description),
            genres,
            rating: starsFrom(a.averageScore, 100),
            tags: [category, ...genres.slice(0, 3)],
            chaptersTotal: a.chapters || 0,
            volumesTotal: a.volumes || 0,
        };
    });
}
