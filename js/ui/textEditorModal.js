// Janela exclusiva para escrever um texto comprido (a análise ou as anotações de uma obra).
// O que a pessoa digita vale na hora para o rascunho do formulário (`onChange`): fechar a janela de qualquer jeito
// (Concluir, X, Esc ou clique no fundo) nunca perde o texto. A obra só é gravada ao salvar o formulário.
import { el, html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.iconName]
 * @param {string} [opts.intro]         Texto de ajuda acima do campo.
 * @param {string} [opts.label]         Nome acessível do campo.
 * @param {string} [opts.placeholder]
 * @param {string} opts.value
 * @param {number} opts.maxLength
 * @param {boolean|null} [opts.spoiler] null = sem opção de spoiler; boolean = valor atual da caixa "Contém spoilers".
 * @param {({value:string, spoiler:boolean})=>void} opts.onChange
 * @param {() => void} [opts.onClose]
 */
export function openTextEditor({ title, iconName = 'edit', intro = '', label = title, placeholder = '', value, maxLength, spoiler = null, onChange, onClose }) {
    const content = el(html`
        <div class="stack">
            ${intro ? html`<p class="muted small">${intro}</p>` : ''}
            <div class="field">
                <label for="tx-text" class="sr-only">${label}</label>
                <textarea id="tx-text" class="textarea text-editor" maxlength="${maxLength}" placeholder="${placeholder}"></textarea>
                <div class="row-between">
                    ${spoiler === null ? html`<span></span>` : html`<label class="check-row"><input type="checkbox" id="tx-spoiler"> Contém spoilers</label>`}
                    <span class="field-hint" data-tx-count aria-live="off">0/${maxLength}</span>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="button button-ghost" data-tx-clear>${icon('trash', { size: 15 })} Limpar texto</button>
                <button type="button" class="button button-primary" data-modal-close>Concluir</button>
            </div>
        </div>`);

    const text = content.querySelector('#tx-text');
    const box = content.querySelector('#tx-spoiler');
    const count = content.querySelector('[data-tx-count]');
    text.value = value || '';
    if (box) box.checked = Boolean(spoiler);
    const paint = () => { count.textContent = `${text.value.length}/${maxLength}`; };
    const push = () => { paint(); onChange({ value: text.value, spoiler: Boolean(box?.checked) }); };
    text.addEventListener('input', push);
    box?.addEventListener('change', push);
    content.querySelector('[data-tx-clear]').addEventListener('click', () => { text.value = ''; if (box) box.checked = false; push(); text.focus(); });
    paint();

    return openModal({ title, iconName, content, onClose, initialFocus: '#tx-text' });
}
