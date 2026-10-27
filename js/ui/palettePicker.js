// Seletor de preset de cores (grade de amostras). Cada amostra usa o próprio preset (data-palette), então
// mostra as cores reais; a marcação de "selecionado" e o foco usam as cores da página, não as da amostra.
import { html, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { PALETTES, paletteId } from '../domain/palettes.js';

export function palettePickerHtml(current) {
    const now = paletteId(current);
    return html`
    <div class="palette-grid" role="radiogroup" aria-label="Combinação de cores">
        ${PALETTES.map((p) => html`
        <div class="palette-item">
            <input type="radio" class="palette-input sr-only" name="palette" id="pal-${p.id}" value="${p.id}" ${p.id === now ? 'checked' : ''}>
            <label class="palette-option" for="pal-${p.id}">
                <span class="palette-preview" data-palette="${p.id}" aria-hidden="true">
                    <span class="pv-card"><span class="pv-btn"></span><span class="pv-line"></span></span>
                    <span class="pv-bars"><i></i><i></i></span>
                </span>
                <span class="palette-name"><span>${p.name}</span><span class="palette-check" aria-hidden="true">${icon('check', { size: 14 })}</span></span>
                <span class="palette-desc">${p.description}</span>
            </label>
        </div>`)}
    </div>`;
}

/** `onPick(id)` roda quando a pessoa escolhe outra amostra. Devolve a função que desfaz a ligação. */
export function bindPalettePicker(root, onPick) {
    return on(root, 'change', 'input[name="palette"]', (_, input) => onPick(input.value));
}

/** Marca a amostra `id` como selecionada (usado para desfazer uma escolha que não pôde ser salva). */
export function selectPalette(root, id) {
    const input = root.querySelector(`input[name="palette"][value="${paletteId(id)}"]`);
    if (input) input.checked = true;
}
