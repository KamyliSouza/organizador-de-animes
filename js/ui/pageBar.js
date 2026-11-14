// Barra de cima no computador largo (≥ 75em): o título da tela e as ações do "cartão grande" (hero) vivem na barra.
// As telas continuam desenhando o <header class="page-head"> de sempre (o h1 segue na página para o leitor de tela);
// no computador largo o CSS o esconde, e este módulo espelha o que havia nele:
//   - o título (data-bar-title ou o h1) e a dica (data-bar-hint) vão para [data-nav-page];
//   - cada botão/link de .page-head-actions ganha um "atalho" em [data-nav-page-actions] que apenas clica no original.
// Nada é movido nem refeito nas telas: os botões e as ligações continuam sendo os de sempre.
import { on } from '../core/dom.js';

/** Atalhos que o menu lateral já oferece: com o menu aberto, não se repetem na barra. */
const SIDE_ACTIONS = ['schedule', 'stats'];

const WIDE = '(min-width: 75em)';

function isHidden(el) {
    return el.hidden || el.closest('[hidden]') !== null;
}

function cloneIcon(from) {
    const svg = from?.querySelector?.('svg');
    return svg ? svg.cloneNode(true) : null;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.nav       a barra de cima (#site-nav)
 * @param {HTMLElement} opts.main      o conteúdo da tela (#main)
 * @param {() => boolean} opts.sideOpen  o menu lateral está aberto?
 * @returns {{ sync: () => void, destroy: () => void }}
 */
export function mountPageBar({ nav, main, sideOpen }) {
    let queued = false;

    const sync = () => {
        queued = false;
        const head = main.querySelector('.page-head');
        const wide = window.matchMedia(WIDE).matches;
        const collapsed = Boolean(head) && wide;
        document.body.classList.toggle('has-pagebar', collapsed);
        // sem campo de busca dentro, o cartão inteiro fica só para o leitor de tela
        if (head) {
            const hasSearch = Boolean(head.querySelector('.search-field'));
            head.classList.toggle('sr-only', collapsed && !hasSearch);
            head.querySelector(':scope > div:first-child')?.classList.toggle('sr-only', collapsed && hasSearch);   // com busca: só o bloco do título some, a busca fica
        }
        const slot = nav.querySelector('[data-nav-page]');
        const actionsSlot = nav.querySelector('[data-nav-page-actions]');
        if (!slot || !actionsSlot) return;

        // título e dica
        slot.replaceChildren();
        if (head && wide) {
            const title = (head.dataset.barTitle || head.querySelector('h1')?.textContent || '').trim();
            const hint = (head.dataset.barHint || '').trim();
            const ic = cloneIcon(head.querySelector('.eyebrow'));
            if (title) {
                const b = document.createElement('span');
                b.className = 'nav-page-title';
                if (ic) { ic.setAttribute('aria-hidden', 'true'); b.append(ic); }
                b.append(document.createTextNode(title));
                slot.append(b);
                if (hint) {
                    const h = document.createElement('span');
                    h.className = 'nav-page-hint';
                    h.textContent = hint;
                    slot.append(h);
                }
            }
            // o título já está na página (h1) para o leitor de tela; aqui ele é só visual
            slot.setAttribute('aria-hidden', 'true');
        }
        slot.hidden = !slot.firstChild;

        // atalhos das ações
        actionsSlot.replaceChildren();
        if (head && wide) {
            const real = [...head.querySelectorAll('.page-head-actions > *')];
            real.forEach((el, index) => {
                if (isHidden(el)) return;
                if (sideOpen() && SIDE_ACTIONS.includes(el.dataset.act)) return;
                const label = el.textContent.replace(/\s+/g, ' ').trim();
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'button button-secondary button-sm nav-page-action';
                b.dataset.pageAction = String(index);
                b.title = label;
                b.setAttribute('aria-label', label);
                const ic2 = cloneIcon(el);
                if (ic2) b.append(ic2);
                const t = document.createElement('span');
                t.className = 'nav-page-action-label';
                t.textContent = label;
                b.append(t);
                actionsSlot.append(b);
            });
        }
        actionsSlot.hidden = !actionsSlot.firstChild;
    };

    // roda já no fim da alteração (antes da pintura), para o cartão grande não "piscar" na troca de tela
    const queue = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(sync);
    };

    const observer = new MutationObserver(queue);
    observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    const mq = window.matchMedia(WIDE);
    mq.addEventListener('change', queue);

    // clicar no atalho da barra = clicar no botão original da tela
    const off = on(nav, 'click', '[data-page-action]', (_, btn) => {
        const real = main.querySelectorAll('.page-head .page-head-actions > *')[Number(btn.dataset.pageAction)];
        if (real) real.click();
    });

    return {
        sync,
        destroy() { observer.disconnect(); mq.removeEventListener('change', queue); off(); },
    };
}
