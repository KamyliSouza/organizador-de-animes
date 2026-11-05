// Menu da conta (o avatar no canto superior direito): quais itens aparecem e como o teclado anda por eles.
// Só contas simples, sem tela: a parte visual fica em js/ui/accountMenu.js.
import { isStaff } from './roles.js';

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/**
 * Itens de navegação do menu, na ordem em que aparecem. "Sair" não entra aqui (é um botão, não um endereço).
 * `username` vazio (perfil ainda não carregou) = sem "Meu perfil". `path` é a rota atual (sem o "#"); marca o item da tela aberta.
 */
export function accountMenuItems({ username, role, path }) {
    const here = String(path || '/');
    const items = [];
    if (username) items.push({ id: 'profile', href: `#/u/${username}`, label: 'Meu perfil', icon: 'user', current: same(here, `/u/${username}`) });
    items.push({ id: 'customize', href: '#/configuracoes', label: 'Personalização', icon: 'sparkles', current: here === '/configuracoes' });
    items.push({ id: 'settings', href: '#/configuracoes/conta', label: 'Configurações', icon: 'sliders', current: here === '/configuracoes/conta' });
    if (isStaff(role)) items.push({ id: 'admin', href: '#/admin', label: 'Painel da equipe', icon: 'shield', current: here === '/admin' || here.startsWith('/admin/') });
    return items;
}

/** A tela atual pertence à conta (perfil próprio, personalização ou configurações)? Deixa o botão do avatar "aceso". */
export function isAccountPath(path, username) {
    const here = String(path || '/');
    return here === '/configuracoes' || here.startsWith('/configuracoes/') || Boolean(username && same(here, `/u/${username}`));
}

/**
 * Qual item recebe o foco depois de uma tecla dentro do menu (índice de 0 a count-1), ou -1 se a tecla não é de navegação.
 * Setas dão a volta (da última para a primeira e vice-versa); Home e End vão às pontas. `index` = item com foco agora (-1 = nenhum).
 */
export function nextMenuIndex(key, index, count) {
    if (count <= 0) return -1;
    switch (key) {
        case 'ArrowDown': return index < 0 || index >= count - 1 ? 0 : index + 1;
        case 'ArrowUp': return index <= 0 ? count - 1 : index - 1;
        case 'Home': return 0;
        case 'End': return count - 1;
        default: return -1;
    }
}
