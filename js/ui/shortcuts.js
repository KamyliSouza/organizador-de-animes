// Atalhos da biblioteca para o menu lateral: Agenda (só na aba Anime), Favoritos e Estatísticas.
// A biblioteca guarda a lista na memória e sabe abrir cada janela; por isso, quem faz o atalho é ela.
// Fora da biblioteca, o pedido fica guardado, o site abre a biblioteca e ela cumpre o pedido assim que carregar.
import { currentPath, navigate } from '../core/router.js';

/** Nome de cada atalho (a ordem é a do menu). */
export const SHORTCUTS = ['schedule', 'favorites', 'stats'];

/** Um pedido guardado vale por pouco tempo: se a biblioteca não abrir (erro de rede), ele não pode disparar horas depois. */
const PENDING_MS = 15_000;

let handlers = null;      // a biblioteca registra enquanto está na tela
let pending = null;       // { name, at }

/** Quem tem o atalho na tela agora: só a aba Anime tem Agenda. */
export const shortcutsFor = (section) => SHORTCUTS.filter((name) => name !== 'schedule' || section === 'anime');

/**
 * A biblioteca registra como cumprir cada atalho: `{ schedule, favorites, stats }`.
 * Se havia um pedido esperando por ela, ele é cumprido agora. Devolve a função que desfaz o registro.
 */
export function registerLibraryShortcuts(map) {
    handlers = map;
    if (pending) {
        const { name, at } = pending;
        pending = null;
        if (Date.now() - at <= PENDING_MS) handlers[name]?.();
    }
    return () => { if (handlers === map) handlers = null; };
}

/** Atalho pedido pelo menu lateral, de qualquer tela. */
export function requestShortcut(name) {
    if (!SHORTCUTS.includes(name)) return;
    if (handlers) { handlers[name]?.(); return; }
    pending = { name, at: Date.now() };
    if (currentPath() !== '/') navigate('/');       // já em "/": a biblioteca ainda está carregando e cumpre o pedido ao abrir
}

/** Só para testes: esquece o estado. */
export function resetShortcuts() { handlers = null; pending = null; }
