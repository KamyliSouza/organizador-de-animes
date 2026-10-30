// Janela "Novidades": o histórico de atualizações do site (js/domain/changelog.js).
import { el, html } from '../core/dom.js';
import { openModal } from '../core/modal.js';
import { CHANGELOG, SITE_VERSION } from '../domain/changelog.js';

export function openPatchNotesModal() {
    const content = el(html`
        <div class="stack patch-notes">
            <p class="muted small">Você está na versão <b>${SITE_VERSION}</b>. As novidades mais recentes aparecem primeiro.</p>
            ${CHANGELOG.map((rel, i) => html`
                <details class="patch-entry" ${i === 0 ? 'open' : ''}>
                    <summary><span class="patch-version">${rel.version}</span><span class="patch-title">${rel.title}</span>${i === 0 ? html`<span class="badge badge-muted">atual</span>` : ''}</summary>
                    <ul>${rel.items.map((t) => html`<li>${t}</li>`)}</ul>
                </details>`)}
            <div class="modal-footer"><button type="button" class="button button-secondary" data-modal-close>Fechar</button></div>
        </div>`);
    return openModal({ title: 'Novidades do site', iconName: 'sparkles', content });
}
