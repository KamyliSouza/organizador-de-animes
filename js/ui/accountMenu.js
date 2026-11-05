// Menu da conta: o avatar no canto superior direito (em todas as larguras de tela) abre um menu com
// Meu perfil, Personalização, Configurações, Painel da equipe (só equipe) e Sair.
// Padrão de "botão de menu": o botão tem aria-haspopup/aria-expanded, a lista de itens tem role="menu" e cada item role="menuitem"
// (o cabeçalho com nome e @usuário fica fora do menu, no painel, porque não é um item).
// Teclado: Enter/Espaço ou seta para baixo abre; setas, Home e End andam pelos itens; Esc fecha e devolve o foco ao botão;
// Tab sai do menu (e o fecha). Fecha também ao clicar fora, ao escolher um item e quando a tela muda de rota.
// O topo é redesenhado também quando a sessão muda (dados que chegam depois, volta à aba...): aí o menu continua aberto, com o foco no mesmo item.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { accountMenuItems, isAccountPath, nextMenuIndex } from '../domain/accountMenu.js';
import { avatar, avatarSrc } from './avatar.js';
import { roleBadge } from './roleBadge.js';

const LIST_ID = 'account-menu-list';

let menuOpen = false;   // guardado aqui (e não só no HTML) porque o topo é refeito de tempos em tempos

/** Fecha o menu sem mexer na tela (o próximo desenho do topo já sai fechado): usado ao trocar de rota e ao sair da conta. */
export function closeAccountMenu() { menuOpen = false; }

/**
 * Chame antes de redesenhar o topo; chame a função devolvida depois. Se o foco estava no avatar ou num item do menu aberto,
 * ele volta para o mesmo lugar no desenho novo (senão o teclado perderia o lugar a cada redesenho).
 */
export function captureAccountFocus(nav) {
    const root = nav.querySelector('[data-account-menu]');
    const active = document.activeElement;
    if (!root || !active || !root.contains(active)) return () => {};
    const index = [...root.querySelectorAll('[role="menuitem"]')].indexOf(active);
    return () => {
        const next = nav.querySelector('[data-account-menu]');
        if (!next) return;
        if (index < 0) { next.querySelector('[data-account-toggle]')?.focus(); return; }
        if (menuOpen) [...next.querySelectorAll('[role="menuitem"]')][index]?.focus();   // menu fechado (mudou de tela): quem cuida do foco é a tela nova
    };
}

/** O HTML do menu para a pessoa logada. `path` = rota atual (sem o "#"). */
export function accountMenuHtml({ profile, user, role, path }) {
    const name = profile?.displayName || profile?.username || user?.email || '';
    const username = profile?.username || '';
    const src = avatarSrc(profile);
    const items = accountMenuItems({ username, role, path });
    return html`
        <div class="account-menu" data-account-menu>
            <button type="button" class="account-trigger${isAccountPath(path, username) ? ' is-current' : ''}" data-account-toggle aria-haspopup="menu" aria-expanded="${String(menuOpen)}" aria-controls="${LIST_ID}" aria-label="Menu da conta de ${name}" title="Minha conta">
                ${avatar(name, 34, src)}<span class="account-name truncate">${name}</span>${icon('chevronDown', { size: 16, className: 'account-caret' })}
            </button>
            <div class="account-panel" ${menuOpen ? '' : html`hidden`}>
                <div class="account-head">
                    ${avatar(name, 44, src)}
                    <div class="account-who">
                        <strong class="truncate">${name}</strong>
                        ${username ? html`<span class="account-user truncate">@${username}</span>` : ''}
                        ${roleBadge(role)}
                    </div>
                </div>
                <div class="account-list" id="${LIST_ID}" role="menu" aria-label="Minha conta">
                    ${items.map((i) => html`<a class="account-item" role="menuitem" tabindex="-1" href="${i.href}" ${i.current ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 18 })}<span>${i.label}</span></a>`)}
                    <div class="account-sep" role="separator"></div>
                    <button type="button" class="account-item" role="menuitem" tabindex="-1" data-logout>${icon('logOut', { size: 18 })}<span>Sair da conta</span></button>
                </div>
            </div>
        </div>`;
}

/**
 * Liga o comportamento do menu. `nav` é o elemento que o contém e é redesenhado de tempos em tempos:
 * os ouvintes ficam nele (e no documento), então valem para o menu novo depois de cada redesenho.
 * Devolve a função que desfaz tudo.
 */
export function bindAccountMenu(nav) {
    const parts = () => {
        const root = nav.querySelector('[data-account-menu]');
        if (!root) return null;
        return { root, btn: root.querySelector('[data-account-toggle]'), panel: root.querySelector('.account-panel') };
    };
    const itemsOf = (panel) => [...panel.querySelectorAll('[role="menuitem"]')];

    function setOpen(open, { focus = null } = {}) {
        const p = parts();
        if (!p) return;
        menuOpen = open;
        p.panel.hidden = !open;
        p.btn.setAttribute('aria-expanded', String(open));
        if (open && focus) {
            const items = itemsOf(p.panel);
            items[focus === 'last' ? items.length - 1 : 0]?.focus();
        }
        if (!open && focus === 'button') p.btn.focus();
    }

    const onClick = (ev) => {
        const p = parts();
        if (!p || !(ev.target instanceof Element)) return;
        if (p.btn.contains(ev.target)) {
            const open = p.panel.hidden;
            // Enter/Espaço no botão chegam como clique sem ponteiro (detail 0): aí o foco já vai para o primeiro item.
            setOpen(open, { focus: open && ev.detail === 0 ? 'first' : null });
            return;
        }
        if (p.panel.contains(ev.target) && ev.target.closest('[role="menuitem"]')) setOpen(false);   // escolheu um item
    };

    const onPointerDown = (ev) => {
        const p = parts();
        if (p && !p.panel.hidden && ev.target instanceof Node && !p.root.contains(ev.target)) setOpen(false);
    };

    const onKeyDown = (ev) => {
        const p = parts();
        if (!p || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const inPanel = p.panel.contains(ev.target);
        const onBtn = p.btn === ev.target;

        // Esc fecha de onde estiver o foco (o foco pode ter ido para a tela por conta do site); só devolve o foco ao avatar se ele estava no menu.
        if (ev.key === 'Escape') {
            if (!p.panel.hidden) { ev.preventDefault(); setOpen(false, { focus: inPanel || onBtn ? 'button' : null }); }
            return;
        }
        if (!inPanel && !onBtn) return;
        if (onBtn && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
            ev.preventDefault();
            setOpen(true, { focus: ev.key === 'ArrowUp' ? 'last' : 'first' });
            return;
        }
        if (!inPanel) return;
        if (ev.key === 'Tab') {
            // Fecha e devolve o foco ao botão; o Tab segue dali (para a frente) ou volta um passo (Shift+Tab).
            setOpen(false, { focus: 'button' });
            if (ev.shiftKey) ev.preventDefault();
            return;
        }
        const items = itemsOf(p.panel);
        const to = nextMenuIndex(ev.key, items.indexOf(document.activeElement), items.length);
        if (to >= 0) { ev.preventDefault(); items[to].focus(); }
    };

    // O foco foi parar fora do menu (leitor de tela, comando de voz, código): fecha.
    // Exceção: o <main>. O site o foca sozinho ao abrir uma tela (inclusive a primeira, enquanto a pessoa já clica no avatar);
    // trocar de tela fecha o menu por conta própria (chrome.js), então isso não precisa fechá-lo.
    const onFocusIn = (ev) => {
        const p = parts();
        if (!p || p.panel.hidden || !(ev.target instanceof Element) || p.root.contains(ev.target) || ev.target.matches('main')) return;
        setOpen(false);
    };

    nav.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
        nav.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('focusin', onFocusIn);
    };
}
