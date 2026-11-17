// "Casca" do site: navbar, barra inferior (celular) e rodapé.
import { config } from '../config.js';
import { html, on, setHtml } from '../core/dom.js';
import { brandKanji, icon } from '../core/icons.js';
import { currentPath, navigate, onRouteChange } from '../core/router.js';
import { currentTheme, onThemeChange, toggleTheme } from '../core/theme.js';
import { timeAgo } from '../core/time.js';
import { onConnectionChange } from '../core/online.js';
import { applyUpdate, installKind, onPwaChange, promptInstall, updateReady } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { messageOf } from '../core/errors.js';
import { AUTO_SUSPEND_DAYS, STRIKE_LIMIT, strikeCountText } from '../domain/access.js';
import { SITE_VERSION } from '../domain/changelog.js';
import { state, isCloud, myRole, onSessionChange, refreshSession } from '../services/session.js';
import { accountMenuHtml, bindAccountMenu, captureAccountFocus, closeAccountMenu } from './accountMenu.js';
import { mountPageBar } from './pageBar.js';
import { hasLibraryHere, requestNewWork, showsNewWork } from './newWork.js';
import { openPatchNotesModal } from './patchNotesModal.js';
import { SECTION_EVENT, loadSection } from './sectionTabs.js';
import { requestShortcut, shortcutsFor } from './shortcuts.js';
import { bindYouSheet, closeYouSheet, isYouOpen, youSheetHtml, youTabHtml } from './youSheet.js';
import { SIDE_ID, isSideMenuOpen, setSideMenuOpen, showsSideMenu, sideMenuHtml } from './sideMenu.js';

const isActive = (path, ...prefixes) => prefixes.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/')));

function navModel() {
    const cloud = isCloud();
    const user = state.user;
    const path = currentPath();

    const items = [
        { href: '#/', label: user || !cloud ? 'Biblioteca' : 'Início', icon: 'film', active: isActive(path, '/') },
    ];
    if (cloud && user) items.push({ href: '#/feed', label: 'Feed', icon: 'activity', active: isActive(path, '/feed'), badge: state.requests });
    if (cloud) items.push({ href: '#/explorar', label: 'Explorar', icon: 'compass', active: isActive(path, '/explorar', '/u') });
    // O Painel da equipe (moderação, administração e Dona) fica no menu do avatar, junto da conta (js/ui/accountMenu.js).

    // Perfil, configurações, entrar e o resto da conta ficam no último item da barra de baixo ("Você", ui/youSheet.js) e, no computador, no avatar do topo.

    return { items, cloud, user };
}

/** Bolinha com o número de pedidos de "seguir" esperando resposta (some quando é 0). */
const badge = (item) => (item.badge > 0
    ? html`<span class="nav-badge" data-badge>${item.badge > 99 ? '99+' : item.badge}<span class="sr-only"> ${item.badge === 1 ? 'pedido para seguir' : 'pedidos para seguir'}</span></span>`
    : '');

function renderNav(nav) {
    const { items, cloud, user } = navModel();
    const dark = currentTheme() === 'dark';
    if (!(cloud && user)) closeAccountMenu();
    document.body.classList.toggle('nav-no-active', !items.some((i) => i.active));      // telas fora dos três links (Configurações, Painel, Perfil…): o título fica sempre na barra
    document.body.classList.toggle('has-side-toggle', showsSideMenu(currentPath()));   // saiu da conta: não deixa um "aberto" esquecido para a próxima pessoa que entrar

    setHtml(nav, html`
        <div class="site-nav-inner">
            ${showsSideMenu(currentPath()) ? html`<button type="button" class="icon-button side-toggle" data-side-toggle aria-expanded="${String(isSideMenuOpen())}" aria-controls="${SIDE_ID}" aria-label="Menu lateral" title="Mostrar ou esconder o menu lateral">${icon('panelLeft', { size: 20 })}</button>` : ''}
            <a class="brand" href="#/" aria-label="${config.siteName} — início">
                <span class="brand-mark">${brandKanji(28)}</span>
                <span class="brand-text">${config.siteName}</span>
            </a>
            <nav class="nav-links" aria-label="Principal">
                ${items.map((i) => html`<a class="nav-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 17 })}<span class="nav-text">${i.label}</span>${badge(i)}</a>`)}
            </nav>
            <div class="nav-page" data-nav-page hidden></div>
            <span class="nav-spacer"></span>
            <div class="nav-page-actions" data-nav-page-actions hidden></div>
            <div class="nav-actions">
                <button type="button" class="icon-button" data-theme-toggle aria-label="${dark ? 'Usar tema claro' : 'Usar tema escuro'}" title="${dark ? 'Tema claro' : 'Tema escuro'}">${icon(dark ? 'sun' : 'moon', { size: 20 })}</button>
                ${showsNewWork(currentPath()) ? html`<button type="button" class="button button-primary new-work-top" data-new-work aria-haspopup="dialog" title="Nova obra">${icon('plus', { size: 18 })}<span class="new-work-label">Nova obra</span></button>` : ''}
                ${cloud && user
                    ? accountMenuHtml({ profile: state.profile, user, role: myRole(), path: currentPath() })
                    : html`<span class="nav-account row" style="gap:8px;flex-wrap:nowrap">
                        ${!cloud
                            ? html`<a class="button button-secondary button-sm" href="#/configuracoes">${icon('sliders', { size: 16 })}Ajustes</a>`
                            : html`
                                <a class="button button-ghost button-sm" href="#/entrar">Entrar</a>
                                <a class="button button-primary button-sm" href="#/criar-conta">Criar conta</a>`}
                    </span>`}
            </div>
        </div>`);
}

function youContext() {
    const { cloud, user } = navModel();
    return { cloud, user, profile: state.profile, role: myRole(), path: currentPath() };
}

function renderTabBar(bar) {
    const { items } = navModel();
    const withNew = showsNewWork(currentPath());
    document.body.classList.toggle('has-tabbar-new', withNew);
    // O redesenho não tira o teclado do item em que ele está (nem dos botões "Nova obra" e "Você").
    const active = document.activeElement;
    const keep = active instanceof Element && bar.contains(active)
        ? (active.closest('[data-new-work]') ? '[data-new-work]' : active.closest('[data-you-toggle]') ? '[data-you-toggle]' : active.getAttribute('href') ? `a.tab-link[href="${active.getAttribute('href')}"]` : null)
        : null;
    // "Nova obra" fica no meio da barra (v1.33): com Biblioteca, Feed, Explorar e "Você" ela vem entre o Feed e o Explorar.
    const mid = withNew ? Math.floor((items.length + 2) / 2) : items.length;
    const link = (i) => html`
        <a class="tab-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}><span class="tab-ico">${icon(i.icon, { size: 20 })}</span><span>${i.label}</span>${badge(i)}</a>`;
    setHtml(bar, html`${items.slice(0, mid).map(link)}
        ${withNew ? html`<button type="button" class="tab-link tab-new" data-new-work aria-haspopup="dialog"><span class="tab-ico">${icon('plus', { size: 20 })}</span><span>Nova obra</span></button>` : ''}
        ${items.slice(mid).map(link)}
        ${youTabHtml({ ...youContext(), open: isYouOpen() })}`);
    if (keep) bar.querySelector(keep)?.focus({ preventScroll: true });
}

/** A folha "Você" (celular): só existe no HTML enquanto está aberta; o foco volta ao mesmo item depois de cada redesenho (tema, sessão...). */
function renderYou(host) {
    if (!host) return;
    const active = document.activeElement;
    const items = [...host.querySelectorAll('[data-you-item]')];
    const index = active instanceof Element && host.contains(active) ? items.indexOf(active) : -1;
    if (!isYouOpen()) { setHtml(host, ''); return; }
    setHtml(host, youSheetHtml({
        ...youContext(),
        dark: currentTheme() === 'dark',
        canLibrary: hasLibraryHere(currentPath()),          // quem tem biblioteca (modo local ou conta logada) tem Agenda e Estatísticas
        showAgenda: shortcutsFor(loadSection()).includes('schedule'),
        install: installKind(),                          // 'prompt' | 'ios' | 'none' (core/pwa.js)
        update: updateReady(),
    }));
    if (index >= 0) host.querySelectorAll('[data-you-item]')[index]?.focus({ preventScroll: true });
}

/** O conteúdo, o rodapé e os avisos ganham a altura exata da barra inferior (texto grande, tela baixa, área segura do aparelho). */
function watchTabBarHeight(tabBar) {
    const sync = () => {
        const r = tabBar.getBoundingClientRect();
        if (!r.height) { document.documentElement.style.removeProperty('--tabbar-h'); return; }   // barra escondida (computador)
        document.documentElement.style.setProperty('--tabbar-h', `${Math.ceil(r.height)}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(tabBar);
    return sync;
}

/**
 * Menu lateral (computador, opcional). Só é redesenhado quando muda o que ele mostra (tela, aba lembrada, pedidos para seguir, aberto/fechado),
 * para o teclado não perder o lugar. O CSS decide se cabe na tela (só em telas largas).
 */
let sideKey = null;
function renderSide(region) {
    if (!region) return;
    const show = showsSideMenu(currentPath()) && isSideMenuOpen();
    document.body.classList.toggle('has-sidemenu', show);
    const section = loadSection();
    const { items } = navModel();
    const key = show ? JSON.stringify([currentPath(), section, items.map((i) => [i.href, i.badge || 0])]) : '';
    if (key === sideKey) return;
    sideKey = key;
    const active = document.activeElement;
    const focusSel = active instanceof Element && region.contains(active)
        ? (active.dataset.shortcut ? `[data-shortcut="${active.dataset.shortcut}"]` : active.getAttribute('href') ? `a.side-link[href="${active.getAttribute('href')}"]` : null)
        : null;
    setHtml(region, show ? sideMenuHtml({ items, section, badge }) : '');
    if (focusSel) region.querySelector(focusSel)?.focus({ preventScroll: true });
}

function renderFooter(footer) {
    setHtml(footer, html`
        ${installKind() !== 'none' || updateReady() ? html`<p class="footer-actions">
            ${updateReady() ? html`<button type="button" class="button button-primary" data-update>${icon('refresh', { size: 18 })}<span>Atualizar o site</span></button>` : ''}
            ${installKind() !== 'none' ? html`<button type="button" class="button button-secondary" data-install>${icon('download', { size: 18 })}<span>Instalar o app</span></button>` : ''}
        </p>` : ''}
        <p>© ${new Date().getFullYear()} ${config.siteName}. Feito para organizar e compartilhar animes.
        <button type="button" class="version-button" data-patch-notes aria-haspopup="dialog" title="Ver as novidades do site">v${SITE_VERSION}<span class="sr-only"> — ver as novidades do site</span></button></p>
        <p>Dados das obras: MyAnimeList (via Jikan), AniList${config.tmdbApiKey ? ' e TMDB' : ''}.
        ${config.repoUrl ? html` · <a href="${config.repoUrl}" target="_blank" rel="noopener noreferrer">Ver código-fonte</a>` : ''}</p>
        ${config.tmdbApiKey ? html`<p class="small">Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>` : ''}`);
}

/**
 * Avisos do site no topo: os avisos (strikes) da equipe para esta conta e o aviso escrito pela administração.
 * Conta suspensa não passa por aqui: ela vê só a tela de suspensão (ui/suspendedScreen.js).
 * O banner de avisos é fixo: aparece em todas as telas e não dá para fechar; some quando a equipe retira os avisos.
 */
function renderNotice(region) {
    if (!region) return;
    const member = isCloud() && state.user && !state.access.suspended;
    const strikes = member ? state.access.strikes : [];
    const text = isCloud() ? state.site.announcement : '';
    setHtml(region, strikes.length || text ? html`
        <div class="site-notice-inner">
            ${strikes.length ? html`<div class="notice-box is-warn strike-notice" role="status" data-strike-notice>${icon('alert')}<div>
                <strong>Você tem ${strikeCountText(strikes.length)} avisos da equipe.</strong>
                No ${STRIKE_LIMIT}º aviso, a conta é suspensa por ${AUTO_SUSPEND_DAYS} dias.
                <ul class="strike-list">${strikes.map((s) => html`<li>${s.reason}${s.at ? html` <span class="muted small">· ${timeAgo(s.at)}</span>` : ''}</li>`)}</ul>
            </div></div>` : ''}
            ${text ? html`<div class="notice-box site-announcement" role="status">${icon('info')}<div>${text}</div></div>` : ''}
        </div>` : '');
}

export function mountChrome({ nav, tabBar, footer, notice, side, main }) {
    let pageBar = null;
    const youHost = document.createElement('div');       // a folha "Você" (celular) fica logo antes da barra de baixo, na ordem do teclado
    youHost.id = 'you-host';
    tabBar.before(youHost);
    const paint = () => {
        const restoreFocus = captureAccountFocus(nav);
        // O redesenho do topo não tira o teclado dos botões "Nova obra" e "Menu lateral".
        const active = document.activeElement;
        const keepFocus = active instanceof Element && nav.contains(active)
            ? (active.closest('[data-new-work]') ? '[data-new-work]' : active.closest('[data-side-toggle]') ? '[data-side-toggle]' : null)
            : null;
        renderNav(nav); renderTabBar(tabBar); renderYou(youHost); renderNotice(notice); renderSide(side);
        restoreFocus();
        if (keepFocus) nav.querySelector(keepFocus)?.focus({ preventScroll: true });
        syncTabBar();
        pageBar?.sync();
    };
    const syncTabBar = watchTabBarHeight(tabBar);
    if (main) pageBar = mountPageBar({ nav, main, sideOpen: () => showsSideMenu(currentPath()) && isSideMenuOpen() });
    paint();
    renderFooter(footer);
    on(footer, 'click', '[data-patch-notes]', () => openPatchNotesModal());
    on(footer, 'click', '[data-install]', () => promptInstall());
    on(footer, 'click', '[data-update]', () => applyUpdate());
    onPwaChange(() => { renderFooter(footer); renderYou(youHost); syncTabBar(); });     // pode instalar / há versão nova
    on(nav, 'click', '[data-new-work]', () => requestNewWork());
    on(tabBar, 'click', '[data-new-work]', () => requestNewWork());
    on(nav, 'click', '[data-side-toggle]', () => { setSideMenuOpen(!isSideMenuOpen()); paint(); });
    if (side) on(side, 'click', '[data-shortcut]', (_, btn) => requestShortcut(btn.dataset.shortcut));
    window.addEventListener(SECTION_EVENT, () => renderSide(side));     // Agenda só existe na aba Anime

    // Mudou de tela: o menu da conta fecha. Um aviso de rota para a MESMA tela (acontece no começo, enquanto o site termina de abrir) só redesenha.
    let lastPath = currentPath();
    onRouteChange(() => {
        const now = currentPath();
        if (now !== lastPath) { lastPath = now; closeAccountMenu(); closeYouSheet(); }
        paint();
    });
    onSessionChange(paint);
    onThemeChange(paint);
    onConnectionChange(paint);      // sem internet some o "Nova obra" (a biblioteca fica só para leitura)

    bindAccountMenu(nav);
    on(nav, 'click', '[data-theme-toggle]', () => toggleTheme());
    const logout = async (btn) => {
        btn.disabled = true;
        try {
            await state.backend.auth.signOut();
            closeYouSheet();
            await refreshSession();
            navigate('/');
            toast('Você saiu da conta.', { type: 'info' });
        } catch (err) {
            btn.disabled = false;
            toast(messageOf(err), { type: 'error' });
        }
    };
    on(nav, 'click', '[data-logout]', (ev, btn) => logout(btn));
    bindYouSheet({
        bar: tabBar, host: youHost,
        repaint: () => { renderTabBar(tabBar); renderYou(youHost); syncTabBar(); },
        actions: { shortcut: requestShortcut, theme: toggleTheme, logout, notes: openPatchNotesModal, install: promptInstall, update: applyUpdate },
    });
}
