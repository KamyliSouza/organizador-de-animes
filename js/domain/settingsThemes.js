// Os temas da tela de Configurações e os endereços de cada um. Só dados e contas simples (sem tela):
// a parte visual fica em js/ui/settingsShell.js e js/views/settings.js.
//
// Endereços:
//   #/configuracoes             o índice (no celular a lista de temas; no computador abre o primeiro tema, "Perfil e foto")
//   #/configuracoes/perfil, /personalizacao, /privacidade, /dados, /conta   um tema cada
// Os endereços antigos continuam valendo: #/configuracoes abre o índice e #/configuracoes/conta abre o tema Conta.

export const SETTINGS_ROOT = '/configuracoes';

export const SETTINGS_THEMES = [
    { id: 'perfil', label: 'Perfil e foto', icon: 'user', hint: 'Foto, nome de exibição, nome de usuário e “sobre você”' },
    { id: 'personalizacao', label: 'Personalização', icon: 'sparkles', hint: 'Cores, fundo do perfil e alto contraste' },
    { id: 'privacidade', label: 'Privacidade', icon: 'globe', hint: 'Perfil público, anotações e abas visíveis' },
    { id: 'dados', label: 'Dados e backup', icon: 'download', hint: 'Exportar e importar a sua biblioteca' },
    { id: 'conta', label: 'Conta', icon: 'lock', hint: 'E-mail, senha, sair da conta e excluir a conta' },
].map((t) => ({ ...t, path: `${SETTINGS_ROOT}/${t.id}` }));

/** O tema que abre sozinho no computador quando alguém chega no índice. */
export const DEFAULT_THEME = SETTINGS_THEMES[0].id;

export const themeById = (id) => SETTINGS_THEMES.find((t) => t.id === id) || null;

/**
 * Qual parte das Configurações é este caminho (sem o "#")?
 *   ''     o índice (#/configuracoes)
 *   'conta' etc.   o id do tema
 *   null   não é uma tela de Configurações
 */
export function themeIdForPath(path) {
    const clean = String(path || '').split('?')[0].replace(/\/+$/, '');
    if (clean === SETTINGS_ROOT) return '';
    const hit = SETTINGS_THEMES.find((t) => t.path === clean);
    return hit ? hit.id : null;
}

/** O endereço (com "#", para usar em href) de um tema, ou do índice quando não há id. */
export const themeHref = (id) => `#${id ? `${SETTINGS_ROOT}/${id}` : SETTINGS_ROOT}`;
