import { html, setHtml, uuid } from './dom.js';
import { icon } from './icons.js';

const stack = [];

// ---------------------------------------------------------------------------------------
// Botão "voltar" (do navegador ou do celular): fecha o modal do topo em vez de sair da página.
// Cada modal aberto empurra uma entrada no histórico (com o mesmo endereço). Ao fechar por outro
// caminho (X, Esc, clique no fundo, botão do modal) a entrada é desfeita com history.back().
// Se a pessoa for para outra tela com o modal aberto (hashchange), todos os modais fecham.
// ---------------------------------------------------------------------------------------
let seq = 0;
let ignorePop = 0;          // quantos "popstate" vieram de um history.back() nosso (não do usuário)
let ignoreTimer = null;

try { if (history.state?.kamylistModal) history.replaceState(null, ''); } catch { /* ok */ }

function pushEntry(api) {
    try { history.pushState({ kamylistModal: api.id }, ''); api.hasEntry = true; } catch { api.hasEntry = false; }
}

/** Desfaz a entrada do histórico de um modal fechado por X/Esc/botão. Só mexe se ela ainda é a atual. */
function dropEntry(api) {
    if (!api.hasEntry) return;
    // setTimeout: se o fechamento veio de um link (que navega logo depois), a entrada atual já será outra e não voltamos nada.
    setTimeout(() => {
        if (history.state?.kamylistModal !== api.id || location.hash !== api.hashAtOpen) return;
        ignorePop++;
        clearTimeout(ignoreTimer);
        ignoreTimer = setTimeout(() => { ignorePop = 0; }, 800);
        history.back();
    }, 0);
}

window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    const top = stack[stack.length - 1];
    if (top) { top.close({ fromHistory: true }); return; }
    // Sobrou uma entrada de modal no histórico (o modal já tinha fechado): pula para a anterior.
    if (history.state?.kamylistModal) history.back();
});

window.addEventListener('hashchange', () => {
    [...stack].forEach((m) => m.close({ fromHistory: true }));
});

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
 * @param {string} [opts.initialFocus]  Seletor (dentro do corpo) do campo que recebe o foco ao abrir. Padrão: o primeiro campo.
 *   Use 'dialog' para focar a própria janela (nenhum campo): o teclado do celular não abre sozinho.
 */
export function openModal({ title, iconName = '', size = 'md', content, onClose, closeOnBackdrop = true, initialFocus = '' }) {
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
        id: ++seq,
        hasEntry: false,
        hashAtOpen: location.hash,
        el: dialog,
        body,
        setTitle(t) { overlay.querySelector('h2 span').textContent = t; },
        close({ fromHistory = false } = {}) {
            if (closed) return;
            closed = true;
            if (!fromHistory) dropEntry(api);
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
    pushEntry(api);
    syncScrollLock();

    const firstField = initialFocus === 'dialog' ? dialog
        : (initialFocus && body.querySelector(initialFocus))
        || body.querySelector('input:not([type="hidden"]), select, textarea, button') || dialog;
    setTimeout(() => {
        firstField.focus({ preventScroll: true });
        // cursor no fim do texto (editar uma obra): o título não fica todo selecionado
        if (firstField instanceof HTMLInputElement && firstField.type === 'text') {
            const n = firstField.value.length;
            try { firstField.setSelectionRange(n, n); } catch { /* alguns tipos de campo não aceitam */ }
        }
    }, 30);

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
