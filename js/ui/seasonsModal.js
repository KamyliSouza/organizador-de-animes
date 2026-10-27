// Gerenciador de temporadas e episódios. Edita a obra diretamente e avisa
// quem abriu (onChange) a cada alteração, para a biblioteca salvar e redesenhar.
import { el, html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { MAX_EPISODES, SEASON_TYPES, seasonState, setSeasonTotal, setSeasonWatched, toggleEpisode } from '../domain/entry.js';

export function openSeasonsModal({ entry, onChange }) {
    let active = 0;

    const content = el(html`
        <div class="stack">
            <div class="season-tabs" role="tablist" aria-label="Temporadas" data-tabs></div>

            <div class="season-settings">
                <div class="field span-2">
                    <label for="ss-name">Nome da temporada</label>
                    <input id="ss-name" class="input input-sm" maxlength="80" autocomplete="off">
                </div>
                <div class="field">
                    <label for="ss-type">Tipo</label>
                    <select id="ss-type" class="select select-sm">${SEASON_TYPES.map((t) => html`<option value="${t}">${t}</option>`)}</select>
                </div>
                <div class="field">
                    <label for="ss-eps">Total de episódios</label>
                    <input id="ss-eps" class="input input-sm" type="number" min="1" max="${MAX_EPISODES}">
                </div>
            </div>

            <div class="row-between">
                <span data-badge></span>
                <div class="row">
                    <button type="button" class="button button-secondary button-sm" data-act="complete">${icon('checkDouble', { size: 15 })} Concluir temporada</button>
                    <button type="button" class="button button-ghost button-sm" data-act="clear">Desmarcar</button>
                </div>
            </div>

            <div class="episode-grid" data-episodes></div>

            <div class="modal-footer">
                <button type="button" class="button button-primary" data-modal-close>Salvar e concluir</button>
            </div>
        </div>`);

    const $ = (s) => content.querySelector(s);
    const nameInput = $('#ss-name');
    const typeInput = $('#ss-type');
    const epsInput = $('#ss-eps');

    const season = () => entry.seasons[active];
    const changed = () => onChange?.(entry);

    function renderTabs() {
        setHtml($('[data-tabs]'), html`${entry.seasons.map((s, i) => {
            const state = seasonState(s);
            return html`<button type="button" class="season-tab" role="tab" data-tab="${i}" aria-selected="${String(i === active)}">
                <span>${s.name || 'Sem nome'} (${s.type})</span>
                ${state === 'done' ? html`<span class="done">${icon('check', { size: 13 })}</span>` : state === 'partial' ? html`<span class="dot" aria-label="em andamento"></span>` : ''}
            </button>`;
        })}`);
    }

    function renderSettings() {
        const s = season();
        nameInput.value = s.name;
        typeInput.value = s.type;
        epsInput.value = s.totalEps;
    }

    function renderEpisodes() {
        const s = season();
        const state = seasonState(s);
        const label = state === 'done' ? 'Temporada assistida' : state === 'partial' ? 'Em progresso' : 'Não assistida';
        const cls = state === 'done' ? 'badge-completed' : state === 'partial' ? 'badge-planned' : 'badge-muted';
        setHtml($('[data-badge]'), html`<span class="badge ${cls}">${label} (${s.watched.length}/${s.totalEps})</span>`);

        const watched = new Set(s.watched);
        setHtml($('[data-episodes]'), html`${Array.from({ length: s.totalEps }, (_, i) => i + 1).map((n) =>
            html`<button type="button" class="episode-btn" data-ep="${n}" aria-pressed="${String(watched.has(n))}" aria-label="Episódio ${n}">${n}</button>`)}`);
    }

    const renderAll = () => { renderTabs(); renderSettings(); renderEpisodes(); };

    on(content, 'click', '[data-tab]', (_, b) => { active = Number(b.dataset.tab); renderAll(); });

    on(content, 'click', '[data-ep]', (_, b) => {
        toggleEpisode(entry, active, Number(b.dataset.ep));
        renderTabs(); renderEpisodes(); changed();
    });

    on(content, 'click', '[data-act]', (_, b) => {
        setSeasonWatched(entry, active, b.dataset.act === 'complete');
        renderTabs(); renderEpisodes(); changed();
    });

    nameInput.addEventListener('input', () => { season().name = nameInput.value; renderTabs(); changed(); });
    typeInput.addEventListener('change', () => { season().type = typeInput.value; renderTabs(); changed(); });

    // O total só vale ao terminar de digitar: apagar o campo para trocar o número não pode descartar episódios.
    epsInput.addEventListener('change', () => {
        const n = parseInt(epsInput.value, 10);
        if (Number.isFinite(n) && n >= 1) setSeasonTotal(entry, active, n);
        renderAll(); changed();
    });

    renderAll();
    return openModal({ title: entry.title, iconName: 'layers', content });
}
