// Selo de cargo ao lado do nome ("Dona", "Admin", "Mod"). Membros não têm selo.
import { html } from '../core/dom.js';
import { ROLES, normalizeRole } from '../domain/roles.js';

/** Devolve '' para membros. O nome completo vai no `title` e no texto para leitor de tela. */
export function roleBadge(role) {
    const key = normalizeRole(role);
    if (key === 'member') return '';
    const r = ROLES[key];
    return html`<span class="role-badge role-${key}" title="${r.long}"><span aria-hidden="true">${r.short}</span><span class="sr-only">${r.long}</span></span>`;
}
