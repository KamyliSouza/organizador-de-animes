// A "análise" que a pessoa escreve sobre uma obra (diferente das anotações privadas).
// Análise com spoiler fica escondida atrás de um botão; análise longa vem recolhida.
import { html, on } from '../core/dom.js';

const LONG_CHARS = 280;
const LONG_LINES = 4;

export function reviewHtml(review, spoiler = false) {
    const text = String(review || '').trim();
    if (!text) return '';
    const long = text.length > LONG_CHARS || text.split('\n').length > LONG_LINES;
    const body = html`<p class="review-text ${long && !spoiler ? 'is-clamped' : ''}">${text}</p>`;
    if (spoiler) {
        return html`<div class="review-box is-spoiler">
            <p class="review-spoiler-line"><span class="badge badge-danger">Spoiler</span>
                <button type="button" class="link-button" data-act="reveal-review" aria-expanded="false">Mostrar análise</button></p>
            <div class="review-hidden" hidden>${html`<p class="review-text">${text}</p>`}</div>
        </div>`;
    }
    return html`<div class="review-box">${body}${long ? html`<button type="button" class="link-button" data-act="toggle-review" aria-expanded="false">Ler mais</button>` : ''}</div>`;
}

/** Liga "Mostrar análise" (spoiler) e "Ler mais/menos" dentro de `root`. Devolve a função que desfaz. */
export function bindReviews(root) {
    const offs = [
        on(root, 'click', '[data-act="reveal-review"]', (_, btn) => {
            const box = btn.closest('.review-box');
            const hidden = box.querySelector('.review-hidden');
            const show = hidden.hidden;
            hidden.hidden = !show;
            btn.textContent = show ? 'Esconder análise' : 'Mostrar análise';
            btn.setAttribute('aria-expanded', String(show));
        }),
        on(root, 'click', '[data-act="toggle-review"]', (_, btn) => {
            const text = btn.closest('.review-box').querySelector('.review-text');
            const open = text.classList.toggle('is-clamped') === false;
            btn.textContent = open ? 'Ler menos' : 'Ler mais';
            btn.setAttribute('aria-expanded', String(open));
        }),
    ];
    return () => offs.forEach((off) => off());
}
