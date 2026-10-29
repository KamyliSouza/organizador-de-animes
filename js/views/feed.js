// Feed: o que as pessoas que eu sigo adicionaram, concluíram ou analisaram.
// Aba "Pedidos": quem pediu para seguir o meu perfil privado e espera a minha resposta.
// Não há atualização em tempo real: o feed carrega ao abrir e no botão "Atualizar".
import { config } from '../config.js';
import { html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { timeAgo } from '../core/time.js';
import { toast } from '../core/toast.js';
import { CATEGORY_CLASS, STATUSES, sectionOfCategory, statusLabel } from '../domain/entry.js';
import { backend, isCloud, setRequestCount, state } from '../services/session.js';
import { avatar, avatarSrc } from '../ui/avatar.js';
import { applyImageFallback, posterPlaceholder, starsHtml } from '../ui/mediaCard.js';
import { bindReviews, reviewHtml } from '../ui/reviewBlock.js';
import { roleBadge } from '../ui/roleBadge.js';

const PAGE = 30;

// O que cada pessoa fez com a obra, conforme o tipo de atividade e o status atual.
const VERBS = {
    added: { planned: 'quer ver', watching: 'começou a assistir', completed: 'concluiu', on_hold: 'colocou em espera', dropped: 'adicionou como dropado' },
    status: { planned: 'moveu para "Quero ver"', watching: 'está assistindo', completed: 'concluiu', on_hold: 'colocou em espera', dropped: 'dropou' },
    review: { _: 'escreveu uma análise de' },
};
// Mangás e light novels: o que muda é o verbo de "assistir" para "ler".
const READ_VERBS = {
    added: { planned: 'quer ler', watching: 'começou a ler', completed: 'concluiu a leitura', on_hold: 'colocou em espera', dropped: 'adicionou como dropado' },
    status: { planned: 'moveu para "Quero ler"', watching: 'está lendo', completed: 'concluiu a leitura', on_hold: 'colocou em espera', dropped: 'dropou' },
    review: { _: 'escreveu uma análise de' },
};
const verbOf = (item) => {
    const table = sectionOfCategory(item.category) === 'read' ? READ_VERBS : VERBS;
    return table[item.kind]?.[item.status] || table[item.kind]?._ || 'atualizou';
};

function feedItem(item) {
    const { person } = item;
    const status = STATUSES[item.status] || STATUSES.planned;
    const profileHref = `#/u/${person.username}`;
    return html`
    <article class="feed-item glass-panel" data-entry="${item.entryId}">
        <header class="feed-head">
            <a href="${profileHref}" class="feed-who" aria-label="Perfil de ${person.displayName}">${avatar(person.displayName, 42, avatarSrc(person))}</a>
            <div class="feed-meta">
                <p><a href="${profileHref}" class="feed-name">${person.displayName}</a>${roleBadge(person.role)} <span class="feed-verb">${verbOf(item)}</span></p>
                <p class="muted small"><time datetime="${item.at}">${timeAgo(item.at)}</time> · @${person.username}</p>
            </div>
        </header>
        <div class="feed-work">
            <div class="feed-cover">${item.coverImage
                ? html`<img src="${item.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback>`
                : posterPlaceholder(sectionOfCategory(item.category) === 'read')}</div>
            <div class="feed-info">
                <h3 class="feed-title">${item.title}</h3>
                <div class="media-badges">
                    <span class="badge badge-${CATEGORY_CLASS[item.category] || 'anime'}">${item.category}</span>
                    <span class="badge badge-${item.status}">${icon(status.icon, { size: 12 })} ${statusLabel(item.status, sectionOfCategory(item.category))}</span>
                </div>
                <div>${starsHtml(item.rating)}</div>
            </div>
        </div>
        ${reviewHtml(item.review, item.reviewSpoiler)}
    </article>`;
}

const requestRow = (r) => html`
    <li class="person-row request-row" data-id="${r.id}">
        <a class="person-link" href="#/u/${r.username}">
            ${avatar(r.displayName, 44, avatarSrc(r))}
            <span class="person-names"><span class="name-line"><b class="truncate">${r.displayName}</b>${roleBadge(r.role)}</span><span class="muted small truncate">@${r.username} · ${timeAgo(r.requestedAt)}</span></span>
        </a>
        <span class="request-actions">
            <button type="button" class="button button-primary button-sm" data-respond="accept" aria-label="Aceitar o pedido de ${r.displayName}">Aceitar</button>
            <button type="button" class="button button-ghost button-sm" data-respond="reject" aria-label="Recusar o pedido de ${r.displayName}">Recusar</button>
        </span>
    </li>`;

function tabsHtml(active, requests) {
    return html`
        <nav class="settings-tabs page-tabs" aria-label="Seções do feed">
            <a class="settings-tab" href="#/feed" ${active === 'feed' ? html`aria-current="page"` : ''}>${icon('activity', { size: 17 })}Atividade</a>
            <a class="settings-tab" href="#/feed/pedidos" ${active === 'requests' ? html`aria-current="page"` : ''}>${icon('userPlus', { size: 17 })}Pedidos${requests > 0 ? html`<span class="count-badge" data-requests-count>${requests}<span class="sr-only"> pendentes</span></span>` : ''}</a>
        </nav>`;
}

export function mount(root, ctx) {
    document.title = `${ctx.name === 'feed-requests' ? 'Pedidos para seguir' : 'Feed'} · ${config.siteName}`;
    if (!isCloud()) {
        setHtml(root, html`<div class="glass-panel empty-state">${icon('lock', { size: 44 })}<h3>O feed precisa do login ativado</h3>
            <p>Configure o Supabase em js/config.js (passo a passo no README.md).</p></div>`);
        return;
    }
    const active = ctx.name === 'feed-requests' ? 'requests' : 'feed';
    const be = backend();

    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('activity', { size: 14 })} Comunidade</span>
                <h1 style="margin-top:10px">${active === 'feed' ? 'Feed' : 'Pedidos para seguir'}</h1>
                <p class="lead">${active === 'feed' ? 'O que as pessoas que você segue andaram assistindo.' : 'Pessoas que pediram para seguir o seu perfil privado.'}</p>
            </div>
            ${active === 'feed' ? html`<div class="page-head-actions"><button type="button" class="button button-secondary" data-act="reload">${icon('refresh', { size: 17 })} Atualizar</button></div>` : ''}
        </header>
        <div data-tabs>${tabsHtml(active, state.requests)}</div>
        <div data-body aria-live="polite"></div>`);

    const body = root.querySelector('[data-body]');
    const tabsBox = root.querySelector('[data-tabs]');
    const offs = [bindReviews(root)];
    let alive = true;
    offs.push(() => { alive = false; });
    offs.push(on(root, 'error', 'img[data-fallback]', (_, img) => applyImageFallback(img), true));

    const errorBox = (err, fallback) => html`<div class="notice-box is-error" role="alert">${icon('alert')}<div>${messageOf(err, fallback)}
        <div class="notice-actions"><button type="button" class="button button-secondary button-sm" data-act="reload">Tentar de novo</button></div></div></div>`;

    // ------------------------------------------------------------------ atividade
    if (active === 'feed') {
        let items = [];
        let more = false;
        let loading = false;
        let token = 0;

        const paint = () => setHtml(body, items.length
            ? html`<div class="feed-list">${items.map(feedItem)}</div>
                ${more ? html`<div class="center" style="margin-top:6px"><button type="button" class="button button-secondary" data-act="more" ${loading ? 'disabled' : ''}>${loading ? html`${spinner(16)} Carregando...` : 'Carregar mais'}</button></div>` : ''}`
            : html`<div class="glass-panel empty-state">${icon('activity', { size: 44 })}<h3>Nada por aqui ainda</h3>
                <p>O feed mostra o que as pessoas que você segue adicionam, concluem ou analisam. Importações e episódios marcados não aparecem.</p>
                <a class="button button-secondary" href="#/explorar">${icon('compass', { size: 17 })} Encontrar perfis para seguir</a></div>`);

        async function load({ append = false } = {}) {
            const mine = ++token;
            loading = true;
            if (!append) setHtml(body, html`<div class="center muted" style="padding:40px 0">${spinner(26)}</div>`); else paint();
            try {
                const before = append && items.length ? { at: items[items.length - 1].at, id: items[items.length - 1].entryId } : null;
                const page = await be.follows.feed({ limit: PAGE, before });
                if (!alive || mine !== token) return;
                items = append ? [...items, ...page.filter((n) => !items.some((o) => o.entryId === n.entryId))] : page;
                more = page.length >= PAGE;
                loading = false;
                paint();
            } catch (err) {
                if (!alive || mine !== token) return;
                console.error(err);
                loading = false;
                if (append) { paint(); toast(messageOf(err, 'Não foi possível carregar mais.'), { type: 'error' }); }
                else setHtml(body, errorBox(err, 'Não foi possível carregar o feed.'));
            }
        }

        offs.push(on(root, 'click', '[data-act="reload"]', () => load()));
        offs.push(on(root, 'click', '[data-act="more"]', () => { if (!loading) load({ append: true }); }));
        load();
        return () => offs.forEach((off) => off());
    }

    // ------------------------------------------------------------------ pedidos
    let list = [];
    const paintRequests = () => {
        setRequestCount(list.length);
        setHtml(tabsBox, tabsHtml('requests', list.length));
        setHtml(body, list.length
            ? html`<ul class="person-list request-list glass-panel">${list.map(requestRow)}</ul>`
            : html`<div class="glass-panel empty-state">${icon('userCheck', { size: 44 })}<h3>Nenhum pedido pendente</h3>
                <p>Quando alguém pedir para seguir o seu perfil privado, o pedido aparece aqui e um número aparece no menu "Feed". Perfis públicos não precisam de aprovação.</p>
                ${state.profile && !state.profile.isPublic ? '' : html`<a class="button button-secondary" href="#/configuracoes/conta">${icon('lock', { size: 17 })} Tornar o perfil privado</a>`}</div>`);
    };

    setHtml(body, html`<div class="center muted" style="padding:40px 0">${spinner(26)}</div>`);
    be.follows.requests().then((rows) => { if (!alive) return; list = rows; paintRequests(); }).catch((err) => {
        if (!alive) return;
        console.error(err);
        setHtml(body, errorBox(err, 'Não foi possível carregar os pedidos.'));
    });

    offs.push(on(root, 'click', '[data-act="reload"]', () => location.reload()));
    offs.push(on(root, 'click', '[data-respond]', async (_, btn) => {
        const row = btn.closest('[data-id]');
        const person = list.find((r) => r.id === row.dataset.id);
        if (!person) return;
        const accept = btn.dataset.respond === 'accept';
        row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        try {
            await be.follows.respond(person.id, accept);
            if (!alive) return;
            list = list.filter((r) => r.id !== person.id);
            paintRequests();
            toast(accept ? `${person.displayName} agora segue você.` : 'Pedido recusado.', { type: 'success' });
        } catch (err) {
            console.error(err);
            row.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            toast(messageOf(err, 'Não foi possível responder ao pedido.'), { type: 'error' });
        }
    }));

    return () => offs.forEach((off) => off());
}
