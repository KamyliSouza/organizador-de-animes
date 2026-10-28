// Explorar: lista de perfis públicos com busca.
import { debounce, html, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { backend, isCloud, state } from '../services/session.js';
import { avatar, avatarSrc } from '../ui/avatar.js';

const profileCard = (p) => html`
    <a class="profile-card glass-panel" href="#/u/${p.username}" aria-label="Ver perfil de ${p.displayName}">
        <header>
            ${avatar(p.displayName || p.username, 46, avatarSrc(p))}
            <div style="min-width:0"><h3>${p.displayName}</h3><p class="handle">@${p.username}</p></div>
        </header>
        <p class="bio">${p.bio || 'Sem descrição.'}</p>
        <footer>
            <span><b>${p.total}</b> ${p.total === 1 ? 'obra' : 'obras'}</span>
            <span><b>${p.watching}</b> em andamento</span>
            <span><b>${p.completed}</b> concluídas</span>
        </footer>
    </a>`;

export function mount(root) {
    document.title = 'Explorar · KamyList';

    if (!isCloud()) {
        setHtml(root, html`<div class="glass-panel empty-state">${icon('lock', { size: 44 })}<h3>Explorar precisa do login ativado</h3>
            <p>Configure o Supabase em js/config.js (passo a passo no README.md) para ter perfis públicos.</p></div>`);
        return;
    }

    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('compass', { size: 14 })} Comunidade</span>
                <h1 style="margin-top:10px">Explorar perfis</h1>
                <p class="lead">Veja o que outras pessoas estão assistindo e lendo.</p>
            </div>
            <div class="search-field" style="max-width:340px">
                ${icon('search', { size: 16 })}
                <input class="input" type="search" data-search placeholder="Buscar por nome ou @usuário..." aria-label="Buscar perfis" autocomplete="off">
            </div>
        </header>
        <div data-results aria-live="polite"></div>
        ${state.user && state.profile && !state.profile.isPublic ? html`
            <div class="notice-box">${icon('lock')}<div>Seu perfil está privado e não aparece aqui. <a href="#/configuracoes/conta">Tornar público</a></div></div>` : ''}
        ${!state.user ? html`<div class="notice-box">${icon('info')}<div><a href="#/criar-conta">Crie sua conta</a> para ter seu próprio perfil e aparecer aqui.</div></div>` : ''}`);

    const results = root.querySelector('[data-results]');
    let token = 0;

    async function load(query) {
        const mine = ++token;
        setHtml(results, html`<div class="center muted" style="padding:40px 0">${spinner(26)}</div>`);
        try {
            const list = await backend().profiles.listPublic({ query, limit: 30 });
            if (mine !== token) return;
            if (!list.length) {
                setHtml(results, html`<div class="glass-panel empty-state">${icon('users', { size: 44 })}<h3>${query ? 'Nenhum perfil encontrado' : 'Ainda não há perfis públicos'}</h3>
                    <p>${query ? 'Tente outro nome.' : 'Comece você: deixe seu perfil público em Perfil e configurações.'}</p></div>`);
                return;
            }
            setHtml(results, html`<div class="profile-grid">${list.map(profileCard)}</div>`);
        } catch (err) {
            if (mine !== token) return;
            console.error(err);
            setHtml(results, html`<div class="notice-box is-error" role="alert">${icon('alert')}<div>${messageOf(err, 'Não foi possível carregar os perfis.')}</div></div>`);
        }
    }

    const search = debounce((value) => load(value.trim()), 300);
    root.querySelector('[data-search]').addEventListener('input', (e) => search(e.target.value));
    load('');

    return () => { search.cancel(); token++; };
}
