import { html, setHtml } from './dom.js';
import { icon } from './icons.js';

const ICONS = { success: 'checkCircle', error: 'alert', info: 'info' };

/** Aviso rápido no canto da tela. type: 'success' | 'error' | 'info'. */
export function toast(message, { type = 'info', timeout } = {}) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    setHtml(node, html`${icon(ICONS[type] || 'info')}<span>${message}</span>`);
    region.appendChild(node);

    const ms = timeout ?? (type === 'error' ? 6500 : 3800);
    setTimeout(() => node.remove(), ms);
    while (region.children.length > 4) region.firstElementChild.remove();
}
