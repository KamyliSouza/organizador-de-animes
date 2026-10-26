import { config } from '../config.js';
import { html } from '../core/dom.js';

export const AVATAR_BUCKET = 'avatars';

// Cores que mantêm bom contraste com texto branco.
const COLORS = ['#9b4d97', '#7c5cbf', '#5b6cc9', '#2f7fa3', '#2f8f83', '#b0568b', '#c0577a', '#8a5a9e'];
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function colorFor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
}

/**
 * Endereço público da foto de um perfil, ou '' se a pessoa não tem foto.
 * O número da versão (avatarV) vai na URL: ao trocar a foto ele muda e o navegador/CDN
 * deixam de mostrar a antiga que estava em cache.
 */
export function avatarSrc(profile) {
    const v = Number(profile?.avatarV);
    if (!profile || !Number.isSafeInteger(v) || v <= 0 || !UUID_RX.test(String(profile.id || ''))) return '';
    const base = String(config.supabaseUrl || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(base)) return '';
    return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${profile.id}?v=${v}`;
}

/** Avatar: foto quando existe (`src`), senão a inicial do nome sobre uma cor. */
export function avatar(name, size = 40, src = '') {
    const initial = (String(name || '?').trim()[0] || '?');
    return html`<span class="avatar" style="--size:${size}px;--avatar-bg:${colorFor(name)}" aria-hidden="true">${initial}${src
        ? html`<img class="avatar-img" src="${src}" alt="" width="${size}" height="${size}" decoding="async" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
}

// Se a foto não carregar (apagada, sem internet...), a imagem some e a inicial continua aparecendo.
// "error" não sobe (bubble) na árvore, por isso o ouvinte é em fase de captura.
document.addEventListener('error', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.classList.contains('avatar-img')) t.remove();
}, true);
