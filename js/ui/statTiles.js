import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { DEFAULT_SECTION, isReadingSection, normalizeSection, statusLabel } from '../domain/entry.js';
import { computeStats } from '../domain/stats.js';

// [chave, rótulo na aba Anime, rótulo nas abas de leitura (Mangá e Light Novel), ícone, cor]
const TILES = [
    ['total', 'Obras', 'Obras', 'film', 'var(--primary-color)'],
    ['watching', 'Assistindo', 'Lendo', 'play', 'var(--st-watching)'],
    ['planned', 'Quero ver', 'Quero ler', 'clock', 'var(--st-planned)'],
    ['completed', 'Concluídas', 'Concluídas', 'check', 'var(--st-completed)'],
    ['on_hold', 'Em espera', 'Em espera', 'pause', 'var(--st-on_hold)'],
    ['dropped', 'Dropadas', 'Dropadas', 'ban', 'var(--st-dropped)'],
];

/**
 * Cards com os números de uma aba ("anime", "manga" ou "novel"). Cada um é um botão: clicar filtra
 * a lista pelo status correspondente ("Obras" mostra todas). `active` é o status filtrado agora ('all' = nenhum).
 */
export function statTilesHtml(entries, { active = 'all', section = DEFAULT_SECTION } = {}) {
    section = normalizeSection(section);
    const reading = isReadingSection(section);
    const s = computeStats(entries, section);
    return html`<div class="stat-grid">${TILES.map(([key, watchLabel, readLabel, ic, color]) => {
        const status = key === 'total' ? 'all' : key;
        const label = reading ? readLabel : watchLabel;
        return html`
        <button type="button" class="stat-tile glass-panel" data-stat="${status}" aria-pressed="${String(status === active)}" title="${status === 'all' ? 'Mostrar todas as obras' : `Mostrar só: ${status === 'all' ? label : statusLabel(status, section)}`}">
            <span class="stat-icon" style="--tile-color:${color}">${icon(key === 'total' && reading ? 'book' : ic, { size: 20 })}</span>
            <span class="stat-text"><span class="stat-label">${label}</span><span class="stat-value">${s[key]}</span></span>
        </button>`;
    })}</div>`;
}
