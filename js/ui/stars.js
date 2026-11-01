// Estrelas da nota (0 a 10 pontos = 0 a 5 estrelas, com meia estrela). Cada estrela é um SVG com duas camadas:
// o contorno (sempre inteiro) e o preenchimento, recortado pelo CSS para ficar cheio, pela metade ou vazio.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { ratingLabel, starStates } from '../domain/entry.js';

/** Uma estrela. `state`: 'full' | 'half' | 'empty'. */
export const starHtml = (state, size = 16) => html`<span class="star star-${state}" style="--star-size:${size}px">${icon('star', { size, className: 'star-base' })}${icon('star', { size, className: 'star-fill' })}</span>`;

/** As cinco estrelas de uma nota (sem texto). */
export const starRowHtml = (rating, size = 16) => starStates(rating).map((state) => starHtml(state, size));

/** Nota no card, na lista e no feed: cinco estrelas com meias estrelas e o texto para leitor de tela ("3,5 de 5 estrelas"). */
export function starsHtml(rating, { size = 16 } = {}) {
    if (!rating) return html`<span class="muted small">Sem nota</span>`;
    return html`<span class="stars" role="img" aria-label="${ratingLabel(rating)}" title="${ratingLabel(rating)}">${starRowHtml(rating, size)}</span>`;
}
