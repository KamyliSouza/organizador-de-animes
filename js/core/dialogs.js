import { el, html } from './dom.js';
import { openModal } from './modal.js';

/**
 * Pergunta com várias respostas. Retorna o `value` escolhido ou null se fechar.
 * choices: [{ value, label, variant: 'primary'|'secondary'|'danger'|'ghost' }]
 */
export function choiceDialog({ title, message, choices, iconName = 'info' }) {
    return new Promise((resolve) => {
        let answer = null;
        const content = el(html`
            <p class="muted" style="white-space:pre-line">${message}</p>
            <div class="modal-footer">
                ${choices.map((c, i) => html`<button type="button" class="button button-${c.variant || 'secondary'}" data-choice="${i}">${c.label}</button>`)}
            </div>`);
        const modal = openModal({ title, iconName, size: 'sm', content, onClose: () => resolve(answer) });
        content.addEventListener('click', (e) => {
            const btn = e.target instanceof Element ? e.target.closest('[data-choice]') : null;
            if (!btn) return;
            answer = choices[Number(btn.dataset.choice)].value;
            modal.close();
        });
    });
}

/**
 * Confirmação "digite para confirmar" (ações sem volta, como excluir a conta).
 * O botão só habilita quando o texto digitado é igual a `expected`. Retorna true/false.
 */
export function typedConfirmDialog({ title, message, expected, confirmLabel = 'Excluir', iconName = 'alert' }) {
    return new Promise((resolve) => {
        let answer = false;
        const content = el(html`
            <form class="stack" novalidate>
                <p class="muted" style="white-space:pre-line">${message}</p>
                <div class="field">
                    <label for="typed-confirm">Digite <strong>${expected}</strong> para confirmar</label>
                    <input id="typed-confirm" class="input" autocomplete="off" autocapitalize="none" spellcheck="false">
                </div>
                <div class="modal-footer">
                    <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
                    <button type="submit" class="button button-danger" data-confirm disabled>${confirmLabel}</button>
                </div>
            </form>`, 'div');
        const input = content.querySelector('#typed-confirm');
        const confirm = content.querySelector('[data-confirm]');
        const matches = () => input.value.trim().toLowerCase() === String(expected).trim().toLowerCase();
        const modal = openModal({ title, iconName, size: 'sm', content, onClose: () => resolve(answer) });
        input.addEventListener('input', () => { confirm.disabled = !matches(); });
        content.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!matches()) return;
            answer = true;
            modal.close();
        });
        input.focus();
    });
}

/** Confirmação simples. Retorna true/false. */
export async function confirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) {
    const res = await choiceDialog({
        title,
        message,
        iconName: danger ? 'alert' : 'info',
        choices: [
            { value: false, label: cancelLabel, variant: 'ghost' },
            { value: true, label: confirmLabel, variant: danger ? 'danger' : 'primary' },
        ],
    });
    return res === true;
}
