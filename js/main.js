// Ponto de entrada: tema, sessão, casca do site e rotas.
import { config } from './config.js';
import { html, setHtml } from './core/dom.js';
import { icon } from './core/icons.js';
import { navigate, onRouteChange, refresh, route, scrollToTop, setNotFound, start } from './core/router.js';
import { currentTheme } from './core/theme.js';
import { rankOf } from './domain/roles.js';
import { initSession, isCloud, myRole, onSessionChange, refreshRequests, state } from './services/session.js';
import { mountChrome } from './ui/chrome.js';

const $ = (id) => document.getElementById(id);

// --- guardas de rota: devolvem para onde redirecionar (ou nada) -------------------------
const onlyVisitors = () => (!isCloud() || state.user ? '/' : undefined);       // login/cadastro
const onlyMembers = () => (isCloud() && !state.user ? '/entrar' : undefined);   // configurações
// Painel da equipe: só quem tem cargo (a tela e o banco conferem de novo). Configurações do site: administração ou Dona.
const staffRank = (min) => () => {
    if (!isCloud()) return '/';
    if (!state.user) return '/entrar';
    return rankOf(myRole()) >= min ? undefined : '/';
};

function defineRoutes() {
    route('/', () => import('./views/home.js'), { name: 'home' });
    route('/entrar', () => import('./views/auth.js'), { name: 'login', title: 'Entrar', guard: onlyVisitors });
    route('/criar-conta', () => import('./views/auth.js'), { name: 'signup', title: 'Criar conta', guard: onlyVisitors });
    route('/recuperar', () => import('./views/auth.js'), { name: 'forgot', title: 'Recuperar senha', guard: onlyVisitors });
    // Link do e-mail de "esqueci a senha": a pessoa chega já logada numa sessão de recuperação.
    route('/nova-senha', () => import('./views/auth.js'), { name: 'recovery', title: 'Nova senha', guard: () => (isCloud() && state.user ? undefined : '/entrar') });
    route('/explorar', () => import('./views/explore.js'), { name: 'explore', title: 'Explorar' });
    route('/u/:username', () => import('./views/profile.js'), { name: 'profile', title: 'Perfil' });
    route('/feed', () => import('./views/feed.js'), { name: 'feed', title: 'Feed', guard: onlyMembers });
    route('/feed/pedidos', () => import('./views/feed.js'), { name: 'feed-requests', title: 'Pedidos para seguir', guard: onlyMembers });
    route('/configuracoes', () => import('./views/settings.js'), { name: 'settings', title: 'Personalização', guard: onlyMembers });
    route('/configuracoes/conta', () => import('./views/settingsAccount.js'), { name: 'settings-account', title: 'Configurações', guard: onlyMembers });
    route('/admin', () => import('./views/admin.js'), { name: 'admin', title: 'Painel da equipe', guard: staffRank(1) });
    route('/admin/denuncias', () => import('./views/admin.js'), { name: 'admin-reports', title: 'Denúncias', guard: staffRank(1) });
    route('/admin/registro', () => import('./views/admin.js'), { name: 'admin-log', title: 'Registro de ações', guard: staffRank(1) });
    route('/admin/configuracoes', () => import('./views/admin.js'), { name: 'admin-settings', title: 'Configurações do site', guard: staffRank(2) });
    setNotFound(() => import('./views/notFound.js'));
}

function showFatal(err) {
    console.error(err);
    const main = $('main');
    setHtml(main, html`
        <div class="glass-panel empty-state">
            ${icon('alert', { size: 44 })}
            <h3>Não foi possível iniciar o ${config.siteName}</h3>
            <p>Confira a conexão com a internet e as chaves em <code>js/config.js</code>. Se o problema continuar, abra o console do navegador (F12) para ver o detalhe.</p>
            <button type="button" class="button button-primary" data-retry>Tentar de novo</button>
        </div>`);
    main.querySelector('[data-retry]').addEventListener('click', () => location.reload());
}

async function boot() {
    $('skip-link').addEventListener('click', () => $('main').focus());
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', currentTheme() === 'dark' ? '#d178cd' : '#B35EAF');

    try {
        await initSession({ onRecovery: () => navigate('/nova-senha') });
    } catch (err) {
        showFatal(err);
        return;
    }

    mountChrome({ nav: $('site-nav'), tabBar: $('tab-bar'), footer: $('site-footer'), notice: $('site-notice') });
    defineRoutes();

    // Sessão mudou por fora (outra aba saiu da conta, token expirou...): remonta a tela atual.
    onSessionChange((_, reason) => { if (reason === 'external') refresh(); });

    // Voltou para a aba depois de um tempo: confere se chegaram pedidos de seguir (no máximo 1x por minuto).
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !state.user || Date.now() - lastCheck < 60_000) return;
        lastCheck = Date.now();
        refreshRequests();
    });

    let lastPath = null;
    onRouteChange((path) => {
        if (path !== lastPath) { scrollToTop(); $('main').focus({ preventScroll: true }); }
        lastPath = path;
    });

    start($('main'));
}

boot();
