// Alto contraste: opção de acessibilidade PRIVADA de quem a liga.
//  - Aparece como data-contrast="high" no <html> e vale para o site inteiro, por cima de qualquer tema e de qualquer paleta (css/contrast.css).
//  - Só vale para quem ligou: abrir o perfil de outra pessoa NÃO traz a opção dela (as cores do perfil dela, sim, mas o seu alto contraste continua por cima).
//  - Com login, a opção fica guardada na conta (tabela user_prefs) e aqui em cache neste navegador, para já nascer certa
//    na próxima visita, antes da página pintar (ver js/boot.js). Ao sair da conta o cache é apagado.
//  - Sem login (modo local) fica só neste navegador.
const KEY = 'kamylist_contrast';
const ATTR = 'data-contrast';

const read = () => { try { return localStorage.getItem(KEY) === 'high'; } catch { return false; } };
let on = read();

function paint() {
    const root = document.documentElement;
    if (on) root.setAttribute(ATTR, 'high');
    else root.removeAttribute(ATTR);
}

paint();

export const highContrast = () => on;

/** Liga ou desliga na hora e guarda neste navegador. */
export function setHighContrast(value) {
    on = Boolean(value);
    try { if (on) localStorage.setItem(KEY, 'high'); else localStorage.removeItem(KEY); } catch { /* sem armazenamento: vale só nesta visita */ }
    paint();
}

/** Ao sair da conta: volta ao visual normal e esquece o cache (a próxima pessoa não herda a opção). */
export const clearHighContrast = () => setHighContrast(false);
