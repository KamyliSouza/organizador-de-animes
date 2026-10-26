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

export function statTilesHtml(entries) {
    const s = computeStats(entries);
    return html`<div class="stat-grid">${TILES.map(([key, label, ic, color]) => html`
        <div class="stat-tile glass-panel">
            <span class="stat-icon" style="--tile-color:${color}">${icon(ic, { size: 20 })}</span>
            <div><p class="stat-label">${label}</p><p class="stat-value">${s[key]}</p></div>
        </div>`)}</div>`;
}
