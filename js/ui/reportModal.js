// "Denunciar perfil": a pessoa escolhe o motivo e, se quiser, escreve um detalhe. A equipe vê no painel.
import { el, html } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { openModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { MOTIVES } from '../domain/roles.js';

export const REPORT_DETAILS_MAX = 300;

/**
 * @param {object} opts
 * @param {{username: string, displayName: string}} opts.person  perfil denunciado
 * @param {(username: string, reason: string, details: string) => Promise<void>} opts.send
 */
export function openReportModal({ person, send }) {
    const content = el(html`
        <form class="stack" novalidate>
            <p class="muted small">Sua denúncia vai só para a equipe do site. A pessoa denunciada não sabe quem denunciou. Denúncias falsas ou repetidas podem levar à suspensão de quem denuncia.</p>
            <div class="field">
                <label for="rp-reason">Motivo</label>
                <select id="rp-reason" class="select" required>
                    <option value="">Escolha o motivo…</option>
                    ${MOTIVES.map(([key, label]) => html`<option value="${key}">${label}</option>`)}
                </select>
            </div>
            <div class="field">
                <label for="rp-details">Detalhes <span class="muted">(opcional)</span></label>
                <textarea id="rp-details" class="textarea" rows="3" maxlength="${REPORT_DETAILS_MAX}" placeholder="O que ajuda a equipe a entender o problema?"></textarea>
                <span class="field-hint" data-count aria-live="off">0 / ${REPORT_DETAILS_MAX}</span>
            </div>
            <p class="field-error" data-error role="alert" hidden></p>
            <div class="modal-footer">
                <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
                <button type="submit" class="button button-primary" data-send>Enviar denúncia</button>
            </div>
        </form>`);

    const form = content.querySelector('form');
    const reason = content.querySelector('#rp-reason');
    const details = content.querySelector('#rp-details');
    const count = content.querySelector('[data-count]');
    const error = content.querySelector('[data-error]');
    const sendBtn = content.querySelector('[data-send]');

    const modal = openModal({ title: `Denunciar @${person.username}`, iconName: 'flag', size: 'sm', content, initialFocus: '#rp-reason' });

    details.addEventListener('input', () => { count.textContent = `${details.value.length} / ${REPORT_DETAILS_MAX}`; });
    reason.addEventListener('change', () => { error.hidden = true; });

    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!reason.value) {
            error.textContent = 'Escolha o motivo da denúncia.';
            error.hidden = false;
            reason.focus();
            return;
        }
        sendBtn.disabled = true;
        try {
            await send(person.username, reason.value, details.value.trim());
            toast('Denúncia enviada. A equipe vai analisar.', { type: 'success' });
            modal.close();
        } catch (err) {
            console.error(err);
            sendBtn.disabled = false;
            error.textContent = messageOf(err, 'Não foi possível enviar a denúncia.');
            error.hidden = false;
        }
    });
    return modal;
}
