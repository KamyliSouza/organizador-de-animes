// "Você": a folha que abre pelo último item da barra de baixo (celular). Ela concentra o que antes ficava na barra de cima:
// quem está logada (foto, nome, @usuário), os atalhos da biblioteca (Agenda e Estatísticas), perfil, Personalização, Configurações,
// Painel da equipe, tema claro/escuro, Sair e a versão do site. Só existe até 45em; no computador o menu da conta continua sendo o do avatar (accountMenu.js).
// Acessibilidade: o botão da barra tem aria-haspopup="dialog" e aria-expanded; a folha é um role="dialog" (não modal: a barra de baixo segue ao alcance).
// Teclado: Enter/Espaço abrem e levam o foco ao primeiro item; Esc fecha e devolve o foco ao botão; clicar fora, escolher um item e trocar de tela também fecham.
// O tema é um interruptor (role="switch" + aria-checked); o estado não depende só de cor (a bolinha muda de lado).
import { config } from '../config.js';
import { html, on } from '../core/dom.js';
import { brandKanji, icon } from '../core/icons.js';
import { accountMenuItems, isAccountPath } from '../domain/accountMenu.js';
import { SITE_VERSION } from '../domain/changelog.js';
import { avatar, avatarSrc } from './avatar.js';
import { roleBadge } from './roleBadge.js';

export const YOU_ID = 'you-sheet';
const MOBILE = '(max-width: 45em)';

let sheetOpen = false;      // guardado aqui (e não só no HTML) porque a barra e a folha são redesenhadas de tempos em tempos

export const isYouOpen = () => sheetOpen;
/** Fecha sem mexer na tela (o próximo desenho já sai fechado): usado ao trocar de rota e ao sair da conta. */
export function closeYouSheet() { sheetOpen = false; }

/** Quem é a pessoa: nome, @usuário, foto. */
function who({ cloud, user, profile }) {
    if (cloud && user) {
        const name = profile?.displayName || profile?.username || user.email || '';
        return { kind: 'user', name, username: profile?.username || '', src: avatarSrc(profile) };
    }
    return { kind: cloud ? 'visitor' : 'local', name: cloud ? 'Visitante' : 'Modo local', username: '', src: '' };
}

/** O item "Você" da barra de baixo. */
export function youTabHtml({ cloud, user, profile, path, open }) {
    const w = who({ cloud, user, profile });
    const under = (...bases) => bases.some((b) => path === b || path.startsWith(b + '/'));
    const current = w.kind === 'user' ? (isAccountPath(path, w.username) || under('/admin'))
        : cloud ? under('/entrar', '/criar-conta', '/recuperar', '/nova-senha')
            : under('/configuracoes');
    const label = w.kind === 'user' ? 'Você' : (cloud ? 'Conta' : 'Mais');
    const ico = w.kind === 'user' ? avatar(w.name, 26, w.src) : icon(cloud ? 'user' : 'more', { size: 20 });
    return html`<button type="button" class="tab-link tab-you" data-you-toggle aria-haspopup="dialog" aria-expanded="${String(open)}" aria-controls="${YOU_ID}" ${current ? html`aria-current="page"` : ''}><span class="tab-ico">${ico}</span><span>${label}</span></button>`;
}

/** A folha aberta. Vazia quando fechada. */
export function youSheetHtml({ cloud, user, profile, role, path, dark, canLibrary, showAgenda }) {
    const w = who({ cloud, user, profile });
    const links = w.kind === 'user'
        ? accountMenuItems({ username: w.username, role, path })
        : (!cloud
            ? [{ id: 'settings', href: '#/configuracoes', label: 'Ajustes', icon: 'sliders', current: path === '/configuracoes' || path.startsWith('/configuracoes/') }]
            : [
                { id: 'login', href: '#/entrar', label: 'Entrar', icon: 'logIn', current: path === '/entrar' },
                { id: 'signup', href: '#/criar-conta', label: 'Criar conta', icon: 'userPlus', current: path === '/criar-conta' },
            ]);
    return html`
        <div class="you-scrim" data-you-close></div>
        <div class="you-sheet" id="${YOU_ID}" role="dialog" aria-label="Menu da conta" data-you-sheet>
            <div class="account-head">
                ${w.kind === 'user' ? avatar(w.name, 44, w.src) : html`<span class="you-head-ico" aria-hidden="true">${icon(cloud ? 'user' : 'film', { size: 22 })}</span>`}
                <div class="account-who">
                    <strong class="truncate">${w.name}</strong>
                    ${w.username ? html`<span class="account-user truncate">@${w.username}</span>` : ''}
                    ${w.kind === 'user' ? roleBadge(role) : ''}
                </div>
            </div>
            <div class="account-list">
                ${canLibrary ? html`
                    ${showAgenda ? html`<button type="button" class="account-item" data-you-item data-you-shortcut="schedule">${icon('calendar', { size: 18 })}<span>Agenda</span></button>` : ''}
                    <button type="button" class="account-item" data-you-item data-you-shortcut="stats">${icon('chart', { size: 18 })}<span>Estatísticas</span></button>
                    <div class="account-sep" role="separator"></div>` : ''}
                ${links.map((i) => html`<a class="account-item" data-you-item href="${i.href}" ${i.current ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 18 })}<span>${i.label}</span></a>`)}
                <button type="button" class="account-item you-switch" role="switch" aria-checked="${String(dark)}" data-you-item data-you-theme>${icon(dark ? 'moon' : 'sun', { size: 18 })}<span>Tema escuro</span><span class="you-track" aria-hidden="true"></span></button>
                ${w.kind === 'user' ? html`
                    <div class="account-sep" role="separator"></div>
                    <button type="button" class="account-item" data-you-item data-you-logout>${icon('logOut', { size: 18 })}<span>Sair da conta</span></button>` : ''}
            </div>
            <div class="you-foot">
                <span class="you-foot-brand"><span class="you-foot-mark" aria-hidden="true">${brandKanji(22)}</span><span>${config.siteName}</span></span>
                <button type="button" class="version-button" data-you-item data-you-notes aria-haspopup="dialog" title="Ver as novidades do site">v${SITE_VERSION}<span class="sr-only"> — ver as novidades do site</span></button>
            </div>
        </div>`;
}

/**
 * Liga a barra e a folha. `bar` é a barra de baixo (redesenhada de tempos em tempos) e `host` o lugar da folha: os ouvintes ficam neles.
 * `repaint()` redesenha os dois; `actions` = { shortcut(name), theme(), logout(btn), notes() }. Devolve a função que desfaz tudo.
 */
export function bindYouSheet({ bar, host, repaint, actions }) {
    const toggleBtn = () => bar.querySelector('[data-you-toggle]');
    const items = () => [...host.querySelectorAll('[data-you-item]')];

    function setOpen(open, { focus = null } = {}) {
        if (sheetOpen === open && !focus) return;
        sheetOpen = open;
        repaint();
        if (open && focus === 'first') items()[0]?.focus({ preventScroll: true });
        if (!open && focus === 'button') toggleBtn()?.focus({ preventScroll: true });
    }

    const offs = [];
    offs.push(on(bar, 'click', '[data-you-toggle]', (ev) => {
        const open = !sheetOpen;
        // Enter/Espaço chegam como clique sem ponteiro (detail 0): aí o foco vai para o primeiro item da folha.
        setOpen(open, { focus: open ? (ev.detail === 0 ? 'first' : null) : null });
    }));
    offs.push(on(host, 'click', '[data-you-close]', () => setOpen(false)));
    offs.push(on(host, 'click', '[data-you-shortcut]', (_, btn) => { setOpen(false); actions.shortcut(btn.dataset.youShortcut); }));
    offs.push(on(host, 'click', '[data-you-theme]', () => actions.theme()));
    offs.push(on(host, 'click', '[data-you-logout]', (_, btn) => { actions.logout(btn); }));
    offs.push(on(host, 'click', '[data-you-notes]', () => { setOpen(false); actions.notes(); }));
    offs.push(on(host, 'click', 'a[href]', () => setTimeout(() => setOpen(false), 0)));     // escolheu uma tela: a folha fecha (depois do clique, para o link não sumir antes de navegar)

    const onKeyDown = (ev) => {
        if (!sheetOpen || ev.key !== 'Escape' || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        ev.preventDefault();
        const a = document.activeElement;
        setOpen(false, { focus: a instanceof Element && (host.contains(a) || bar.contains(a)) ? 'button' : null });
    };
    // O foco foi parar fora da folha e da barra (leitor de tela, código): fecha. O <main> é exceção: o site o foca sozinho ao abrir uma tela.
    const onFocusIn = (ev) => {
        if (!sheetOpen || !(ev.target instanceof Element)) return;
        if (host.contains(ev.target) || bar.contains(ev.target) || ev.target.matches('main')) return;
        setOpen(false);
    };
    // Virou computador com a folha aberta (girou o aparelho, redimensionou): fecha.
    const mq = window.matchMedia(MOBILE);
    const onMq = () => { if (!mq.matches && sheetOpen) setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    mq.addEventListener('change', onMq);
    return () => {
        offs.forEach((off) => off());
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('focusin', onFocusIn);
        mq.removeEventListener('change', onMq);
    };
}
