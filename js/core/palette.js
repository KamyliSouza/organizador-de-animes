// Aplica o preset de cores no <html> (atributo data-palette; o CSS está em css/palettes.css).
//  - "Minha paleta": vale no site inteiro para quem está logado (guardada no perfil e em cache neste navegador,
//    para já nascer certa na próxima visita, antes da página pintar: ver js/boot.js).
//  - "Paleta vista": ao abrir o perfil de OUTRA pessoa, a página usa as cores dela enquanto você estiver ali.
//    Ao sair do perfil, volta para a sua.
import { DEFAULT_PALETTE, paletteId } from '../domain/palettes.js';

const KEY = 'kamylist_palette';

const read = () => { try { return paletteId(localStorage.getItem(KEY)); } catch { return DEFAULT_PALETTE; } };
let own = read();
let viewing = null;
let viewToken = 0;

function paint(id) {
    const root = document.documentElement;
    if (!id || id === DEFAULT_PALETTE) root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', id);
}

paint(viewing ?? own);

export const ownPalette = () => own;

/** Define a minha paleta (e a guarda neste navegador). Se eu estiver vendo o perfil de outra pessoa, ele continua com as cores dela. */
export function setOwnPalette(id) {
    own = paletteId(id);
    try { localStorage.setItem(KEY, own); } catch { /* sem armazenamento: vale só nesta visita */ }
    if (viewing === null) paint(own);
}

/** Ao sair da conta: volta ao padrão e esquece o cache. */
export function clearOwnPalette() {
    own = DEFAULT_PALETTE;
    try { localStorage.removeItem(KEY); } catch { /* ok */ }
    if (viewing === null) paint(own);
}

/** Usa as cores de outra pessoa nesta página. Devolve a função que volta para as minhas. */
export function viewPalette(id) {
    const mine = ++viewToken;
    viewing = paletteId(id);
    paint(viewing);
    return () => {
        if (mine !== viewToken) return;     // outra tela já assumiu: não mexe
        viewing = null;
        paint(own);
    };
}
