// Pedaços comuns aos provedores de busca.

const DAY_WORDS = [
    ['monday', 'Segunda'], ['tuesday', 'Terça'], ['wednesday', 'Quarta'], ['thursday', 'Quinta'],
    ['friday', 'Sexta'], ['saturday', 'Sábado'], ['sunday', 'Domingo'],
];

/** "Mondays" -> "Segunda". */
export function dayToPortuguese(str) {
    const s = String(str || '').toLowerCase();
    const hit = DAY_WORDS.find(([en]) => s.includes(en));
    return hit ? hit[1] : '';
}

/** Tipos das APIs (TV, Movie, OVA, ONA, Special...) -> tipos usados pelo app. */
export function seasonTypeOf(apiType) {
    const t = String(apiType || '').toUpperCase().replace(/[\s_]/g, '');
    if (t === 'MOVIE') return 'Filme';
    if (t === 'OVA') return 'OVA';
    if (t === 'SPECIAL' || t === 'TVSPECIAL') return 'Especial';
    return 'TV';
}

/** Nota de 0–10 (ou 0–100) da comunidade para estrelas 0–5. */
export const starsFrom = (value, outOf) => (value ? Math.round((value / outOf) * 5) : 0);

export const firstSeason = (type, totalEps) => ({
    name: '1ª Temporada',
    type: seasonTypeOf(type),
    totalEps: totalEps || 12,
    watched: [],
});
