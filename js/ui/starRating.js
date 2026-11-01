// Campo de nota com estrelas e MEIA estrela (formulário da obra). Vale de 0 a 10 pontos: cada meia estrela é 1 ponto.
//  - mouse: passe por cima para ver, clique na metade esquerda (meia estrela) ou direita (estrela inteira) de cada estrela;
//  - toque: toque na metade desejada;
//  - teclado (campo focado): ← ↓ tiram meia estrela, → ↑ põem meia estrela, Home = sem nota, End = 5 estrelas, PageUp/PageDown = 1 estrela;
//  - o botão "Limpar" volta para "Sem nota".
// Para leitores de tela é um controle deslizante (role="slider") com o texto "3,5 de 5 estrelas".
import { html, setHtml } from '../core/dom.js';
import { MAX_RATING, ratingLabel, ratingNumber, starStates } from '../domain/entry.js';
import { starHtml } from './stars.js';

const SIZE = 32;

/** `id` vai no campo (para as dicas e testes); `labelledBy` é o id do texto "Avaliação". */
export const starRatingHtml = ({ id, labelledBy }) => html`
    <div class="star-rating" data-star-rating>
        <div class="star-input" id="${id}" role="slider" tabindex="0" aria-labelledby="${labelledBy}"
            aria-valuemin="0" aria-valuemax="${MAX_RATING}" aria-valuenow="0" aria-valuetext="Sem nota" data-star-input></div>
        <output class="star-value" data-star-value>Sem nota</output>
        <button type="button" class="button button-ghost button-sm" data-star-clear>Limpar</button>
    </div>`;

const clamp = (n) => Math.max(0, Math.min(MAX_RATING, Math.round(Number(n) || 0)));

/**
 * @param {Element} root  o elemento [data-star-rating]
 * @param {{ value?: number, onChange?: (value:number)=>void }} [opts]
 * @returns {{ value: number, focus(): void }}
 */
export function bindStarRating(root, { value = 0, onChange = null } = {}) {
    const input = root.querySelector('[data-star-input]');
    const out = root.querySelector('[data-star-value]');
    const clear = root.querySelector('[data-star-clear]');
    let current = clamp(value);
    let preview = null;

    function paint() {
        const shown = preview ?? current;
        setHtml(input, html`${starStates(shown).map((state) => starHtml(state, SIZE))}`);
        input.setAttribute('aria-valuenow', String(current));
        input.setAttribute('aria-valuetext', ratingLabel(current));
        out.textContent = shown > 0 ? `${ratingNumber(shown)} de 5` : 'Sem nota';
        out.classList.toggle('is-preview', preview != null);
        clear.disabled = current === 0;
    }

    function change(next) {
        const v = clamp(next);
        if (v === current) return;
        current = v;
        preview = null;
        paint();
        onChange?.(current);
    }

    /** Pontos (1 a 10) sob o ponteiro: a metade esquerda de uma estrela vale meia estrela. */
    function pointsAt(clientX) {
        const rect = input.getBoundingClientRect();
        const slot = rect.width / 5 || 1;
        const x = Math.max(0, Math.min(rect.width - 0.01, clientX - rect.left));
        const index = Math.floor(x / slot);
        return index * 2 + (x - index * slot < slot / 2 ? 1 : 2);
    }

    input.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const next = pointsAt(e.clientX);
        if (next !== preview) { preview = next; paint(); }
    });
    input.addEventListener('pointerleave', () => { if (preview != null) { preview = null; paint(); } });
    input.addEventListener('click', (e) => { change(pointsAt(e.clientX)); input.focus({ preventScroll: true }); });
    input.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 2, PageDown: -2 }[e.key];
        if (step) change(current + step);
        else if (e.key === 'Home') change(0);
        else if (e.key === 'End') change(MAX_RATING);
        else return;
        e.preventDefault();
    });
    clear.addEventListener('click', () => { change(0); input.focus({ preventScroll: true }); });

    paint();
    return {
        get value() { return current; },
        set value(v) { current = clamp(v); preview = null; paint(); },
        focus() { input.focus(); },
    };
}
