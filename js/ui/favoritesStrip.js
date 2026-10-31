// Faixa de favoritos do perfil: uma linha só, com rolagem lateral (dedo, roda do mouse com Shift, barra
// de rolagem, setas do teclado ou os botões ‹ ›). Não há limite de favoritos: todos os da aba aparecem.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { SECTIONS } from '../domain/entry.js';
import { mediaCardHtml } from './mediaCard.js';

/**
 * @param {Array} favorites  obras favoritas já filtradas pela aba
 * @param {'anime'|'manga'|'novel'} section
 */
export function favoritesStripHtml(favorites, section) {
    if (!favorites.length) return '';
    const label = SECTIONS[section]?.label || '';
    return html`
    <section class="fav-section" data-favorites aria-labelledby="fav-title">
        <div class="fav-head">
            <h2 id="fav-title">${icon('heart', { size: 20 })} Favoritos <span class="count" aria-label="${favorites.length} ${favorites.length === 1 ? 'favorito' : 'favoritos'}">${favorites.length}</span></h2>
            <div class="fav-nav" data-fav-nav hidden>
                <button type="button" class="icon-button sm" data-fav-step="-1" aria-label="Ver favoritos anteriores" title="Anteriores">${icon('arrowLeft', { size: 16 })}</button>
                <button type="button" class="icon-button sm" data-fav-step="1" aria-label="Ver mais favoritos" title="Próximos">${icon('arrowRight', { size: 16 })}</button>
            </div>
        </div>
        <div class="fav-strip" data-fav-strip tabindex="0" role="region" aria-label="Favoritos de ${label}, role para o lado para ver todos">
            ${favorites.map((e) => html`<div class="fav-item">${mediaCardHtml(e, { readonly: true })}</div>`)}
        </div>
    </section>`;
}

/**
 * Liga os botões ‹ › e mostra/esconde a navegação conforme a faixa transborda.
 * Chame `update()` depois de redesenhar a faixa. `destroy()` solta os ouvintes.
 */
export function bindFavoritesStrip(container) {
    const strip = () => container.querySelector('[data-fav-strip]');
    const nav = () => container.querySelector('[data-fav-nav]');
    let watched = null;

    function measure() {
        const s = strip();
        const n = nav();
        if (!s || !n) return;
        const overflow = s.scrollWidth - s.clientWidth > 2;
        n.hidden = !overflow;
        const prev = n.querySelector('[data-fav-step="-1"]');
        const next = n.querySelector('[data-fav-step="1"]');
        if (prev) prev.disabled = s.scrollLeft <= 1;
        if (next) next.disabled = s.scrollLeft >= s.scrollWidth - s.clientWidth - 1;
    }

    // A faixa muda de tamanho quando a tela é redimensionada ou quando a página termina de ser montada:
    // o ResizeObserver cuida de medir de novo nesses casos.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;

    function update() {
        measure();
        const s = strip();
        if (observer && s && s !== watched) { observer.disconnect(); observer.observe(s); watched = s; }
        else if (!s) { observer?.disconnect(); watched = null; }
    }

    const onClick = (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-fav-step]') : null;
        const s = strip();
        if (!btn || !s || !container.contains(btn)) return;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        s.scrollBy({ left: Number(btn.dataset.favStep) * Math.max(120, s.clientWidth * 0.85), behavior: reduce ? 'auto' : 'smooth' });
    };
    // "scroll" não borbulha: ouvimos na fase de captura para pegar a faixa que é redesenhada.
    const onScroll = (e) => { if (e.target instanceof Element && e.target.matches('[data-fav-strip]')) measure(); };

    container.addEventListener('click', onClick);
    container.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', measure);
    return {
        update,
        destroy() {
            observer?.disconnect();
            container.removeEventListener('click', onClick);
            container.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', measure);
        },
    };
}
