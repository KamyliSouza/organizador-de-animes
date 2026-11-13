// Menu "⋯" dos cards da biblioteca (Compartilhar, Editar, Excluir): abre e fecha pelo botão, fecha com Esc, com clique fora
// ou ao sair dele com o Tab, e anda pelos itens com as setas. Os itens continuam sendo botões [data-action] de sempre.

const items = (menu) => [...menu.querySelectorAll('[role="menuitem"]')];

function closeMenu(wrap, { focus = false } = {}) {
    const toggle = wrap.querySelector('[data-menu-toggle]');
    const menu = wrap.querySelector('.card-menu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    wrap.closest('.media-card')?.classList.remove('menu-open');
    if (focus) toggle?.focus({ preventScroll: true });
}

function openMenu(wrap) {
    const toggle = wrap.querySelector('[data-menu-toggle]');
    const menu = wrap.querySelector('.card-menu');
    if (!menu) return;
    closeAll(wrap.closest('[data-results], body') || document, wrap);
    menu.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
    wrap.closest('.media-card')?.classList.add('menu-open');
    items(menu)[0]?.focus({ preventScroll: true });
}

function closeAll(root, except = null) {
    for (const w of root.querySelectorAll('.card-menu-wrap')) if (w !== except) closeMenu(w);
}

/** Liga os menus dos cards dentro de `root` (a lista da biblioteca). Devolve a função que desliga tudo. */
export function bindCardMenus(root) {
    const onClick = (ev) => {
        const t = ev.target instanceof Element ? ev.target : null;
        const toggle = t?.closest('[data-menu-toggle]');
        if (toggle && root.contains(toggle)) {
            const wrap = toggle.closest('.card-menu-wrap');
            if (wrap.querySelector('.card-menu').hidden) openMenu(wrap); else closeMenu(wrap, { focus: true });
            return;
        }
        const item = t?.closest('.card-menu [data-action]');
        if (item && root.contains(item)) {
            // O foco volta para o "⋯" antes da ação rodar: a janela que ela abrir devolve o foco a um botão que continua na tela.
            closeMenu(item.closest('.card-menu-wrap'), { focus: true });
            return;
        }
        if (!t?.closest('.card-menu-wrap')) closeAll(root);
    };
    const onKey = (ev) => {
        const wrap = ev.target instanceof Element ? ev.target.closest('.card-menu-wrap') : null;
        if (!wrap || !root.contains(wrap) || wrap.querySelector('.card-menu').hidden) return;
        const list = items(wrap.querySelector('.card-menu'));
        const at = list.indexOf(document.activeElement);
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(wrap, { focus: true }); }
        else if (ev.key === 'ArrowDown') { ev.preventDefault(); list[(at + 1) % list.length]?.focus(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); list[(at <= 0 ? list.length : at) - 1]?.focus(); }
        else if (ev.key === 'Home') { ev.preventDefault(); list[0]?.focus(); }
        else if (ev.key === 'End') { ev.preventDefault(); list[list.length - 1]?.focus(); }
    };
    const onFocusOut = (ev) => {
        const wrap = ev.target instanceof Element ? ev.target.closest('.card-menu-wrap') : null;
        if (!wrap || wrap.contains(ev.relatedTarget)) return;
        if (ev.relatedTarget) closeMenu(wrap);   // sem destino (clicou fora, em área sem foco): quem fecha é o clique
    };
    const onDocClick = (ev) => { if (!(ev.target instanceof Element) || !ev.target.closest('.card-menu-wrap')) closeAll(root); };
    root.addEventListener('click', onClick, true);
    root.addEventListener('keydown', onKey);
    root.addEventListener('focusout', onFocusOut);
    document.addEventListener('click', onDocClick);
    return () => {
        root.removeEventListener('click', onClick, true);
        root.removeEventListener('keydown', onKey);
        root.removeEventListener('focusout', onFocusOut);
        document.removeEventListener('click', onDocClick);
    };
}
