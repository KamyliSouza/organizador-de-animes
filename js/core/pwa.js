// App instalável (PWA): registra o service worker (sw.js), cuida do botão "Instalar o app", da atualização e do aviso de internet.
//  • Instalar: Chrome/Edge/Android avisam por "beforeinstallprompt" (guardamos o evento e o botão o dispara); o iOS não tem isso:
//    lá o botão abre uma janelinha com o passo a passo (Compartilhar → Adicionar à Tela de Início).
//  • Atualizar: uma versão nova do site fica esperando; a pessoa escolhe "Atualizar" (botão no rodapé e na folha "Você") e a página recarrega.
//    Nunca recarrega sozinha: ela pode estar no meio de uma edição.
//  • Internet: avisa quando caiu e quando voltou, e marca <html data-offline> para o CSS e os testes.
//  • Saída de emergência: abrir o site com ?nosw no endereço apaga tudo o que o service worker guardou e recomeça do zero (se algo ficou preso).
import { config, hasSupabase } from '../config.js';
import { el, html } from './dom.js';
import { openModal } from './modal.js';
import { isOffline, onConnectionChange } from './online.js';
import { toast } from './toast.js';

const listeners = new Set();
let deferred = null;          // evento beforeinstallprompt guardado
let waiting = null;           // service worker novo esperando para assumir
let registration = null;
let applying = false;
let installed = false;

export const onPwaChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* um ouvinte não derruba os outros */ } });

export const isStandalone = () => {
    try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { return false; }
};
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 'prompt' (o navegador deixa instalar), 'ios' (instalação manual) ou 'none' (já instalado, sem suporte ou não faz sentido mostrar). */
export function installKind() {
    if (installed || isStandalone()) return 'none';
    if (deferred) return 'prompt';
    if (isIos()) return 'ios';
    return 'none';
}
export const updateReady = () => Boolean(waiting);

function showIosSteps() {
    const content = el(html`
        <div class="stack">
            <p>No iPhone e no iPad, a instalação é feita pelo Safari:</p>
            <ol class="install-steps">
                <li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
                <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
                <li>Toque em <b>Adicionar</b>. O ${config.siteName} passa a abrir como um aplicativo.</li>
            </ol>
            <div class="modal-footer"><button type="button" class="button button-primary" data-modal-close>Entendi</button></div>
        </div>`);
    return openModal({ title: 'Instalar o app', iconName: 'download', content });
}

export async function promptInstall() {
    const kind = installKind();
    if (kind === 'ios') { showIosSteps(); return; }
    if (kind !== 'prompt') return;
    const ev = deferred;
    deferred = null;            // o evento só pode ser usado uma vez
    emit();
    try {
        await ev.prompt();
        const choice = await ev.userChoice;
        if (choice && choice.outcome === 'accepted') toast(`${config.siteName} instalado.`, { type: 'success' });
    } catch { /* fechou ou o navegador recusou */ }
}

/** Aceitou a atualização: o worker novo assume e a página recarrega. */
export function applyUpdate() {
    if (!waiting) return;
    applying = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
}

function track(worker) {
    if (!worker) return;
    const check = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) { waiting = worker; emit(); toast('Há uma versão nova do site. Toque em “Atualizar o site” para usar.', { type: 'info', timeout: 9000 }); }
    };
    worker.addEventListener('statechange', check);
    check();
}

async function resetServiceWorker() {
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        for (const key of await caches.keys()) await caches.delete(key);
    } catch { /* ok */ }
    const url = new URL(location.href);
    url.searchParams.delete('nosw');
    location.replace(url.toString());
}

// Biblioteca do Supabase (jsDelivr): baixada na 1ª visita, antes de o worker assumir, então não ficou guardada. Pedimos ao worker que a baixe
// (e os módulos que ela importa) e guarde uma cópia: assim o site abre offline também na conta. Quem baixa é o worker, não a página,
// porque a CSP da página só libera o jsDelivr para scripts (connect-src não). Melhor esforço, em silêncio.
function warmSupabaseSdk() {
    if (!hasSupabase() || isOffline()) return;
    navigator.serviceWorker.controller?.postMessage({ type: 'WARM_SDK', url: config.supabaseEsmUrl });
}
const whenIdle = (fn) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 6000 }) : setTimeout(fn, 2500));

function watchConnection() {
    let was = isOffline();
    const sync = (announce) => {
        const off = isOffline();                          // navegador sem rede OU uma chamada que falhou (core/online.js)
        document.documentElement.toggleAttribute('data-offline', off);
        if (announce && off !== was) toast(off ? 'Você está sem internet.' : 'Internet de volta.', { type: off ? 'error' : 'success' });
        was = off;
    };
    onConnectionChange(() => sync(true));
    sync(false);
}

export function initPwa() {
    watchConnection();
    window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); deferred = ev; emit(); });
    window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });

    if (!('serviceWorker' in navigator)) return;
    if (new URLSearchParams(location.search).has('nosw')) { resetServiceWorker(); return; }
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!secure) return;

    // A página já abriu: o registro espera o "load" para não disputar banda com o primeiro desenho.
    const register = async () => {
        try {
            registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './', updateViaCache: 'none' });
        } catch (err) { console.warn('Service worker não registrado:', err); return; }
        if (!registration) return;             // registro bloqueado (alguns navegadores/testes devolvem vazio em vez de erro)
        if (navigator.serviceWorker.controller) whenIdle(warmSupabaseSdk);
        else navigator.serviceWorker.addEventListener('controllerchange', () => whenIdle(warmSupabaseSdk), { once: true });     // 1ª visita: o worker acabou de assumir
        if (registration.waiting && navigator.serviceWorker.controller) track(registration.waiting);
        registration.addEventListener('updatefound', () => track(registration.installing));
        let lastCheck = Date.now();
        document.addEventListener('visibilitychange', () => {       // voltou para a aba depois de um tempo: procura versão nova (no máximo 1x a cada 30 min)
            if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 30 * 60_000) return;
            lastCheck = Date.now();
            registration.update().catch(() => {});
        });
    };
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register, { once: true });

    navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
}
