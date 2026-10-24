// Tema claro/escuro. Sem preferência salva, segue o sistema.
const KEY = 'kamylist_theme';
const listeners = new Set();

export function currentTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* sem armazenamento: vale só nesta visita */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#d178cd' : '#B35EAF');
    listeners.forEach((fn) => fn(theme));
}

export function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
