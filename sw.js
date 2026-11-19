// Service worker do KamyList: faz o site abrir sem internet e ser instalável.
// Regras (para o site nunca ficar "misturado" entre duas versões):
//  • Todos os arquivos do site são baixados juntos, de uma vez só, numa pasta com o nome da versão (tudo ou nada). Se um falhar, nada é trocado.
//  • Uma versão nova só assume quando a pessoa aceita ("Atualizar"): ela fica esperando (waiting) e a página recarrega ao aceitar.
//  • js/config.js (as chaves de cada pessoa) nunca é congelado: vai pela internet primeiro e só usa a cópia guardada se a internet falhar.
//  • Fontes do Google e a biblioteca do Supabase (jsDelivr) ficam guardadas na 1ª vez que são usadas, para abrir offline nas próximas.
//  • Nada que fala com o banco (Supabase), com Jikan, AniList ou TMDB passa por aqui: continua indo direto para a internet.
// Depois de mexer em qualquer arquivo do site, rode:  node tools/build-sw.mjs --write   (atualiza a lista e a versão abaixo)

// precache:start (gerado por tools/build-sw.mjs; não edite à mão)
const VERSION = '99f5ca2a6df3';
const PRECACHE = [
    'css/base.css',
    'css/components.css',
    'css/contrast.css',
    'css/palettes.css',
    'css/profile-bg.css',
    'css/tokens.css',
    'css/views.css',
    'favicon.svg',
    'icons/apple-touch-icon.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'index.html',
    'js/boot.js',
    'js/core/contrast.js',
    'js/core/dialogs.js',
    'js/core/dom.js',
    'js/core/errors.js',
    'js/core/icons.js',
    'js/core/modal.js',
    'js/core/offlineStore.js',
    'js/core/online.js',
    'js/core/palette.js',
    'js/core/pwa.js',
    'js/core/router.js',
    'js/core/siteBackground.js',
    'js/core/theme.js',
    'js/core/themeColor.js',
    'js/core/time.js',
    'js/core/toast.js',
    'js/domain/access.js',
    'js/domain/accountMenu.js',
    'js/domain/avatarCrop.js',
    'js/domain/backup.js',
    'js/domain/changelog.js',
    'js/domain/entry.js',
    'js/domain/mediaLimits.js',
    'js/domain/palettes.js',
    'js/domain/profileSearch.js',
    'js/domain/profileSummary.js',
    'js/domain/reportContext.js',
    'js/domain/reportSnapshot.js',
    'js/domain/roles.js',
    'js/domain/settingsThemes.js',
    'js/domain/stats.js',
    'js/domain/textSafety.js',
    'js/main.js',
    'js/services/avatarImage.js',
    'js/services/backgroundImage.js',
    'js/services/http.js',
    'js/services/local-backend.js',
    'js/services/offline-backend.js',
    'js/services/offlineCache.js',
    'js/services/schema.js',
    'js/services/search/anilist.js',
    'js/services/search/index.js',
    'js/services/search/jikan.js',
    'js/services/search/shared.js',
    'js/services/search/tmdb.js',
    'js/services/session.js',
    'js/services/supabase-backend.js',
    'js/ui/accessibilityPanel.js',
    'js/ui/accountMenu.js',
    'js/ui/avatar.js',
    'js/ui/avatarCropModal.js',
    'js/ui/backgroundPanel.js',
    'js/ui/cardMenu.js',
    'js/ui/chrome.js',
    'js/ui/connectionsModal.js',
    'js/ui/dataPanel.js',
    'js/ui/infoModals.js',
    'js/ui/libraryBrowser.js',
    'js/ui/mediaCard.js',
    'js/ui/mediaFormModal.js',
    'js/ui/mediaLimits.js',
    'js/ui/memberModal.js',
    'js/ui/newWork.js',
    'js/ui/offlineGate.js',
    'js/ui/pageBar.js',
    'js/ui/palettePicker.js',
    'js/ui/patchNotesModal.js',
    'js/ui/profileBackground.js',
    'js/ui/profilePanes.js',
    'js/ui/quickActionDialog.js',
    'js/ui/readProgressModal.js',
    'js/ui/reportModal.js',
    'js/ui/reviewBlock.js',
    'js/ui/roleBadge.js',
    'js/ui/seasonsModal.js',
    'js/ui/sectionTabs.js',
    'js/ui/settingsAccount.js',
    'js/ui/settingsAppearance.js',
    'js/ui/settingsPrivacy.js',
    'js/ui/settingsProfile.js',
    'js/ui/settingsShell.js',
    'js/ui/shareModal.js',
    'js/ui/shortcuts.js',
    'js/ui/sideMenu.js',
    'js/ui/starRating.js',
    'js/ui/stars.js',
    'js/ui/statusTabs.js',
    'js/ui/suspendedScreen.js',
    'js/ui/textEditorModal.js',
    'js/ui/youSheet.js',
    'js/views/admin.js',
    'js/views/auth.js',
    'js/views/explore.js',
    'js/views/feed.js',
    'js/views/home.js',
    'js/views/landing.js',
    'js/views/library.js',
    'js/views/notFound.js',
    'js/views/profile.js',
    'js/views/settings.js',
    'manifest-cereja.webmanifest',
    'manifest-floresta.webmanifest',
    'manifest-grafite.webmanifest',
    'manifest-indigo.webmanifest',
    'manifest-oceano.webmanifest',
    'manifest-por-do-sol.webmanifest',
    'manifest-strong-violet.webmanifest',
    'manifest.webmanifest',
];
// precache:end

const PRE = `kamylist-pre-${VERSION}`;
const RUNTIME = 'kamylist-runtime';
const SCOPE = self.registration.scope;
const BASE = new URL(SCOPE).pathname;
const CONFIG = 'js/config.js';
const CDN_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']);
const known = new Set(PRECACHE);

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(PRE);
        // cache: 'reload' = ignora o cache HTTP do navegador (senão uma versão velha de um arquivo entraria na versão nova).
        await cache.addAll(PRECACHE.map((p) => new Request(new URL(p, SCOPE), { cache: 'reload' })));
        // As chaves da pessoa: guarda uma cópia para abrir offline (melhor esforço; a falha não impede a instalação).
        try {
            const res = await fetch(new Request(new URL(CONFIG, SCOPE), { cache: 'reload' }));
            if (res.ok) await (await caches.open(RUNTIME)).put(new URL(CONFIG, SCOPE), res);
        } catch { /* sem config guardado: o primeiro uso online guarda */ }
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) if (key.startsWith('kamylist-pre-') && key !== PRE) await caches.delete(key);
        await self.clients.claim();
    })());
});

// Aquecimento: a página pede para guardar a biblioteca do Supabase (jsDelivr) e os módulos que ela importa (o "+esm" aponta para /npm/...).
async function warm(url, seen = new Set(), depth = 0) {
    if (seen.has(url) || depth > 4 || seen.size >= 25) return;
    let u;
    try { u = new URL(url); } catch { return; }
    if (u.origin !== 'https://cdn.jsdelivr.net') return;          // só o jsDelivr
    seen.add(url);
    try {
        const req = new Request(url, { mode: 'cors' });
        const res = await fetch(req);
        if (!res.ok) return;
        await (await caches.open(RUNTIME)).put(req, res.clone());
        const code = await res.text();
        for (const m of code.matchAll(/(?:from|import)\s*["'](\/npm\/[^"']+)["']/g)) await warm(new URL(m[1], url).href, seen, depth + 1);
    } catch { /* sem rede agora: fica para a próxima visita */ }
}

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SKIP_WAITING') self.skipWaiting();
    else if (data.type === 'WARM_SDK' && typeof data.url === 'string') event.waitUntil(warm(data.url));
});

const fromPrecache = async (path) => (await caches.open(PRE)).match(new URL(path, SCOPE), { ignoreSearch: true });

async function networkFirst(request, path) {
    const cache = await caches.open(RUNTIME);
    const key = new URL(path, SCOPE);
    const cached = await cache.match(key);
    try {
        const ctrl = new AbortController();
        const timer = cached ? setTimeout(() => ctrl.abort(), 4000) : null;      // internet "pendurada": com cópia guardada, não espera mais que 4 s
        // 'no-cache' = pergunta ao servidor se mudou (o cache HTTP do GitHub Pages guarda por ~10 min e as chaves trocadas demorariam a valer).
        const res = await fetch(new Request(request, { cache: 'no-cache' }), { signal: ctrl.signal });
        if (timer) clearTimeout(timer);
        if (res.ok) await cache.put(key, res.clone());
        return res;
    } catch (err) {
        if (cached) return cached;
        throw err;
    }
}

async function staleWhileRevalidate(event) {
    const cache = await caches.open(RUNTIME);
    const cached = await cache.match(event.request);
    const update = fetch(event.request).then(async (res) => {
        if (res.ok || res.type === 'opaque') await cache.put(event.request, res.clone());
        return res;
    });
    if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
    return update;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        if (!url.pathname.startsWith(BASE)) return;
        const path = url.pathname.slice(BASE.length);
        if (request.mode === 'navigate') {
            event.respondWith(fromPrecache('index.html').then((res) => res || fetch(request)));
            return;
        }
        if (path === CONFIG) { event.respondWith(networkFirst(request, CONFIG)); return; }
        if (known.has(path)) event.respondWith(fromPrecache(path).then((res) => res || fetch(request)));
        return;
    }
    if (CDN_HOSTS.has(url.hostname)) event.respondWith(staleWhileRevalidate(event));
});
