import { html } from '../core/dom.js';

// Cores que mantêm bom contraste com texto branco.
const COLORS = ['#9b4d97', '#7c5cbf', '#5b6cc9', '#2f7fa3', '#2f8f83', '#b0568b', '#c0577a', '#8a5a9e'];

function colorFor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
}

/** Avatar de iniciais (sem imagens). */
export function avatar(name, size = 40) {
    const initial = (String(name || '?').trim()[0] || '?');
    return html`<span class="avatar" style="--size:${size}px;--avatar-bg:${colorFor(name)}" aria-hidden="true">${initial}</span>`;
}
