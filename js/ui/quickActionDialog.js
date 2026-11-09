// Janela da ação rápida de uma denúncia (Patch 20): a equipe confere o que vai acontecer, escreve o motivo (quando precisa) e confirma.
// A ação e a resolução da denúncia acontecem juntas no banco (admin_act_on_report). Se der erro, a janela continua aberta com o aviso,
// para a equipe corrigir (por exemplo, o motivo do aviso vazio) sem perder o que escreveu.
import { el, html } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { AUTO_SUSPEND_DAYS, STRIKE_LIMIT, SUSPEND_PRESETS } from '../domain/access.js';
import { contextView, defaultReasonText, quickAction, strikeWillSuspend } from '../domain/reportContext.js';

export const QUICK_REASON_MAX = 300;

/**
 * @param {object} opts
 * @param {object} opts.report  denúncia da fila (id, reason, status, target, context)
 * @param {string} opts.action  chave de QUICK_ACTIONS
 * @param {(values: {reason: string, days: number|null, resolve: boolean, resolveOthers: boolean}) => Promise<void>} opts.onSubmit
 *        Faz a ação. Se lançar erro, a janela mostra a mensagem e continua aberta.
 */
export function openQuickActionDialog({ report, action, onSubmit }) {
    const spec = quickAction(action);
    if (!spec) return null;
    const user = report.target.username;
    const view = contextView(report);
    const isOpen = report.status === 'open';
    const needsText = spec.needs === 'reason' || spec.needs === 'optional';
    const thirdStrike = action === 'strike' && strikeWillSuspend(report.context?.activeStrikes);
    const blocked = action === 'strike' && Boolean(report.context?.suspensionKind);

    const content = el(html`
        <form class="stack quick-dialog" novalidate>
            <p class="muted">${spec.text(user)}</p>
            ${thirdStrike ? html`<div class="notice-box is-warn" role="note">${icon('alert')}<div>Este será o ${STRIKE_LIMIT}º aviso ativo desta conta: ela será suspensa por ${AUTO_SUSPEND_DAYS} dias.</div></div>` : ''}
            ${blocked ? html`<div class="notice-box is-warn" role="note">${icon('alert')}<div>Esta conta já está suspensa ou banida, e o site não aceita novos avisos para ela.</div></div>` : ''}
            ${needsText ? html`
            <div class="field">
                <label for="qa-reason">Motivo ${spec.needs === 'reason' ? '' : html`<span class="muted">(opcional)</span>`} <span class="muted">— a pessoa vê este texto</span></label>
                <textarea id="qa-reason" class="textarea" rows="3" maxlength="${QUICK_REASON_MAX}">${defaultReasonText(report.reason)}</textarea>
                <span class="field-hint" data-count aria-live="off"></span>
            </div>` : ''}
            ${spec.term ? html`
            <div class="field">
                <label for="qa-term">Prazo</label>
                <select id="qa-term" class="select">
                    ${SUSPEND_PRESETS.map((p) => html`<option value="${p.key}" ${p.key === '7' ? 'selected' : ''}>${p.label}</option>`)}
                </select>
            </div>` : ''}
            <fieldset class="quick-resolve">
                <legend class="sr-only">Denúncia</legend>
                ${isOpen ? html`
                <label class="check-row"><input type="checkbox" id="qa-resolve" checked> <span>Marcar esta denúncia como resolvida</span></label>
                ${view.others > 0 ? html`<label class="check-row"><input type="checkbox" id="qa-others"> <span>Resolver também as outras ${view.others} em aberto sobre @${user}</span></label>` : ''}`
                : html`<p class="field-hint">Esta denúncia já foi tratada. A ação continua ligada a ela no registro.</p>`}
            </fieldset>
            <p class="field-error" data-error role="alert" hidden></p>
            <div class="modal-footer">
                <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
                <button type="submit" class="button ${action === 'ban' || action === 'reset_media' ? 'button-danger' : 'button-primary'}" data-confirm>${spec.confirm}</button>
            </div>
        </form>`, 'div');

    const form = content.querySelector('form');
    const reason = content.querySelector('#qa-reason');
    const term = content.querySelector('#qa-term');
    const resolve = content.querySelector('#qa-resolve');
    const others = content.querySelector('#qa-others');
    const count = content.querySelector('[data-count]');
    const error = content.querySelector('[data-error]');
    const confirm = content.querySelector('[data-confirm]');

    const modal = openModal({ title: spec.title, iconName: spec.icon, size: 'sm', content, initialFocus: needsText ? '#qa-reason' : '[data-confirm]' });

    if (reason && count) {
        const paint = () => { count.textContent = `${reason.value.length} / ${QUICK_REASON_MAX}`; };
        reason.addEventListener('input', () => { paint(); error.hidden = true; });
        paint();
    }
    // "resolver as outras" só faz sentido com "resolver esta" ligado
    if (resolve && others) {
        resolve.addEventListener('change', () => { others.disabled = !resolve.checked; if (!resolve.checked) others.checked = false; });
    }

    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const text = reason ? reason.value.trim() : '';
        if (spec.needs === 'reason' && !text) {
            error.textContent = 'Escreva o motivo do aviso: a pessoa vai ver este texto.';
            error.hidden = false;
            reason.focus();
            return;
        }
        const preset = term ? SUSPEND_PRESETS.find((p) => p.key === term.value) : null;
        confirm.disabled = true;
        try {
            await onSubmit({
                reason: text,
                days: preset ? preset.days : null,
                resolve: resolve ? resolve.checked : false,
                resolveOthers: Boolean(others && others.checked && !others.disabled),
            });
            modal.close();
        } catch (err) {
            console.error(err);
            confirm.disabled = false;
            error.textContent = messageOf(err, 'Não foi possível concluir a ação.');
            error.hidden = false;
        }
    });
    return modal;
}
