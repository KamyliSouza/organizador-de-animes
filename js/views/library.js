// Tela principal: a sua biblioteca (adicionar, editar, +1 Ep, temporadas...).
import { copyText, html, on, setHtml } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { MAX_FAVORITES, addNextEpisode, favoriteCount } from '../domain/entry.js';
import { readLegacyEntries } from '../domain/backup.js';
import { REQUIRED_SCHEMA } from '../services/schema.js';
import { backend, isCloud, state } from '../services/session.js';
import { openDetailsModal, openScheduleModal, openStatsModal } from '../ui/infoModals.js';
import { mountLibraryBrowser } from '../ui/libraryBrowser.js';
import { openMediaForm } from '../ui/mediaFormModal.js';
import { openSeasonsModal } from '../ui/seasonsModal.js';
import { openShareModal } from '../ui/shareModal.js';
import { statTilesHtml } from '../ui/statTiles.js';

const dismissedKey = () => `kamylist_legacy_dismissed_${state.user?.id || 'local'}`;
const profileLink = (username) => `${location.origin}${location.pathname}#/u/${username}`;

export async function mount(root) {
    const be = backend();
    const cloud = isCloud();
    const name = state.profile?.displayName || '';

    setHtml(root, html`<div class="stat-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
        <div class="media-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`);

    let entries;
    try {
        entries = await be.library.listMine();
    } catch (err) {
        console.error(err);
        setHtml(root, html`<div class="glass-panel empty-state">${icon('alert', { size: 40 })}<h3>Não foi possível carregar sua biblioteca</h3>
            <p>${messageOf(err, 'Verifique sua conexão e tente de novo.')}</p>
            <button type="button" class="button button-primary" data-retry>Tentar de novo</button></div>`);
        root.querySelector('[data-retry]').addEventListener('click', () => location.reload());
        return;
    }

    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('film', { size: 14 })} ${cloud ? 'Minha biblioteca' : 'Modo local'}</span>
                <h1 style="margin-top:10px">${cloud && name ? `Olá, ${name}!` : 'Minha biblioteca'}</h1>
                <p class="lead">Gerenciador de animes, séries e filmes.</p>
            </div>
            <div class="page-head-actions">
                <button type="button" class="button button-secondary" data-act="schedule">${icon('calendar', { size: 17 })} Agenda</button>
                <button type="button" class="button button-secondary" data-act="stats">${icon('chart', { size: 17 })} Estatísticas</button>
                <button type="button" class="button button-primary" data-act="add">${icon('plus', { size: 17 })} Nova obra</button>
            </div>
        </header>
        <div class="stack" data-banners></div>
        <div data-tiles></div>
        <div data-browser class="stack"></div>`);

    const tiles = root.querySelector('[data-tiles]');
    const banners = root.querySelector('[data-banners]');
    let browser = null;

    const refresh = () => {
        setHtml(tiles, statTilesHtml(entries));
        browser?.setEntries(entries);
    };

    // --- avisos -------------------------------------------------------------------
    let schemaOutdated = false;   // o banco do Supabase está numa versão mais antiga que a do site

    function renderBanners() {
        const parts = [];

        if (schemaOutdated) {
            parts.push(html`<div class="notice-box is-warn" role="alert">${icon('alert')}<div>
                <strong>O banco de dados precisa ser atualizado.</strong> No Supabase, abra <strong>SQL Editor → New query</strong>, cole o conteúdo de
                <code>sql/schema.sql</code> e clique em <strong>Run</strong> (é seguro repetir). Depois recarregue esta página.
                Até lá, algumas coisas novas (status "Em espera", favoritos, foto de perfil) podem não funcionar.
            </div></div>`);
        }

        if (!cloud) {
            parts.push(html`<div class="notice-box">${icon('info')}<div>
                <strong>Modo local:</strong> sua biblioteca fica salva só neste navegador. Para ter login, perfis públicos e acessar de qualquer lugar,
                configure o Supabase (passo a passo no <code>README.md</code>). Em <a href="#/configuracoes">Ajustes</a> você exporta um backup.
            </div></div>`);
        } else if (state.profile) {
            if (state.profile.isPublic) {
                parts.push(html`<div class="notice-box">${icon('globe')}<div class="grow">
                    <strong>Seu perfil é público.</strong> Link para os amigos: <a href="${profileLink(state.profile.username)}">@${state.profile.username}</a>
                    <div class="notice-actions"><button type="button" class="button button-secondary button-sm" data-act="copy-link">${icon('copy', { size: 15 })} Copiar link</button></div>
                </div></div>`);
            } else {
                parts.push(html`<div class="notice-box">${icon('lock')}<div>
                    <strong>Seu perfil está privado.</strong> Só você vê estas obras. Para os amigos poderem ver, ative o perfil público em
                    <a href="#/configuracoes/conta">Configurações → Privacidade</a>.
                </div></div>`);
            }
        }

        if (cloud && state.user) {
            let dismissed = false;
            try { dismissed = localStorage.getItem(dismissedKey()) === '1'; } catch { /* ok */ }
            const legacy = dismissed ? [] : readLegacyEntries();
            if (legacy.length) {
                parts.push(html`<div class="notice-box">${icon('upload')}<div>
                    <strong>Encontramos ${legacy.length} ${legacy.length === 1 ? 'obra salva' : 'obras salvas'} neste navegador</strong> (da versão antiga do site).
                    Quer importar para a sua conta?
                    <div class="notice-actions">
                        <button type="button" class="button button-primary button-sm" data-act="import-legacy">Importar ${legacy.length}</button>
                        <button type="button" class="button button-ghost button-sm" data-act="dismiss-legacy">Agora não</button>
                    </div>
                </div></div>`);
            }
        }
        setHtml(banners, html`${parts}`);
    }

    // --- salvamento em segundo plano ------------------------------------------------
    // O +1 Ep responde na hora (a tela atualiza antes da rede). Os salvamentos de uma
    // mesma obra são enfileirados: cliques rápidos viram, no máximo, uma gravação em andamento
    // e outra pendente com o estado mais recente.
    const saving = new Map();
    function schedulePersist(id) {
        let st = saving.get(id);
        if (!st) { st = { running: false, again: false }; saving.set(id, st); }
        if (st.running) { st.again = true; return; }
        st.running = true;
        (async () => {
            try {
                do {
                    st.again = false;
                    const entry = entries.find((e) => e.id === id);
                    if (!entry) break;
                    try { await be.library.update(entry); }
                    catch (err) {
                        console.error(err);
                        toast(messageOf(err, 'Não foi possível salvar. A última alteração pode não ter sido gravada.'), { type: 'error' });
                    }
                } while (st.again);
            } finally { st.running = false; }
        })();
    }

    // --- ações ----------------------------------------------------------------------
    function openForm(entry = null) {
        openMediaForm({
            entry,
            existing: entries,
            onShowExisting: (found) => browser?.reveal(found.id),
            onSave: async (data) => {
                if (entry?.id) {
                    const saved = await be.library.update({ ...data, id: entry.id });
                    const i = entries.findIndex((e) => e.id === entry.id);
                    if (i >= 0) entries[i] = saved;
                    toast('Obra atualizada!', { type: 'success' });
                } else {
                    entries.unshift(await be.library.create(data));
                    toast('Obra adicionada!', { type: 'success' });
                }
                refresh();
            },
        });
    }

    function increment(entry) {
        if (addNextEpisode(entry)) schedulePersist(entry.id);
        refresh();
    }

    const actions = {
        add: () => openForm(null),
        edit: (entry) => openForm(entry),
        inc: increment,
        details: (entry) => openDetailsModal(entry),
        favorite(entry) {
            if (!entry.favorite && favoriteCount(entries) >= MAX_FAVORITES) {
                toast(`Você pode fixar até ${MAX_FAVORITES} favoritos. Tire um para favoritar outra obra.`, { type: 'info' });
                return;
            }
            entry.favorite = !entry.favorite;
            toast(entry.favorite ? (cloud ? 'Adicionada aos favoritos (aparece no topo do seu perfil).' : 'Adicionada aos favoritos.') : 'Removida dos favoritos.', { type: 'success' });
            schedulePersist(entry.id);
            refresh();
        },
        seasons: (entry) => openSeasonsModal({ entry, onChange: (e) => { schedulePersist(e.id); refresh(); } }),
        share: (entry) => openShareModal({ entry, owner: cloud ? state.profile?.username : '' }),
        async delete(entry) {
            const yes = await confirmDialog({
                title: 'Excluir obra', danger: true, confirmLabel: 'Excluir',
                message: `Tem certeza que deseja remover "${entry.title}" da sua biblioteca? Isso não pode ser desfeito.`,
            });
            if (!yes) return;
            try {
                await be.library.remove(entry.id);
                entries.splice(entries.findIndex((e) => e.id === entry.id), 1);
                refresh();
                toast('Obra removida.', { type: 'info' });
            } catch (err) {
                toast(messageOf(err, 'Não foi possível excluir a obra.'), { type: 'error' });
            }
        },
    };

    browser = mountLibraryBrowser(root.querySelector('[data-browser]'), { entries, actions });

    // --- cabeçalho e avisos ---------------------------------------------------------
    const off = on(root, 'click', '[data-act]', async (_, btn) => {
        switch (btn.dataset.act) {
            case 'add': openForm(null); break;
            case 'stats': openStatsModal(entries); break;
            case 'schedule': openScheduleModal({ getEntries: () => entries, onIncrement: increment }); break;
            case 'copy-link': {
                const ok = await copyText(profileLink(state.profile.username));
                toast(ok ? 'Link copiado!' : 'Não foi possível copiar o link.', { type: ok ? 'success' : 'error' });
                break;
            }
            case 'dismiss-legacy':
                try { localStorage.setItem(dismissedKey(), '1'); } catch { /* ok */ }
                renderBanners();
                break;
            case 'import-legacy': {
                btn.disabled = true;
                try {
                    const created = await be.library.addMany(readLegacyEntries());
                    entries.unshift(...created);
                    try { localStorage.setItem(dismissedKey(), '1'); } catch { /* ok */ }
                    toast(`${created.length} obras importadas para a sua conta!`, { type: 'success' });
                    renderBanners();
                    refresh();
                } catch (err) {
                    btn.disabled = false;
                    toast(messageOf(err, 'Não foi possível importar as obras.'), { type: 'error' });
                }
                break;
            }
            default: break;
        }
    });

    renderBanners();
    refresh();

    if (cloud && state.user) {
        be.meta?.schemaVersion?.().then((v) => {
            if (v !== null && v < REQUIRED_SCHEMA) { schemaOutdated = true; renderBanners(); }
        }).catch(() => {});
    }

    return () => { off(); browser.destroy(); };
}
