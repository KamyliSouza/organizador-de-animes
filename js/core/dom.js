// Utilitários de DOM.
//
// SEGURANÇA: como o site mostra dados de OUTRAS pessoas (perfis públicos),
// nada que vem de usuário ou de API pode ir cru para o HTML. O template
// `html` abaixo escapa TODA interpolação por padrão. Para inserir HTML
// confiável (ícones, trechos montados por outro `html`), ele precisa estar
// dentro de `html`/`raw`.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class SafeHtml {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
}

/** Marca uma string como HTML confiável (use só com conteúdo escrito por nós). */
export const raw = (s) => new SafeHtml(String(s));

const part = (v) => {
    if (v == null || v === false || v === true) return '';
    if (v instanceof SafeHtml) return v.s;
    if (Array.isArray(v)) return v.map(part).join('');
    return esc(v);
};

/**
 * Template tag: escapa interpolações; aninhar `html` dentro de `html` é seguro.
 * ATENÇÃO: valores booleanos (true/false), null e undefined viram texto vazio, para que
 * `${condição && html`...`}` funcione. Em atributos que precisam de "true"/"false"
 * (aria-pressed, aria-selected...) use String(valor).
 */
export function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
    return new SafeHtml(out);
}

/** Escreve um SafeHtml em um elemento. Strings comuns são escapadas. */
export function setHtml(el, content) {
    el.innerHTML = content instanceof SafeHtml ? content.s : esc(content);
    return el;
}

/** Cria um elemento a partir de um SafeHtml (primeiro nó). */
export function el(content, tag = 'div', className = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    setHtml(node, content);
    return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Delegação de eventos: chama handler(ev, alvo) quando o alvo casa com o seletor. */
export function on(root, type, selector, handler, capture = false) {
    const fn = (ev) => {
        const target = ev.target instanceof Element ? ev.target.closest(selector) : null;
        if (target && root.contains(target)) handler(ev, target);
    };
    root.addEventListener(type, fn, capture);
    return () => root.removeEventListener(type, fn, capture);
}

export function debounce(fn, wait = 200) {
    let t;
    const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
}

/** Só aceita URLs https (bloqueia javascript:, data:, http: etc.). */
export function safeUrl(u) {
    if (typeof u !== 'string') return '';
    const s = u.trim();
    if (!/^https:\/\//i.test(s) || s.length > 600) return '';
    try { return new URL(s).href; } catch { return ''; }
}

export function uuid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Converte para inteiro dentro de [min, max]; usa `fallback` se não for número. */
export function toInt(v, min, max, fallback = min) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

export function cleanHtmlText(htmlString) {
    if (!htmlString) return '';
    const doc = new DOMParser().parseFromString(String(htmlString).replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return (doc.body.textContent || '').trim();
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
        return ok;
    }
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
