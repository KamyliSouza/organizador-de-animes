// Perfil de uma pessoa: #/u/nome. Somente leitura (para a dona, é a prévia do que os outros veem).
// Perfil privado: quem não é seguidor aceito vê só nome, usuário e foto, e pode pedir para seguir.
import { config } from '../config.js';
import { copyText, html, on, setHtml } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { viewPalette } from '../core/palette.js';
import { refresh } from '../core/router.js';
import { toast } from '../core/toast.js';
import { SECTIONS, SECTION_KEYS, entriesInSections, normalizeSections, sectionOf } from '../domain/entry.js';
import { canAct, isStaff } from '../domain/roles.js';
import { backend, isCloud, myRole, state } from '../services/session.js';
import { avatar, avatarSrc } from '../ui/avatar.js';
import { openConnectionsModal } from '../ui/connectionsModal.js';
import { openDetailsModal, openStatsModal } from '../ui/infoModals.js';
import { mountLibraryBrowser } from '../ui/libraryBrowser.js';
import { bindFavoritesStrip, favoritesStripHtml } from '../ui/favoritesStrip.js';
import { openMemberModal } from '../ui/memberModal.js';
import { openReportModal } from '../ui/reportModal.js';
import { roleBadge } from '../ui/roleBadge.js';
import { bindSectionTabs, loadSection, sectionCounts, sectionTabsHtml } from '../ui/sectionTabs.js';
import { statTilesHtml } from '../ui/statTiles.js';

const link = (username) => `${location.origin}${location.pathname}#/u/${username}`;

const messageCard = (iconName, title, text, extra = '') => html`
    <div class="glass-panel empty-state">${icon(iconName, { size: 44 })}<h3>${title}</h3><p>${text}</p>${extra}</div>`;

/** Botão de seguir conforme a relação entre quem vê e o perfil. */
function followButton(profile) {
    if (profile.relation === 'self') return '';
    if (!state.user) {
        return html`<a class="button button-primary" href="#/entrar" data-follow-login>${icon('userPlus', { size: 17 })} Entrar para seguir</a>`;
    }
    switch (profile.relation) {
        case 'accepted':
            return html`<button type="button" class="button button-secondary" data-act="unfollow" title="Deixar de seguir">${icon('userCheck', { size: 17 })} Seguindo</button>`;
        case 'pending':
            return html`<button type="button" class="button button-secondary" data-act="cancel-request" title="Cancelar o pedido">${icon('clock', { size: 17 })} Pedido enviado</button>`;
        default:
            return html`<button type="button" class="button button-primary" data-act="follow">${icon('userPlus', { size: 17 })} ${profile.isPublic ? 'Seguir' : 'Pedir para seguir'}</button>`;
    }
}

const countButton = (kind, n, one, many) => html`<button type="button" class="link-button count-link" data-conn="${kind}"><b>${n}</b> ${n === 1 ? one : many}</button>`;

function lockedCard(profile) {
    const text = !state.user
        ? 'Entre na sua conta para pedir para seguir. Quando a pessoa aceitar, você passa a ver a biblioteca dela e as atividades no seu feed.'
        : profile.relation === 'pending'
            ? 'Seu pedido foi enviado. Assim que a pessoa aceitar, a biblioteca dela aparece aqui e as atividades entram no seu feed.'
            : 'Peça para seguir: quando a pessoa aceitar, você passa a ver a biblioteca dela e as atividades no seu feed.';
    return html`<div class="glass-panel empty-state" data-locked>${icon('lock', { size: 44 })}<h3>Este perfil é privado</h3><p>${text}</p></div>`;
}

export async function mount(root, ctx) {
    const username = String(ctx.params.username || '').toLowerCase();

    if (!isCloud()) {
        setHtml(root, messageCard('lock', 'Perfis públicos precisam do login ativado', 'Configure o Supabase em js/config.js (passo a passo no README.md).'));
        return;
    }

    setHtml(root, html`<div class="skeleton" style="min-height:120px"></div><div class="media-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`);

    const be = backend();
    let profile;
    let entries = [];
    try {
        profile = await be.profiles.getPublic(username);
        if (profile?.canView) {
            entries = profile.relation === 'self' ? await be.library.listMine() : await be.library.listPublic(username);
            // Na prévia do próprio perfil, mostra o mesmo que os visitantes veriam.
            if (profile.relation === 'self' && !profile.showNotes) entries = entries.map((e) => ({ ...e, notes: '' }));
            // Só as abas ativas aparecem (o banco já esconde as outras de quem visita; na prévia da dona fazemos o mesmo aqui).
            entries = entriesInSections(entries, profile.sections);
        }
    } catch (err) {
        console.error(err);
        setHtml(root, messageCard('alert', 'Não foi possível carregar este perfil', messageOf(err, 'Verifique sua conexão e tente de novo.'),
            html`<button type="button" class="button button-primary" data-retry>Tentar de novo</button>`));
        root.querySelector('[data-retry]').addEventListener('click', () => location.reload());
        return;
    }

    if (!profile) {
        setHtml(root, messageCard('user', 'Perfil não encontrado', `Não existe o perfil "@${username}".`,
            html`<a class="button button-secondary" href="#/explorar">${icon('compass', { size: 17 })} Explorar perfis</a>`));
        return;
    }

    const own = profile.relation === 'self';
    const keys = normalizeSections(profile.sections);          // abas ativas deste perfil
    const hiddenTabs = SECTION_KEYS.filter((k) => !keys.includes(k)).map((k) => SECTIONS[k].label);
    // Conta suspensa vista por outra pessoa: o banco já esconde nome, bio e foto. Só sobra o aviso.
    if (profile.suspended && !own) {
        document.title = `Perfil indisponível · ${config.siteName}`;
        setHtml(root, messageCard('lock', 'Perfil indisponível', 'Este perfil está temporariamente indisponível.',
            html`<div class="row" style="justify-content:center">
                <a class="button button-secondary" href="#/explorar">${icon('compass', { size: 17 })} Explorar perfis</a>
                ${isStaff(myRole()) ? html`<a class="button button-secondary" href="#/admin">${icon('shield', { size: 17 })} Abrir o painel</a>` : ''}
            </div>`));
        return;
    }
    const canView = profile.canView;
    // Enquanto você estiver neste perfil, a página usa as cores escolhidas pela pessoa (sai ao sair da tela).
    // Vale também para perfil privado ainda trancado: as cores não revelam nada da biblioteca.
    const restorePalette = profile.palette ? viewPalette(profile.palette) : null;
    document.title = `${profile.displayName} (@${profile.username}) · ${config.siteName}`;
    // Equipe gerencia por aqui (o banco confere o cargo de novo). Denunciar: qualquer pessoa com conta ativa, menos no próprio perfil.
    const canManage = !own && canAct(myRole(), profile.role);
    const canReport = !own && Boolean(state.user) && !state.access.suspended;

    setHtml(root, html`
        ${own ? html`<div class="notice-box">${icon(profile.isPublic ? 'globe' : 'lock')}<div>
            <strong>Prévia do seu perfil.</strong> ${profile.isPublic ? 'É assim que outras pessoas veem.' : 'Ele está privado: só quem você aprovar vê a biblioteca.'}
            ${hiddenTabs.length ? html`<span data-hidden-tabs>Abas escondidas de outras pessoas: ${hiddenTabs.join(', ')}.</span> ` : ''}
            <a href="#/configuracoes">Editar perfil</a> · <a href="#/configuracoes/conta">Privacidade</a></div></div>` : ''}
        <header class="profile-head glass-panel">
            ${avatar(profile.displayName || profile.username, 84, avatarSrc(profile))}
            <div class="profile-info">
                <h1>${profile.displayName}${roleBadge(profile.role)}</h1>
                <p class="handle">@${profile.username}${!profile.isPublic ? html` <span class="badge badge-muted" title="Perfil privado">${icon('lock', { size: 11 })} Privado</span>` : ''}</p>
                ${canView && profile.bio ? html`<p class="bio">${profile.bio}</p>` : ''}
                ${canView && profile.followersCount != null ? html`<p class="follow-counts">${countButton('followers', profile.followersCount, 'seguidor', 'seguidores')} · ${countButton('following', profile.followingCount ?? 0, 'seguindo', 'seguindo')}</p>` : ''}
            </div>
            <div class="profile-actions">
                ${followButton(profile)}
                ${canView ? html`
                <button type="button" class="button button-secondary" data-act="copy">${icon('link', { size: 17 })} Copiar link</button>
                <button type="button" class="button button-secondary" data-act="stats">${icon('chart', { size: 17 })} Estatísticas</button>` : ''}
                ${canManage ? html`<button type="button" class="button button-secondary" data-act="manage">${icon('shield', { size: 17 })} Gerenciar</button>` : ''}
                ${canReport ? html`<button type="button" class="button button-ghost" data-act="report">${icon('flag', { size: 17 })} Denunciar</button>` : ''}
            </div>
        </header>
        ${canView ? html`
        <div data-sections ${keys.length < 2 ? html`hidden` : ''}></div>
        <div id="section-panel" class="stack" data-panel ${keys.length < 2 ? '' : html`role="tabpanel"`}>
            <div data-tiles></div>
            <div data-favorites-wrap></div>
            <div data-browser class="stack"></div>
        </div>` : lockedCard(profile)}`);

    const offs = [];
    let browser = null;
    let switchSectionRef = null;     // troca de aba (definida abaixo, usada pelo aviso "também há resultados em...")

    if (canView) {
        const tiles = root.querySelector('[data-tiles]');
        const sectionsEl = root.querySelector('[data-sections]');
        const panel = root.querySelector('[data-panel]');
        const favWrap = root.querySelector('[data-favorites-wrap]');

        // Aba inicial: a que a pessoa usou por último; se não estiver ativa neste perfil ou estiver vazia, abre a primeira ativa que tiver obras.
        const counts = sectionCounts(entries);
        const tabsOn = keys.length > 1;                    // com uma única aba ativa o seletor some
        let section = loadSection();
        if (!keys.includes(section)) section = keys[0];
        if (counts[section] === 0) section = keys.find((k) => counts[k] > 0) || section;

        // Obras fixadas pela pessoa na aba atual: todas aparecem, numa faixa com rolagem lateral
        const strip = bindFavoritesStrip(favWrap);
        offs.push(() => strip.destroy());
        const paintFavorites = () => {
            setHtml(favWrap, favoritesStripHtml(entries.filter((e) => e.favorite && sectionOf(e) === section), section));
            strip.update();
        };
        const paintTabs = () => {
            if (!tabsOn) { panel.removeAttribute('aria-labelledby'); return; }
            setHtml(sectionsEl, sectionTabsHtml({ active: section, counts, panelId: 'section-panel', keys }));
            panel.setAttribute('aria-labelledby', `tab-${section}`);
        };
        const paintTiles = (status = browser?.getStatus() ?? 'all') => setHtml(tiles, statTilesHtml(entries, { active: status, section }));

        browser = mountLibraryBrowser(root.querySelector('[data-browser]'), {
            entries, readonly: true, section,
            actions: { details: (entry) => openDetailsModal(entry) },
            onStatusChange: (status) => paintTiles(status),
            onSectionRequest: (next) => switchSectionRef?.(next),
        });
        paintTabs();
        paintTiles();
        paintFavorites();

        const switchSection = (next) => {
            if (!keys.includes(next) || next === section) return;
            section = next;
            browser.setSection(section);
            paintTabs();
            paintTiles();
            paintFavorites();
        };
        switchSectionRef = switchSection;
        if (tabsOn) offs.push(bindSectionTabs(sectionsEl, switchSection, keys));
        // Os cards com os números filtram a lista pelo status correspondente e rolam até ela.
        offs.push(on(tiles, 'click', '[data-stat]', (_, btn) => {
            browser.setStatus(btn.dataset.stat);
            tiles.querySelector(`[data-stat="${btn.dataset.stat}"]`)?.focus({ preventScroll: true });
            browser.scrollToList();
        }));
        offs.push(on(root, 'click', '[data-favorites] [data-action="details"], [data-favorites] [data-action="cover"]', (_, btn) => {
            const entry = entries.find((e) => e.id === btn.closest('[data-id]')?.dataset.id);
            if (entry) openDetailsModal(entry);
        }));
        offs.push(on(root, 'click', '[data-act="stats"]', () => openStatsModal(entries, { section, sections: keys })));
    }

    async function run(btn, task, okMessage) {
        btn.disabled = true;
        try {
            await task();
            if (okMessage) toast(okMessage, { type: 'success' });
            refresh();     // remonta a tela: a relação mudou (e, se foi aceita, a biblioteca passa a aparecer)
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            toast(messageOf(err, 'Não foi possível concluir.'), { type: 'error' });
        }
    }

    offs.push(on(root, 'click', '[data-act]', async (_, btn) => {
        switch (btn.dataset.act) {
            case 'copy': {
                const ok = await copyText(link(profile.username));
                toast(ok ? 'Link copiado!' : 'Não foi possível copiar o link.', { type: ok ? 'success' : 'error' });
                break;
            }
            case 'follow':
                await run(btn, async () => { profile.relation = await be.follows.follow(profile.username); },
                    profile.isPublic ? `Você agora segue @${profile.username}.` : 'Pedido enviado! Volte aqui depois para ver se a pessoa aceitou.');
                break;
            case 'unfollow': {
                const yes = await confirmDialog({ title: 'Deixar de seguir', message: `Deixar de seguir @${profile.username}? ${profile.isPublic ? '' : 'Como o perfil é privado, você precisaria pedir de novo.'}`.trim(), confirmLabel: 'Deixar de seguir', danger: true });
                if (yes) await run(btn, () => be.follows.unfollow(profile.username), 'Você deixou de seguir.');
                break;
            }
            case 'cancel-request': {
                const yes = await confirmDialog({ title: 'Cancelar pedido', message: `Cancelar o pedido para seguir @${profile.username}?`, confirmLabel: 'Cancelar pedido', cancelLabel: 'Manter', danger: true });
                if (yes) await run(btn, () => be.follows.unfollow(profile.username), 'Pedido cancelado.');
                break;
            }
            case 'report':
                openReportModal({ person: profile, send: (u, reason, details) => be.moderation.report(u, reason, details) });
                break;
            case 'manage':
                openMemberModal({ member: profile, actorRole: myRole(), moderation: be.moderation, onChanged: () => refresh() });
                break;
            default: break;
        }
    }));

    offs.push(on(root, 'click', '[data-conn]', (_, btn) => {
        openConnectionsModal({ username: profile.username, kind: btn.dataset.conn, own, be, onChanged: () => refresh() });
    }));

    return () => { offs.forEach((off) => off()); browser?.destroy(); restorePalette?.(); };
}
