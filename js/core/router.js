// Roteador por hash (#/caminho). Funciona no GitHub Pages sem nenhuma
// configuração de servidor, e não atrapalha os links de confirmação de
// e-mail do Supabase (que também usam o hash).
//
// Cada rota carrega o módulo da tela sob demanda e chama
//   mount(container, ctx)  ->  (opcional) função de limpeza
import { config } from '../config.js';
import { setHtml, html } from './dom.js';
import { icon, spinner } from './icons.js';

const routes = [];
let outlet = null;
let cleanup = null;
let token = 0;
let notFound = null;
const listeners = new Set();

/**
 * Registra uma rota. Ex.: route('/u/:username', () => import('../views/profile.js'))
 * options.guard(ctx) pode devolver um caminho para redirecionar.
 */
export function route(pattern, loader, options = {}) {
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ pattern, rx, keys, loader, options });
}

export function setNotFound(loader) { notFound = loader; }

/** Caminho atual. Hashes que não começam com "#/" (ex.: tokens do Supabase) valem como "/". */
export function currentPath() {
    const h = location.hash;
    if (!h.startsWith('#/')) return '/';
    const path = h.slice(1).split('?')[0];
    try { return decodeURIComponent(path); } catch { return path; }
}

export function navigate(path, { replace = false } = {}) {
    const target = '#' + path;
    if (location.hash === target) { resolve(); return; }
    if (replace) location.replace(location.pathname + location.search + target);
    else location.hash = target;
}

/** Remonta a tela atual (ex.: depois de login/logout). */
export function refresh() { resolve(); }

export function onRouteChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function start(outletEl) {
    outlet = outletEl;
    window.addEventListener('hashchange', resolve);
    resolve();
}

function match(path) {
    for (const r of routes) {
        const m = r.rx.exec(path);
        if (m) {
            const params = {};
            r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
            return { route: r, params };
        }
    }
    return null;
}

function showError(container, err) {
    console.error(err);
    setHtml(container, html`
        <div class="glass-panel empty-state">
            ${icon('alert', { size: 40 })}
            <h3>Não foi possível abrir esta página</h3>
            <p>Verifique sua conexão e tente novamente.</p>
            <button type="button" class="button button-primary" data-retry>Tentar de novo</button>
        </div>`);
    container.querySelector('[data-retry]')?.addEventListener('click', resolve);
}

async function resolve() {
    if (!outlet) return;
    const myToken = ++token;
    const path = currentPath();

    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }

    const container = document.createElement('div');
    container.className = 'view';
    setHtml(container, html`<div class="center muted" style="padding:60px 0">${spinner(28)}</div>`);
    outlet.replaceChildren(container);
    outlet.setAttribute('aria-busy', 'true');

    const found = match(path);
    const ctx = { path, params: found?.params || {}, name: found?.route.options.name || '' };
    const pageTitle = found?.route.options.title;
    document.title = pageTitle ? `${pageTitle} · ${config.siteName}` : config.siteName;

    try {
        if (found?.route.options.guard) {
            const redirect = await found.route.options.guard(ctx);
            if (myToken !== token) return;
            if (redirect) { navigate(redirect, { replace: true }); return; }
        }

        const loader = found ? found.route.loader : notFound;
        const mod = await loader();
        if (myToken !== token) return;

        container.replaceChildren();
        const result = await mod.mount(container, ctx);
        if (myToken !== token) {
            // Usuário já foi para outra tela: limpa o que essa montou.
            if (typeof result === 'function') { try { result(); } catch (e) { console.error(e); } }
            return;
        }
        cleanup = typeof result === 'function' ? result : null;
    } catch (err) {
        if (myToken !== token) return;
        showError(container, err);
    } finally {
        if (myToken === token) {
            outlet.removeAttribute('aria-busy');
            listeners.forEach((fn) => { try { fn(path, ctx); } catch (e) { console.error(e); } });
        }
    }
}

export function scrollToTop() {
    // O CSS usa scroll suave; ao trocar de tela queremos voltar ao topo na hora.
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
}
