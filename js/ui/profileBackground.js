// Prévia do fundo na tela de Personalização. A camada que cobre o site todo (e a regra de quem vê o fundo de quem)
// está em js/core/siteBackground.js; aqui ficam só os nomes de sempre e a prévia.
import { html } from '../core/dom.js';
import { backgroundMode, backgroundSrc } from '../core/siteBackground.js';

export { BACKGROUND_BUCKET, backgroundMode, backgroundSrc } from '../core/siteBackground.js';

/** Prévia do fundo na tela de Personalização: a imagem com um cartão de exemplo, já no modo escolhido. */
export function backgroundPreviewHtml(profile, srcOverride = '') {
    const src = srcOverride || backgroundSrc(profile);
    if (!src) {
        return html`<div class="bg-preview bg-preview-empty" data-bg-preview><span class="muted">Nenhum fundo escolhido: o site usa as cores normais.</span></div>`;
    }
    return html`
    <div class="bg-preview bg-art" data-bg="${backgroundMode(profile)}" data-bg-preview>
        <img class="bg-art-img is-loaded" src="${src}" alt="Prévia do seu fundo" decoding="async" referrerpolicy="no-referrer">
        <span class="bg-art-veil"></span>
        <div class="bg-preview-card glass-panel"><strong>Seu site</strong><span>Assim os cards ficam sobre o fundo.</span></div>
    </div>`;
}
