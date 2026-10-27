import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { computeStats } from '../domain/stats.js';

const TILES = [
    ['total', 'Obras', 'film', 'var(--primary-color)'],
    ['watching', 'Assistindo', 'play', 'var(--st-watching)'],
    ['planned', 'Quero ver', 'clock', 'var(--st-planned)'],
    ['completed', 'Concluídas', 'check', 'var(--st-completed)'],
    ['on_hold', 'Em espera', 'pause', 'var(--st-on_hold)'],
    ['dropped', 'Dropadas', 'ban', 'var(--st-dropped)'],
];

/**
 * Cards com os números. Cada um é um botão: clicar filtra a lista pelo status correspondente
 * ("Obras" mostra todas). `active` é o status que está filtrado agora ('all' = nenhum).
 */
export function statTilesHtml(entries, { active = 'all' } = {}) {
    const s = computeStats(entries);
    return html`<div class="stat-grid">${TILES.map(([key, label, ic, color]) => {
        const status = key === 'total' ? 'all' : key;
        return html`
        <button type="button" class="stat-tile glass-panel" data-stat="${status}" aria-pressed="${String(status === active)}" title="${status === 'all' ? 'Mostrar todas as obras' : `Mostrar só: ${label}`}">
            <span class="stat-icon" style="--tile-color:${color}">${icon(ic, { size: 20 })}</span>
            <span class="stat-text"><span class="stat-label">${label}</span><span class="stat-value">${s[key]}</span></span>
        </button>`;
    })}</div>`;
}
