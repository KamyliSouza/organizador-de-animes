import { html, setHtml, uuid } from './dom.js';
import { icon } from './icons.js';

const stack = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function syncScrollLock() {
    document.documentElement.classList.toggle('modal-open', stack.length > 0);
}

/**
 * Abre um modal acessível (role=dialog, ESC fecha, foco preso, foco devolvido).
 * @param {object} opts
 * @param {string} opts.title  Título (texto puro).
 * @param {string} [opts.iconName]  Ícone ao lado do título.
 * @param {'sm'|'md'|'lg'} [opts.size]
 * @param {Element} opts.content  Elemento que vira o corpo do modal.
 * @param {() => void} [opts.onClose]  Chamado uma vez ao fechar (por qualquer motivo).
 */
export function openModal({ title, iconName = '', size = 'md', content, onClose, closeOnBackdrop = true }) {
    const previouslyFocused = document.activeElement;
    const titleId = 'modal-title-' + uuid().slice(0, 8);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    setHtml(overlay, html`
        <div class="modal modal-${size} glass-panel" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
            <header class="modal-header">
                <h2 id="${titleId}">${iconName ? icon(iconName) : ''}<span></span></h2>
                <button type="button" class="icon-button" data-modal-close aria-label="Fechar">${icon('x')}</button>
            </header>
            <div class="modal-body"></div>
        </div>`);

    const dialog = overlay.querySelector('.modal');
    const body = overlay.querySelector('.modal-body');
    overlay.querySelector('h2 span').textContent = title;
    body.appendChild(content);

    let closed = false;
    const api = {
        el: dialog,
        body,
        setTitle(t) { overlay.querySelector('h2 span').textContent = t; },
        close() {
            if (closed) return;
            closed = true;
            const i = stack.indexOf(api);
            if (i >= 0) stack.splice(i, 1);
            overlay.remove();
            syncScrollLock();
            if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus({ preventScroll: true });
            }
            try { onClose?.(); } catch (e) { console.error(e); }
        },
    };

    // Fecha ao clicar no fundo (só se o clique começou e terminou nele).
    let downOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => { downOnOverlay = e.target === overlay; });
    overlay.addEventListener('click', (e) => {
        if (closeOnBackdrop && downOnOverlay && e.target === overlay) api.close();
        const closeBtn = e.target instanceof Element ? e.target.closest('[data-modal-close]') : null;
        if (closeBtn && overlay.contains(closeBtn)) api.close();
    });

    overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const items = Array.from(dialog.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
        if (!items.length) { e.preventDefault(); dialog.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    document.body.appendChild(overlay);
    stack.push(api);
    syncScrollLock();

    const firstField = body.querySelector('input:not([type="hidden"]), select, textarea, button') || dialog;
    setTimeout(() => firstField.focus({ preventScroll: true }), 30);

    return api;
}

// ESC fecha só o modal do topo da pilha.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
        e.preventDefault();
        stack[stack.length - 1].close();
    }
});

export const hasOpenModal = () => stack.length > 0;
