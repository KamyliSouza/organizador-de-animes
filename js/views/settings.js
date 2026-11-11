// Configurações da conta: um índice de temas (Perfil e foto, Personalização, Privacidade, Dados e backup, Conta).
//  - Computador: a lista de temas fica ao lado, e o tema escolhido ocupa o resto da tela. #/configuracoes já abre o primeiro tema.
//  - Celular: #/configuracoes é só a lista (cada tema é um cartão); ao abrir um tema, aparece "Todas as configurações" para voltar.
//  - Sem login (modo local): uma tela só, "Ajustes", com Cores, Alto contraste e backup.
// Cada tema mora em js/ui/settings*.js e devolve o HTML dele e uma função que liga o comportamento ({ off, isDirty }).
// Os temas e os endereços ficam em js/domain/settingsThemes.js.
import { config } from '../config.js';
import { html, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { currentPath, navigate } from '../core/router.js';
import { DEFAULT_THEME, SETTINGS_ROOT, themeById, themeIdForPath } from '../domain/settingsThemes.js';
import { backend, isCloud, state } from '../services/session.js';
import { bindDataPanel, dataPanelHtml } from '../ui/dataPanel.js';
import { accountThemeHtml, bindAccountTheme } from '../ui/settingsAccount.js';
import { appearanceThemeHtml, bindAppearanceTheme, localAppearanceHtml } from '../ui/settingsAppearance.js';
import { bindPrivacyTheme, privacyThemeHtml } from '../ui/settingsPrivacy.js';
import { bindProfileTheme, profileThemeHtml } from '../ui/settingsProfile.js';
import { guardSettingsNav, isWideSettings, onBecomeWide, settingsBackHtml, settingsHeader, settingsNavHtml } from '../ui/settingsShell.js';

const missingProfile = () => html`<div class="glass-panel empty-state">${icon('alert', { size: 40 })}<h3>Perfil não encontrado</h3>
    <p>Não conseguimos carregar o seu perfil. Verifique se o arquivo <code>sql/schema.sql</code> foi executado no Supabase.</p></div>`;

/** Cada tema: o HTML e a ligação. `x` = { be, profile }. A ligação devolve { off, isDirty }. */
const THEMES = {
    perfil: { html: (x) => profileThemeHtml(x.profile), bind: (root, x) => bindProfileTheme(root, x.be) },
    personalizacao: { html: (x) => appearanceThemeHtml(x.profile), bind: (root, x) => bindAppearanceTheme(root, x.be, true) },
    privacidade: { html: (x) => privacyThemeHtml(x.profile, state.access), bind: (root, x) => bindPrivacyTheme(root, x.be) },
    dados: { html: () => dataPanelHtml(true), bind: (root, x) => ({ off: bindDataPanel(root, x.be), isDirty: () => false }) },
    conta: { html: () => accountThemeHtml(state.user?.email), bind: (root, x) => bindAccountTheme(root, x.be) },
};

/** Sem login: só os ajustes que valem neste navegador. */
function mountLocal(root, be) {
    document.title = `Ajustes · ${config.siteName}`;
    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('sliders', { size: 14 })} Modo local</span>
                <h1 style="margin-top:10px">Ajustes</h1>
            </div>
        </header>
        <div class="notice-box">${icon('info')}<div>Login e perfis públicos estão desativados porque o Supabase ainda não foi configurado. Siga o <code>README.md</code> para ativar.</div></div>
        <div class="settings-grid">${localAppearanceHtml()}${dataPanelHtml(false)}</div>`);
    const offData = bindDataPanel(root, be);
    const appearance = bindAppearanceTheme(root, be, false);
    return () => { offData(); appearance.off(); };
}

export function mount(root, ctx) {
    const be = backend();
    const here = ctx?.path ?? currentPath();
    const themeId = themeIdForPath(here);   // '' = índice
    const theme = themeById(themeId);
    // Só redireciona se o endereço ainda é este: se a pessoa já foi para outra tela (clique rápido), a tela nova cuida de si.
    const redirect = (to) => { if (currentPath() === here) navigate(to, { replace: true }); };

    if (!isCloud()) {
        if (themeId) { redirect(SETTINGS_ROOT); return; }   // sem login só existe a tela de ajustes
        return mountLocal(root, be);
    }

    const profile = state.profile;
    document.title = `${theme ? theme.label : 'Configurações'} · ${config.siteName}`;
    if (!profile) { setHtml(root, missingProfile()); return; }

    // No computador o índice não tem o que mostrar sozinho: abre o primeiro tema (no celular, o índice é a própria lista).
    if (!theme && isWideSettings()) { redirect(`${SETTINGS_ROOT}/${DEFAULT_THEME}`); return; }

    const view = theme ? THEMES[theme.id] : null;
    const x = { be, profile };
    setHtml(root, html`
        ${settingsHeader({ profile })}
        <div class="settings-layout" data-view="${theme ? 'theme' : 'index'}">
            ${settingsNavHtml({ active: themeId })}
            ${view ? html`<div class="settings-content">
                ${settingsBackHtml()}
                <div class="stack" data-theme="${theme.id}">${view.html(x)}</div>
            </div>` : ''}
        </div>`);

    const offs = [];
    let isDirty = () => false;
    if (view) {
        const bound = view.bind(root, x);
        offs.push(bound.off);
        isDirty = bound.isDirty;
    } else {
        offs.push(onBecomeWide(() => redirect(`${SETTINGS_ROOT}/${DEFAULT_THEME}`)));   // o celular girou: o índice vira o primeiro tema
    }
    offs.push(guardSettingsNav(root, () => isDirty()));
    return () => offs.forEach((off) => off());
}
