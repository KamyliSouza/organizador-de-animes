// Peças visuais do perfil público: os números do cabeçalho, as abas Biblioteca / Favoritos / Análises,
// o quadro "Assistindo agora" e os painéis de Favoritos e Análises. As contas ficam em js/domain/profileSummary.js.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { CATEGORY_CLASS, SECTIONS, isReading, sectionOf, statusLabel } from '../domain/entry.js';
import { NOW_LIMIT, PANES, nowProgress, nowTitle } from '../domain/profileSummary.js';
import { mediaCardHtml, posterPlaceholder, starsHtml } from './mediaCard.js';
import { reviewHtml } from './reviewBlock.js';

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Número + nome, em botão: "63 obras", "12 assistindo", "148 seguidores", "97 seguindo".
 * `attrs` = o atributo que diz o que o clique faz (data-goto ou data-conn).
 */
const counterButton = (n, label, attrs, title) => html`<button type="button" class="profile-counter" ${attrs} aria-label="${n} ${label}" title="${title}"><b>${n}</b><span>${label}</span></button>`;

/**
 * Os quatro números do cabeçalho. Obras e "assistindo" levam para a Biblioteca (já filtrada);
 * seguidores e seguindo abrem as listas de pessoas. Sem os números de seguidores (banco antigo), só os dois primeiros.
 */
export function countersHtml({ works, inProgress, inProgressName, followers = null, following = null }) {
    return html`<ul class="profile-counters" aria-label="Números do perfil" data-counters>
        <li>${counterButton(works, plural(works, 'obra', 'obras'), html`data-goto="library"`, 'Ver a biblioteca')}</li>
        <li>${counterButton(inProgress, inProgressName, html`data-goto="watching"`, 'Ver só as obras em andamento')}</li>
        ${followers != null ? html`
        <li>${counterButton(followers, plural(followers, 'seguidor', 'seguidores'), html`data-conn="followers"`, 'Ver quem segue')}</li>
        <li>${counterButton(following ?? 0, 'seguindo', html`data-conn="following"`, 'Ver quem é seguido')}</li>` : ''}
    </ul>`;
}

/** As abas Biblioteca / Favoritos / Análises, com o número de cada uma (da aba Anime/Mangá/Light Novel escolhida). */
export function paneTabsHtml({ active, counts }) {
    return html`<div class="pane-tabs glass-panel" role="tablist" aria-label="O que ver neste perfil">
        ${PANES.map((p) => html`
        <button type="button" role="tab" class="pane-tab" id="pane-tab-${p.id}" data-pane-tab="${p.id}"
            aria-selected="${String(p.id === active)}" aria-controls="profile-pane" tabindex="${p.id === active ? 0 : -1}">
            ${icon(p.icon, { size: 17 })}<span>${p.label}</span><span class="count" aria-label="${counts[p.id]} ${plural(counts[p.id], p.one, p.many)}">${counts[p.id]}</span>
        </button>`)}
    </div>`;
}

const cover = (entry) => html`${entry.coverImage
    ? html`<img src="${entry.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback ${isReading(entry) ? html`data-reading` : ''}>`
    : posterPlaceholder(isReading(entry))}`;

/**
 * "Assistindo agora": as primeiras obras em andamento da aba (cada uma abre os detalhes) e, se houver mais, "Ver todos".
 * `all` = todas as obras em andamento da aba, mais recentes primeiro.
 */
export function nowCardHtml(all, section) {
    const shown = all.slice(0, NOW_LIMIT);
    return html`<aside class="now-card glass-panel" data-now ${all.length ? '' : html`data-empty`} aria-labelledby="now-title">
        <h2 id="now-title">${icon('play', { size: 18 })} ${nowTitle(section)}${all.length ? html` <span class="count" aria-label="${all.length} ${plural(all.length, 'obra', 'obras')}">${all.length}</span>` : ''}</h2>
        ${all.length ? html`
        <ul class="now-list">
            ${shown.map((e) => html`<li>
                <button type="button" class="now-item" data-now-open="${e.id}" aria-label="Abrir detalhes de ${e.title}">
                    <span class="now-cover">${cover(e)}</span>
                    <span class="now-text"><span class="now-title">${e.title}</span><span class="now-progress">${nowProgress(e)}</span></span>
                </button>
            </li>`)}
        </ul>
        ${all.length > NOW_LIMIT ? html`<button type="button" class="button button-secondary button-sm now-all" data-now-all>Ver todos (${all.length})</button>` : ''}`
        : html`<p class="muted small">Nada em andamento nesta aba agora.</p>`}
    </aside>`;
}

const emptyPane = (iconName, title, text) => html`<div class="empty-state glass-panel" data-pane-empty>${icon(iconName, { size: 44 })}<h3>${title}</h3><p>${text}</p></div>`;

/** Aba Favoritos: as obras favoritas da aba escolhida, em cards (todas, sem limite). */
export function favoritesPaneHtml(favorites, section) {
    const label = SECTIONS[section]?.label || '';
    if (!favorites.length) return emptyPane('heart', 'Nenhum favorito por aqui', `Esta pessoa ainda não favoritou nenhuma obra de ${label}.`);
    return html`<section class="stack" data-favorites aria-labelledby="fav-title">
        <h2 id="fav-title" class="sr-only">Favoritos de ${label} <span class="count" aria-label="${favorites.length} ${plural(favorites.length, 'favorito', 'favoritos')}">${favorites.length}</span></h2>
        <div class="media-grid">${favorites.map((e) => mediaCardHtml(e, { readonly: true }))}</div>
    </section>`;
}

const reviewItem = (e) => html`
    <article class="feed-item glass-panel review-item" data-id="${e.id}">
        <div class="feed-work">
            <button type="button" class="feed-cover poster-button" data-action="cover" aria-label="Abrir detalhes de ${e.title}">${cover(e)}</button>
            <div class="feed-info">
                <h3 class="feed-title">${e.title}</h3>
                <div class="media-badges">
                    <span class="badge badge-${CATEGORY_CLASS[e.category] || 'anime'}">${e.category}</span>
                    <span class="badge badge-${e.status}">${statusLabel(e.status, sectionOf(e))}</span>
                </div>
                <div>${starsHtml(e.rating)}</div>
                <div><button type="button" class="link-button" data-action="details">${icon('book', { size: 14 })} Ver detalhes</button></div>
            </div>
        </div>
        ${reviewHtml(e.review, e.reviewSpoiler)}
    </article>`;

/** Aba Análises: o que a pessoa escreveu sobre as obras da aba escolhida (com spoiler escondido e texto longo recolhido). */
export function reviewsPaneHtml(reviews, section) {
    const label = SECTIONS[section]?.label || '';
    if (!reviews.length) return emptyPane('book', 'Nenhuma análise por aqui', `Esta pessoa ainda não escreveu análises de ${label}.`);
    return html`<section class="stack" data-reviews aria-labelledby="rev-title">
        <h2 id="rev-title" class="sr-only">Análises de ${label} <span class="count" aria-label="${reviews.length} ${plural(reviews.length, 'análise', 'análises')}">${reviews.length}</span></h2>
        ${reviews.map(reviewItem)}
    </section>`;
}
