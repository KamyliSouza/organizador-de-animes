// Progresso de leitura (mangá e light novel): capítulos e volumes lidos e os totais.
// Total 0 = não se sabe (obra ainda em publicação): aí só o que já foi lido aparece no card.
import { el, html } from '../core/dom.js';
import { openModal } from '../core/modal.js';
import { MAX_CHAPTERS, MAX_VOLUMES, setReadProgress } from '../domain/entry.js';

/**
 * @param {object} opts
 * @param {object} opts.entry      Obra (é alterada ao salvar).
 * @param {(entry:object)=>void} opts.onChange  Chamado depois de salvar (a tela grava e redesenha).
 */
export function openReadProgressModal({ entry, onChange }) {
    const content = el(html`
        <form class="stack" novalidate>
            <p class="muted small">Se o total for desconhecido (obra em publicação), deixe em 0.</p>
            <div class="form-grid">
                <div class="field">
                    <label for="rp-ch">Capítulos lidos</label>
                    <input id="rp-ch" class="input" type="number" inputmode="numeric" min="0" max="${MAX_CHAPTERS}" value="${entry.chaptersRead || 0}">
                </div>
                <div class="field">
                    <label for="rp-ch-total">Total de capítulos</label>
                    <input id="rp-ch-total" class="input" type="number" inputmode="numeric" min="0" max="${MAX_CHAPTERS}" value="${entry.chaptersTotal || 0}">
                </div>
                <div class="field">
                    <label for="rp-vol">Volumes lidos</label>
                    <input id="rp-vol" class="input" type="number" inputmode="numeric" min="0" max="${MAX_VOLUMES}" value="${entry.volumesRead || 0}">
                </div>
                <div class="field">
                    <label for="rp-vol-total">Total de volumes</label>
                    <input id="rp-vol-total" class="input" type="number" inputmode="numeric" min="0" max="${MAX_VOLUMES}" value="${entry.volumesTotal || 0}">
                </div>
            </div>
            <p class="field-hint" data-hint aria-live="polite"></p>
            <div class="modal-footer">
                <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
                <button type="submit" class="button button-primary">Salvar progresso</button>
            </div>
        </form>`, 'div');

    const $ = (sel) => content.querySelector(sel);
    const num = (sel, max) => {
        const n = Math.trunc(Number($(sel).value));
        return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
    };

    $('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const next = {
            chaptersRead: num('#rp-ch', MAX_CHAPTERS), chaptersTotal: num('#rp-ch-total', MAX_CHAPTERS),
            volumesRead: num('#rp-vol', MAX_VOLUMES), volumesTotal: num('#rp-vol-total', MAX_VOLUMES),
        };
        // Só mudou um total (nada lido a mais): uma obra em espera/dropada não volta sozinha para "Lendo".
        const readMoved = next.chaptersRead !== (entry.chaptersRead || 0) || next.volumesRead !== (entry.volumesRead || 0);
        setReadProgress(entry, next, { revive: readMoved });
        onChange(entry);
        modal.close();
    });

    const modal = openModal({ title: `Progresso: ${entry.title}`, iconName: 'layers', content, initialFocus: '#rp-ch' });
    return modal;
}
