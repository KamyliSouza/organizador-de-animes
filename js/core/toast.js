import { html, setHtml } from './dom.js';
import { icon } from './icons.js';

const ICONS = { success: 'checkCircle', error: 'alert', info: 'info' };

/** Aviso rápido no canto da tela. type: 'success' | 'error' | 'info'. `action` = { label, href } acrescenta um link no fim (ex.: "Ver"). */
export function toast(message, { type = 'info', timeout, action } = {}) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    setHtml(node, html`${icon(ICONS[type] || 'info')}<span>${message}</span>${action?.href ? html`<a class="toast-action" href="${action.href}">${action.label}</a>` : ''}`);
    region.appendChild(node);

    const ms = timeout ?? (type === 'error' ? 6500 : 3800);
    setTimeout(() => node.remove(), ms);
    while (region.children.length > 4) region.firstElementChild.remove();
}
