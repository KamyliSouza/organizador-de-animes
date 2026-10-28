// Modais de leitura: detalhes (sinopse + anotações), agenda semanal e estatísticas.
import { el, html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { DAYS, DAY_LABELS, MINUTES_PER_EPISODE, SECTIONS, SECTION_KEYS, isReading, originLabel, progressOf, readSummary } from '../domain/entry.js';
import { computeStats, groupByAirDay } from '../domain/stats.js';
import { applyImageFallback, posterPlaceholder } from './mediaCard.js';
import { bindReviews, reviewHtml } from './reviewBlock.js';

export function openDetailsModal(entry) {
    const content = el(html`
        <div class="stack">
            <div class="synopsis-layout">
                <div class="poster">${entry.coverImage
                    ? html`<img src="${entry.coverImage}" alt="Capa de ${entry.title}" referrerpolicy="no-referrer" data-fallback>`
                    : posterPlaceholder(isReading(entry))}</div>
                <div class="stack" style="gap:10px">
                    ${isReading(entry) ? html`<p class="read-facts"><b>${readSummary(entry)}</b>${originLabel(entry) ? ` · ${originLabel(entry)}` : ''}</p>` : ''}
                    ${entry.genres.length ? html`<div class="row" style="gap:6px">${entry.genres.map((g) => html`<span class="badge">${g}</span>`)}</div>` : ''}
                    <p class="synopsis-text">${entry.description || 'Nenhuma descrição disponível.'}</p>
                </div>
            </div>
            ${entry.review ? html`
                <div class="stack" style="gap:6px">
                    <span class="field-label" style="color:var(--primary-text)">Análise</span>
                    ${reviewHtml(entry.review, entry.reviewSpoiler)}
                </div>` : ''}
            ${entry.notes ? html`
                <div class="stack" style="gap:6px">
                    <span class="field-label" style="color:var(--primary-text)">Anotações / Diário</span>
                    <p class="note-block">${entry.notes}</p>
                </div>` : ''}
            <div class="modal-footer"><button type="button" class="button button-secondary" data-modal-close>Fechar</button></div>
        </div>`);
    on(content, 'error', 'img[data-fallback]', (_, img) => applyImageFallback(img), true);
    bindReviews(content);
    return openModal({ title: entry.title, iconName: 'book', content });
}

/**
 * Agenda semanal: obras "Assistindo" por dia de lançamento.
 * @param {() => object[]} getEntries  Lista atual (relida a cada desenho).
 * @param {(entry:object)=>void} onIncrement  Chamado ao clicar em +1 Ep.
 */
export function openScheduleModal({ getEntries, onIncrement }) {
    const content = el(html`
        <div class="stack">
            <div class="schedule-grid" data-grid></div>
            <div class="modal-footer"><button type="button" class="button button-secondary" data-modal-close>Fechar</button></div>
        </div>`);

    function render() {
        const groups = groupByAirDay(getEntries());
        setHtml(content.querySelector('[data-grid]'), html`${DAYS.map((day) => html`
            <section class="day-col" aria-label="${DAY_LABELS[day]}">
                <h3>${DAY_LABELS[day]}<small>${groups[day].length} obra(s)</small></h3>
                ${groups[day].length === 0
                    ? html`<p class="muted small" style="font-style:italic;padding:6px 0">Sem lançamentos.</p>`
                    : groups[day].map((e) => {
                        const { watched, total } = progressOf(e);
                        return html`<div class="day-item" data-id="${e.id}">
                            <div style="min-width:0"><p class="truncate">${e.title}</p><small>Episódio: ${watched} / ${total}</small></div>
                            ${onIncrement ? html`<button type="button" class="button button-primary button-sm" data-inc aria-label="Marcar mais 1 episódio de ${e.title}">+1 Ep</button>` : ''}
                        </div>`;
                    })}
            </section>`)}`);
    }

    on(content, 'click', '[data-inc]', (_, btn) => {
        const entry = getEntries().find((e) => e.id === btn.closest('[data-id]').dataset.id);
        if (entry) { onIncrement(entry); render(); }
    });

    render();
    return openModal({ title: 'Agenda de lançamentos da semana', iconName: 'calendar', size: 'lg', content });
}

/** Parte de uma aba das estatísticas: o que cada seção mostra. */
function statsBody(s) {
    const reading = s.section === 'read';
    const cats = reading ? [['Mangá', 'seg-manga'], ['Light novel', 'seg-novel']] : [['Anime', 'seg-anime'], ['Filme', 'seg-filme'], ['Série', 'seg-serie']];
    const total = s.total || 1;
    return html`
        ${reading ? html`
        <div class="subpanel" style="flex-direction:row;align-items:center;justify-content:space-between">
            <div>
                <p class="field-label">Leitura total</p>
                <p style="font-size:1.4rem;font-weight:900;color:var(--primary-text)">${s.chapters} ${s.chapters === 1 ? 'capítulo' : 'capítulos'}</p>
                <p class="muted small">${s.volumes} ${s.volumes === 1 ? 'volume lido' : 'volumes lidos'}</p>
            </div>
            <span class="stat-icon">${icon('book', { size: 22 })}</span>
        </div>` : html`
        <div class="subpanel" style="flex-direction:row;align-items:center;justify-content:space-between">
            <div>
                <p class="field-label">Tempo total assistido (estimado)</p>
                <p style="font-size:1.4rem;font-weight:900;color:var(--primary-text)">${s.hours} horas <span class="muted small" style="font-weight:700">(${s.days} dias)</span></p>
                <p class="muted small">${s.episodes} episódios · ${MINUTES_PER_EPISODE} min cada</p>
            </div>
            <span class="stat-icon">${icon('hourglass', { size: 22 })}</span>
        </div>`}

        <div>
            <p class="field-label" style="margin-bottom:8px">Obras por categoria</p>
            <div class="stacked-bar" role="img" aria-label="Obras por categoria">
                ${cats.map(([c, cls]) => s.categories[c] ? html`<span class="${cls}" style="width:${(s.categories[c] / total) * 100}%"></span>` : '')}
            </div>
            <div class="legend">
                ${cats.filter(([c]) => s.categories[c]).map(([c, cls]) => html`<span><i class="${cls}"></i>${c}: ${Math.round((s.categories[c] / total) * 100)}%</span>`)}
                ${s.total === 0 ? html`<span>Sem obras ainda.</span>` : ''}
            </div>
        </div>

        <div>
            <p class="field-label" style="margin-bottom:8px">${reading ? 'Gêneros mais lidos' : 'Gêneros mais vistos'}</p>
            ${s.topGenres.length
                ? html`<div class="kv-list">${s.topGenres.map(([g, n]) => html`<div class="kv"><span>${g}</span><b>${n} ${n === 1 ? 'obra' : 'obras'}</b></div>`)}</div>`
                : html`<p class="muted small">Os gêneros aparecem quando você adiciona obras pela busca.</p>`}
        </div>`;
}

/**
 * Estatísticas em duas abas: Assistir (animes, filmes e séries) e Ler (mangás e light novels).
 * `section` é a aba que abre primeiro.
 */
export function openStatsModal(entries, { section = 'watch' } = {}) {
    let active = SECTIONS[section] ? section : 'watch';

    const content = el(html`
        <div class="stack">
            <div class="section-tabs" role="tablist" aria-label="Estatísticas por seção" data-tabs></div>
            <div class="stack" role="tabpanel" id="stats-panel" data-body></div>
            <div class="modal-footer"><button type="button" class="button button-secondary" data-modal-close>Fechar</button></div>
        </div>`);
    const tabs = content.querySelector('[data-tabs]');
    const body = content.querySelector('[data-body]');

    function render(focusTab = false) {
        const counts = Object.fromEntries(SECTION_KEYS.map((k) => [k, entries.filter((e) => (isReading(e) ? 'read' : 'watch') === k).length]));
        setHtml(tabs, html`${SECTION_KEYS.map((k) => html`
            <button type="button" role="tab" class="section-tab" id="stats-tab-${k}" data-section="${k}" aria-selected="${String(k === active)}" aria-controls="stats-panel" tabindex="${k === active ? 0 : -1}">
                ${icon(k === 'watch' ? 'play' : 'book', { size: 17 })}<span>${SECTIONS[k].label}</span><span class="count" aria-label="${counts[k]} obras">${counts[k]}</span>
            </button>`)}`);
        body.setAttribute('aria-labelledby', `stats-tab-${active}`);
        setHtml(body, statsBody(computeStats(entries, active)));
        if (focusTab) tabs.querySelector(`[data-section="${active}"]`)?.focus({ preventScroll: true });
    }

    on(content, 'click', '[data-section]', (_, tab) => { active = tab.dataset.section; render(true); });
    on(content, 'keydown', '[data-section]', (e, tab) => {
        const i = SECTION_KEYS.indexOf(tab.dataset.section);
        const next = e.key === 'ArrowRight' ? SECTION_KEYS[(i + 1) % SECTION_KEYS.length]
            : e.key === 'ArrowLeft' ? SECTION_KEYS[(i - 1 + SECTION_KEYS.length) % SECTION_KEYS.length]
                : e.key === 'Home' ? SECTION_KEYS[0] : e.key === 'End' ? SECTION_KEYS[SECTION_KEYS.length - 1] : null;
        if (!next) return;
        e.preventDefault();
        active = next;
        render(true);
    });

    render();
    return openModal({ title: 'Estatísticas detalhadas', iconName: 'chart', content });
}
