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
