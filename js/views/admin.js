// Painel da equipe (#/admin): membros, denúncias, registro de ações e configurações do site.
// Quem pode ver o quê: Moderação vê membros, denúncias e registro; Administração e Dona também as configurações.
// Esconder botões aqui é só conforto: cada função do banco confere o cargo de novo.
import { config } from '../config.js';
import { debounce, html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { timeAgo } from '../core/time.js';
import { toast } from '../core/toast.js';
import { REMOVED_MARK, mediaState, removableFields, wipeField } from '../domain/reportSnapshot.js';
import { parseHostList } from '../domain/textSafety.js';
import { ROLES, actionLabel, canAct, canEditSetting, describeDetails, isStaff, motiveLabel, rankOf } from '../domain/roles.js';
import { backend, isCloud, myRole, refreshAccess, state } from '../services/session.js';
import { confirmDialog } from '../core/dialogs.js';
import { avatar, avatarSrc } from '../ui/avatar.js';
import { backgroundSrc } from '../ui/profileBackground.js';
import { openMemberModal } from '../ui/memberModal.js';
import { roleBadge } from '../ui/roleBadge.js';

export const ADMIN_TABS = [
    { id: 'membros', name: 'admin', path: '/admin', label: 'Membros', icon: 'users', rank: 1 },
    { id: 'denuncias', name: 'admin-reports', path: '/admin/denuncias', label: 'Denúncias', icon: 'flag', rank: 1 },
    { id: 'registro', name: 'admin-log', path: '/admin/registro', label: 'Registro', icon: 'list', rank: 1 },
    { id: 'configuracoes', name: 'admin-settings', path: '/admin/configuracoes', label: 'Site', icon: 'sliders', rank: 2 },
];

const PAGE = 30;
const ANNOUNCEMENT_MAX = 280;

const errorBox = (err, fallback) => html`<div class="notice-box is-error" role="alert">${icon('alert')}<div>${messageOf(err, fallback)}</div></div>`;
const loading = () => html`<div class="center muted" style="padding:32px 0">${spinner(26)}</div>`;
const empty = (iconName, title, text) => html`<div class="glass-panel empty-state">${icon(iconName, { size: 40 })}<h3>${title}</h3><p>${text}</p></div>`;

// ---------------------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------------------
const memberRow = (m) => html`
    <li class="admin-row" data-member="${m.id}">
        <div class="admin-who">
            ${avatar(m.displayName, 44, avatarSrc(m))}
            <span class="person-names">
                <span class="name-line"><b class="truncate">${m.displayName}</b>${roleBadge(m.role)}</span>
                <span class="muted small truncate">@${m.username} · ${m.totalEntries} ${m.totalEntries === 1 ? 'obra' : 'obras'} · desde ${timeAgo(m.createdAt)}</span>
                ${m.suspended || m.openReports > 0 || !m.isPublic ? html`<span class="admin-flags">
                    ${m.suspended ? html`<span class="badge badge-danger">Suspensa</span>` : ''}
                    ${m.openReports > 0 ? html`<span class="badge badge-planned">${m.openReports} ${m.openReports === 1 ? 'denúncia' : 'denúncias'}</span>` : ''}
                    ${!m.isPublic ? html`<span class="badge badge-muted">${icon('lock', { size: 11 })} Privado</span>` : ''}
                </span>` : ''}
            </span>
        </div>
        <span class="request-actions">
            <a class="button button-ghost button-sm" href="#/u/${m.username}">Ver perfil</a>
            ${m.canAct
                ? html`<button type="button" class="button button-secondary button-sm" data-manage="${m.id}">${icon('shield', { size: 15 })} Gerenciar</button>`
                : html`<span class="muted small" title="Você só age sobre quem tem um cargo menor que o seu.">${m.id === state.user?.id ? 'Você' : 'Sem permissão'}</span>`}
        </span>
    </li>`;

function mountMembers(box, { be, role }) {
    setHtml(box, html`
        <div class="admin-bar">
            <div class="search-field">
                ${icon('search', { size: 16 })}
                <input class="input" type="search" data-search placeholder="Buscar por nome ou @usuário..." aria-label="Buscar membros" autocomplete="off">
            </div>
        </div>
        <div data-list aria-live="polite" class="stack"></div>`);
    const list = box.querySelector('[data-list]');
    const search = box.querySelector('[data-search]');
    let token = 0;
    let query = '';
    let members = [];
    let more = false;

    const paint = () => {
        if (!members.length) {
            setHtml(list, empty('users', query ? 'Ninguém encontrado' : 'Ainda não há membros', query ? 'Tente outro nome ou @usuário.' : ''));
            return;
        }
        setHtml(list, html`
            <ul class="admin-list glass-panel">${members.map(memberRow)}</ul>
            ${more ? html`<div class="admin-more"><button type="button" class="button button-secondary" data-more>Mostrar mais</button></div>` : ''}`);
    };

    async function load({ append = false } = {}) {
        const mine = ++token;
        if (!append) setHtml(list, loading());
        try {
            const rows = await be.moderation.members({ query, limit: PAGE, offset: append ? members.length : 0 });
            if (mine !== token) return;
            members = append ? [...members, ...rows] : rows;
            more = rows.length === PAGE;
            paint();
        } catch (err) {
            if (mine !== token) return;
            console.error(err);
            setHtml(list, errorBox(err, 'Não foi possível carregar os membros.'));
        }
    }

    const run = debounce((value) => { query = value.trim(); load(); }, 300);
    search.addEventListener('input', (e) => run(e.target.value));
    const offs = [
        on(list, 'click', '[data-more]', (_, btn) => { btn.disabled = true; load({ append: true }); }),
        on(list, 'click', '[data-manage]', (_, btn) => {
            const m = members.find((x) => x.id === btn.dataset.manage);
            if (m) openMemberModal({ member: m, actorRole: role, moderation: be.moderation, onChanged: () => load() });
        }),
    ];
    load();
    return () => { run.cancel(); token++; offs.forEach((off) => off()); };
}

// ---------------------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------------------
const STATUS_LABEL = { open: 'Em aberto', resolved: 'Resolvida', dismissed: 'Descartada' };

// Cópia do perfil na hora da denúncia (snapshot) e o que mudou depois. As imagens antigas não são guardadas: só a versão.
const MEDIA_NOTE = {
    none: 'Não tinha.',
    same: 'Continua a mesma imagem.',
    gone: 'Tinha; já foi removida.',
    changed: 'Tinha; foi trocada depois (a imagem antiga não é guardada).',
    added: 'Não tinha; colocou uma depois.',
};

const wipeButton = (r, key, entryId = '') => html`<button type="button" class="button button-ghost button-sm" data-wipe="${key}" data-report="${r.id}" ${entryId ? html`data-entry="${entryId}"` : ''}>${icon('trash', { size: 14 })} Remover ${wipeField(key)?.short || key}</button>`;

function snapshotBlock(r, mayAct, isOpen) {
    const s = r.snapshot;
    if (!s) return html`<p class="report-meta">Esta denúncia é de antes do snapshot: não há cópia do que a pessoa mostrava na hora.</p>`;
    const t = r.target;
    const nameNow = t.displayName;
    const nameThen = s.displayName || s.username;
    const photo = mediaState(s.avatarV, t.avatarV);
    const bg = mediaState(s.bgV, t.bgV);
    const changed = (flag) => (flag ? html` <span class="badge badge-muted">mudou depois</span>` : '');
    return html`
        <details class="report-snapshot" data-snap="${r.id}" ${isOpen ? 'open' : ''}>
            <summary>Como estava na hora da denúncia</summary>
            <dl class="snap-list">
                <div class="snap-row"><dt>Nome</dt><dd>
                    <span class="snap-text">${nameThen}</span>${changed(nameThen !== nameNow)}
                    ${mayAct && nameNow !== REMOVED_MARK ? wipeButton(r, 'display_name') : ''}</dd></div>
                <div class="snap-row"><dt>@usuário</dt><dd><span class="snap-text">@${s.username}</span>${changed(s.username !== t.username)}</dd></div>
                <div class="snap-row"><dt>Bio</dt><dd>
                    <span class="snap-text">${s.bio || '(vazia)'}</span>${changed(s.bio !== t.bio)}
                    ${mayAct && s.bio !== '' && t.bio !== '' && t.bio !== REMOVED_MARK ? wipeButton(r, 'bio') : ''}</dd></div>
                <div class="snap-row"><dt>Foto</dt><dd>
                    ${photo === 'same' ? html`<span class="snap-media">${avatar(nameThen, 56, avatarSrc(t))}</span>` : ''}
                    <span class="snap-text">${MEDIA_NOTE[photo]}</span></dd></div>
                <div class="snap-row"><dt>Fundo</dt><dd>
                    ${bg === 'same' && backgroundSrc(t) ? html`<img class="snap-bg" src="${backgroundSrc(t)}" alt="" width="160" height="90" loading="lazy" referrerpolicy="no-referrer">` : ''}
                    <span class="snap-text">${MEDIA_NOTE[bg]}</span></dd></div>
            </dl>
            <h4 class="snap-title">Obras que quem denunciou conseguia ver</h4>
            ${!s.entriesVisible ? html`<p class="field-hint">O perfil era privado para quem denunciou: nenhum texto de obra foi copiado.</p>`
                : !s.entries.length ? html`<p class="field-hint">Nenhuma obra com título digitado, análise, anotações ou tags.</p>`
                : html`<ul class="snap-entries">${s.entries.map((e) => {
                    const todo = removableFields(e);
                    return html`
                    <li class="snap-entry" data-snap-entry="${e.id}">
                        <b class="snap-entry-title">${e.title}</b> <span class="muted small">${e.category}${e.manual ? ' · título digitado' : ''}</span>
                        ${e.review ? html`<p class="snap-text"><span class="muted small">Análise:</span> ${e.review}</p>` : ''}
                        ${e.notes ? html`<p class="snap-text"><span class="muted small">Anotações:</span> ${e.notes}</p>` : ''}
                        ${e.tags.length ? html`<p class="snap-text"><span class="muted small">Tags:</span> ${e.tags.join(', ')}</p>` : ''}
                        ${mayAct && todo.length ? html`<div class="report-actions">${todo.map((k) => wipeButton(r, k, e.id))}</div>` : ''}
                    </li>`;
                })}</ul>`}
            <p class="field-hint">Os botões "Remover" valem para o texto de hoje. A cópia acima continua guardada na denúncia.</p>
        </details>`;
}

const reportCard = (r, role, openSnaps = new Set()) => html`
    <article class="report-card glass-panel" data-report="${r.id}">
        <header class="report-head">
            <div class="admin-who">
                ${avatar(r.target.displayName, 44, avatarSrc(r.target))}
                <span class="person-names">
                    <span class="name-line"><b class="truncate">${r.target.displayName}</b>${roleBadge(r.target.role)}</span>
                    <span class="muted small truncate">@${r.target.username}</span>
                </span>
            </div>
            <span class="admin-flags">
                <span class="badge badge-planned">${motiveLabel(r.reason)}</span>
                ${r.target.suspended ? html`<span class="badge badge-danger">Suspensa</span>` : ''}
                ${r.status !== 'open' ? html`<span class="badge badge-muted">${STATUS_LABEL[r.status] || r.status}</span>` : ''}
            </span>
        </header>
        ${r.details ? html`<p class="report-details">${r.details}</p>` : ''}
        ${snapshotBlock(r, canAct(role, r.target.role), openSnaps.has(r.id))}
        <p class="report-meta">Denunciado por ${r.reporter ? `@${r.reporter}` : 'uma conta excluída'} · ${timeAgo(r.createdAt)}${r.handledBy ? html` · tratada por @${r.handledBy} ${timeAgo(r.handledAt)}` : ''}</p>
        <div class="report-actions">
            <a class="button button-ghost button-sm" href="#/u/${r.target.username}">Ver perfil</a>
            ${canAct(role, r.target.role) ? html`<button type="button" class="button button-secondary button-sm" data-manage="${r.id}">${icon('shield', { size: 15 })} Gerenciar</button>
            <button type="button" class="button button-secondary button-sm" data-reset-media="${r.id}">${icon('image', { size: 15 })} Zerar foto e fundo</button>` : ''}
            ${r.status === 'open' ? html`
                <button type="button" class="button button-primary button-sm" data-close-report="resolved" data-id="${r.id}">${icon('check', { size: 15 })} Resolver</button>
                <button type="button" class="button button-ghost button-sm" data-close-report="dismissed" data-id="${r.id}">Descartar</button>` : html`
                <button type="button" class="button button-ghost button-sm" data-close-report="open" data-id="${r.id}">Reabrir</button>`}
        </div>
    </article>`;

function mountReports(box, { be, role, onCount }) {
    setHtml(box, html`
        <div class="admin-bar">
            <div class="field" style="min-width:min(200px, 100%)">
                <label for="rp-filter">Mostrar</label>
                <select id="rp-filter" class="select" data-filter>
                    <option value="open">Em aberto</option>
                    <option value="resolved">Resolvidas</option>
                    <option value="dismissed">Descartadas</option>
                    <option value="all">Todas</option>
                </select>
            </div>
        </div>
        <div data-list aria-live="polite"></div>`);
    const list = box.querySelector('[data-list]');
    const filter = box.querySelector('[data-filter]');
    let token = 0;
    let reports = [];
    const openSnaps = new Set();   // cópias abertas: continuam abertas depois de remover algo e recarregar a lista

    async function load() {
        const mine = ++token;
        setHtml(list, loading());
        try {
            const rows = await be.moderation.reports({ status: filter.value, limit: 50 });
            if (mine !== token) return;
            reports = rows;
            if (filter.value === 'open') onCount(rows.length);
            setHtml(list, rows.length
                ? html`<div class="report-list">${rows.map((r) => reportCard(r, role, openSnaps))}</div>`
                : empty('checkCircle', filter.value === 'open' ? 'Nenhuma denúncia em aberto' : 'Nada por aqui', filter.value === 'open' ? 'Tudo em dia.' : 'Nenhuma denúncia com essa situação.'));
        } catch (err) {
            if (mine !== token) return;
            console.error(err);
            setHtml(list, errorBox(err, 'Não foi possível carregar as denúncias.'));
        }
    }

    filter.addEventListener('change', load);
    const offs = [
        // "toggle" e "error" não sobem na árvore: ouvintes em fase de captura
        on(list, 'toggle', 'details[data-snap]', (_, d) => { const id = Number(d.dataset.snap); if (d.open) openSnaps.add(id); else openSnaps.delete(id); }, true),
        on(list, 'error', 'img.snap-bg', (_, img) => img.remove(), true),
        on(list, 'click', '[data-close-report]', async (_, btn) => {
            btn.disabled = true;
            try {
                await be.moderation.resolveReport(Number(btn.dataset.id), btn.dataset.closeReport);
                toast(btn.dataset.closeReport === 'open' ? 'Denúncia reaberta.' : btn.dataset.closeReport === 'resolved' ? 'Denúncia resolvida.' : 'Denúncia descartada.', { type: 'success' });
                await load();
                if (filter.value !== 'open') { /* a contagem de abertas só muda ao ver a fila de abertas */ onCount(null); }
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                toast(messageOf(err, 'Não foi possível atualizar a denúncia.'), { type: 'error' });
            }
        }),
        on(list, 'click', '[data-manage]', (_, btn) => {
            const r = reports.find((x) => String(x.id) === btn.dataset.manage);
            if (r) openMemberModal({ member: { ...r.target, suspensionReason: '' }, actorRole: role, moderation: be.moderation, onChanged: () => load() });
        }),
        on(list, 'click', '[data-reset-media]', async (_, btn) => {
            const r = reports.find((x) => String(x.id) === btn.dataset.resetMedia);
            if (!r) return;
            const yes = await confirmDialog({
                title: 'Zerar foto e fundo',
                message: `Tirar a foto de perfil e a imagem de fundo de @${r.target.username}? Isso não tem como desfazer, mas fica no registro de ações. A pessoa pode colocar outras depois.`,
                confirmLabel: 'Zerar', danger: true,
            });
            if (!yes) return;
            btn.disabled = true;
            try {
                await be.moderation.resetProfile(r.target.id, ['avatar', 'background']);
                toast('Foto e fundo zerados.', { type: 'success' });
                await load();
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                toast(messageOf(err, 'Não foi possível zerar a foto e o fundo.'), { type: 'error' });
            }
        }),
        on(list, 'click', '[data-wipe]', async (_, btn) => {
            const r = reports.find((x) => String(x.id) === btn.dataset.report);
            const key = btn.dataset.wipe;
            const field = wipeField(key);
            if (!r || !field) return;
            const entryId = btn.dataset.entry || null;
            const yes = await confirmDialog({
                title: 'Remover conteúdo',
                message: `Remover ${field.label.toLowerCase()} ${entryId ? 'desta obra' : ''} de @${r.target.username}? O texto vira “${REMOVED_MARK}” (tags ficam vazias). Progresso, nota e status não mudam. Isso não tem como desfazer, mas fica no registro de ações, e a denúncia continua guardando a cópia.`,
                confirmLabel: 'Remover', danger: true,
            });
            if (!yes) return;
            btn.disabled = true;
            try {
                const n = await be.moderation.wipeText(r.target.id, [key], entryId);
                toast(n > 0 ? 'Conteúdo removido.' : 'Nada para remover: já estava removido ou vazio.', { type: n > 0 ? 'success' : 'info' });
                await load();
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                toast(messageOf(err, 'Não foi possível remover o conteúdo.'), { type: 'error' });
            }
        }),
    ];
    load();
    return () => { token++; offs.forEach((off) => off()); };
}

// ---------------------------------------------------------------------------------------
// Registro de ações
// ---------------------------------------------------------------------------------------
const stamp = (iso) => {
    const t = Date.parse(String(iso || '').replace(/(\.\d{3})\d+/, '$1'));
    return Number.isFinite(t) ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
};

const logRow = (l) => {
    const extra = describeDetails(l.action, l.details);
    return html`
    <li class="log-row" data-log="${l.id}">
        <time class="log-time" datetime="${l.at}">${stamp(l.at)}</time>
        <span class="log-text"><b>${l.actor || 'Alguém'}</b> ${actionLabel(l.action)}${l.target ? html` <b>${l.target}</b>` : ''}${extra ? html`<span class="log-extra">${extra}</span>` : ''}</span>
    </li>`;
};

function mountLog(box, { be }) {
    setHtml(box, html`<div data-list aria-live="polite"></div>`);
    const list = box.querySelector('[data-list]');
    let token = 0;
    let rows = [];
    let more = false;

    const paint = () => setHtml(list, rows.length ? html`
        <ul class="log-list glass-panel">${rows.map(logRow)}</ul>
        ${more ? html`<div class="admin-more"><button type="button" class="button button-secondary" data-more>Mostrar mais</button></div>` : ''}`
        : empty('list', 'O registro está vazio', 'As ações da equipe aparecem aqui.'));

    async function load({ append = false } = {}) {
        const mine = ++token;
        if (!append) setHtml(list, loading());
        try {
            const got = await be.moderation.log({ limit: PAGE, before: append ? rows[rows.length - 1]?.id : null });
            if (mine !== token) return;
            rows = append ? [...rows, ...got] : got;
            more = got.length === PAGE;
            paint();
        } catch (err) {
            if (mine !== token) return;
            console.error(err);
            setHtml(list, errorBox(err, 'Não foi possível carregar o registro.'));
        }
    }

    const off = on(list, 'click', '[data-more]', (_, btn) => { btn.disabled = true; load({ append: true }); });
    load();
    return () => { token++; off(); };
}

// ---------------------------------------------------------------------------------------
// Configurações do site
// ---------------------------------------------------------------------------------------
const parseWords = (text) => [...new Set(String(text || '').split(/[\n,;]+/).map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2))];

function mountSettings(box, { be, role }) {
    setHtml(box, loading());
    let dead = false;
    const offs = [];

    (async () => {
        let s;
        try { s = await be.moderation.settings(); } catch (err) {
            if (dead) return;
            console.error(err);
            setHtml(box, errorBox(err, 'Não foi possível carregar as configurações.'));
            return;
        }
        if (dead) return;
        const canSignups = canEditSetting(role, 'signups_open');
        const canText = canEditSetting(role, 'announcement');

        setHtml(box, html`
        <div class="admin-settings">
            <section class="panel glass-panel" aria-labelledby="ad-signups">
                <h2 id="ad-signups">${icon('userPlus')} Cadastros</h2>
                <label class="switch-row">
                    <input type="checkbox" id="ad-signups-open" ${s.signupsOpen ? 'checked' : ''} ${canSignups ? '' : 'disabled'}>
                    <span><span class="switch-title">Aceitar novas contas</span><br>
                    <span class="switch-desc">Desligado, ninguém novo consegue criar conta (quem já tem conta continua entrando normalmente). ${canSignups ? '' : 'Só a Dona do site muda isto.'}</span></span>
                </label>
            </section>

            <section class="panel glass-panel" aria-labelledby="ad-notice">
                <h2 id="ad-notice">${icon('info')} Aviso do site</h2>
                <form data-form="announcement" class="stack" novalidate>
                    <div class="field">
                        <label for="ad-announcement">Texto do aviso <span class="muted">(aparece no topo para todo mundo; deixe vazio para tirar)</span></label>
                        <textarea id="ad-announcement" class="textarea" rows="3" maxlength="${ANNOUNCEMENT_MAX}" ${canText ? '' : 'disabled'}>${s.announcement}</textarea>
                        <span class="counter" data-count>${s.announcement.length} / ${ANNOUNCEMENT_MAX}</span>
                    </div>
                    <div><button type="submit" class="button button-primary" ${canText ? '' : 'disabled'}>Salvar aviso</button></div>
                </form>
            </section>

            <section class="panel glass-panel" aria-labelledby="ad-names">
                <h2 id="ad-names">${icon('ban')} Palavras proibidas</h2>
                <form data-form="names" class="stack" novalidate>
                    <div class="field">
                        <label for="ad-blocked">Uma palavra por linha</label>
                        <textarea id="ad-blocked" class="textarea" rows="6" autocapitalize="none" spellcheck="false" ${canText ? '' : 'disabled'}>${s.blockedNames.join('\n')}</textarea>
                        <span class="field-hint">Vale para <strong>nomes</strong> (de usuário e de exibição) e para os <strong>textos</strong> (bio, título digitado à mão, tags, anotações e análise), sem diferenciar maiúsculas nem acentos. Nos nomes, basta <strong>conter</strong> a palavra: cuidado com palavras curtas, que valem dentro de outras palavras. Nos textos, a palavra precisa aparecer <strong>inteira</strong> (número no lugar de letra e letra repetida não escondem); palavras com 6 letras ou mais também pegam a escrita separada ("p a l a v r a") ou colada em outra.</span>
                    </div>
                    <p class="field-error" data-error role="alert" hidden></p>
                    <div><button type="submit" class="button button-primary" ${canText ? '' : 'disabled'}>Salvar lista</button></div>
                </form>
            </section>

            <section class="panel glass-panel" aria-labelledby="ad-links">
                <h2 id="ad-links">${icon('link')} Sites permitidos nos textos</h2>
                <form data-form="links" class="stack" novalidate>
                    <div class="field">
                        <label for="ad-link-hosts">Um site por linha (por exemplo, myanimelist.net)</label>
                        <textarea id="ad-link-hosts" class="textarea" rows="6" autocapitalize="none" spellcheck="false" ${canText ? '' : 'disabled'}>${s.allowedLinkHosts.join('\n')}</textarea>
                        <span class="field-hint">Bio, título digitado à mão, tags, anotações e análise só podem citar endereços destes sites (e dos seus subdomínios). Qualquer outro endereço faz o texto ser recusado, com um aviso. Os endereços continuam sendo só texto: não viram link clicável. Pode colar o endereço inteiro; só o site é guardado.</span>
                    </div>
                    <div><button type="submit" class="button button-primary" ${canText ? '' : 'disabled'}>Salvar sites</button></div>
                </form>
            </section>
        </div>`);

        const save = async (btn, task, okMessage) => {
            btn.disabled = true;
            try { await task(); toast(okMessage, { type: 'success' }); await refreshAccess(); } catch (err) {
                console.error(err);
                toast(messageOf(err, 'Não foi possível salvar.'), { type: 'error' });
            } finally { btn.disabled = false; }
        };

        const signups = box.querySelector('#ad-signups-open');
        signups.addEventListener('change', async () => {
            const wanted = signups.checked;
            signups.disabled = true;
            try {
                await be.moderation.setSetting('signups_open', wanted);
                toast(wanted ? 'Cadastros abertos.' : 'Cadastros fechados.', { type: 'success' });
                await refreshAccess();
            } catch (err) {
                console.error(err);
                signups.checked = !wanted;
                toast(messageOf(err, 'Não foi possível salvar.'), { type: 'error' });
            } finally { signups.disabled = !canSignups; }
        });

        const text = box.querySelector('#ad-announcement');
        const count = box.querySelector('[data-count]');
        text.addEventListener('input', () => { count.textContent = `${text.value.length} / ${ANNOUNCEMENT_MAX}`; });

        offs.push(on(box, 'submit', '[data-form]', (ev, form) => {
            ev.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            if (form.dataset.form === 'announcement') {
                save(btn, () => be.moderation.setSetting('announcement', text.value.trim()), text.value.trim() ? 'Aviso publicado.' : 'Aviso removido.');
            } else if (form.dataset.form === 'links') {
                const hosts = parseHostList(box.querySelector('#ad-link-hosts').value);
                save(btn, async () => { await be.moderation.setSetting('allowed_link_hosts', hosts); box.querySelector('#ad-link-hosts').value = hosts.join('\n'); }, `Lista salva (${hosts.length} ${hosts.length === 1 ? 'site' : 'sites'}).`);
            } else {
                const words = parseWords(box.querySelector('#ad-blocked').value);
                save(btn, () => be.moderation.setSetting('blocked_names', words), `Lista salva (${words.length} ${words.length === 1 ? 'palavra' : 'palavras'}).`);
            }
        }));
    })();

    return () => { dead = true; offs.forEach((off) => off()); };
}

// ---------------------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------------------
export async function mount(root, ctx) {
    const role = myRole();
    if (!isCloud() || !state.user || !isStaff(role)) {
        setHtml(root, empty('lock', 'Área da equipe', 'Esta página é só para a equipe do site.'));
        return;
    }
    const tab = ADMIN_TABS.find((t) => t.name === ctx.name) || ADMIN_TABS[0];
    if (rankOf(role) < tab.rank) {
        setHtml(root, empty('lock', 'Sem permissão', 'Esta parte é só para a administração do site.'));
        return;
    }
    document.title = `Painel · ${config.siteName}`;
    const be = backend();
    const tabs = ADMIN_TABS.filter((t) => rankOf(role) >= t.rank);

    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('shield', { size: 14 })} Equipe</span>
                <h1 style="margin-top:10px">Painel da equipe</h1>
                <p class="lead">Seu cargo: <strong>${ROLES[role].long}</strong>. Tudo o que você faz aqui fica no registro de ações.</p>
            </div>
        </header>
        <nav class="settings-tabs" aria-label="Seções do painel">
            ${tabs.map((t) => html`<a class="settings-tab" href="#${t.path}" ${t.id === tab.id ? html`aria-current="page"` : ''}>${icon(t.icon, { size: 17 })}${t.label}${t.id === 'denuncias' ? html`<span class="tab-count" data-report-count hidden></span>` : ''}</a>`)}
        </nav>
        <div data-panel class="stack"></div>`);

    const panel = root.querySelector('[data-panel]');
    const badge = root.querySelector('[data-report-count]');
    const showCount = (n) => {
        if (!badge) return;
        if (n == null) { loadCount(); return; }
        badge.hidden = n === 0;
        badge.textContent = n > 99 ? '99+' : String(n);
    };
    let alive = true;
    async function loadCount() {
        if (!badge) return;
        try {
            const open = await be.moderation.reports({ status: 'open', limit: 50 });
            if (alive) showCount(open.length);
        } catch { /* a contagem é só um enfeite: o erro aparece na própria tela */ }
    }

    const ctxArgs = { be, role, onCount: showCount };
    let cleanup;
    if (tab.id === 'membros') cleanup = mountMembers(panel, ctxArgs);
    else if (tab.id === 'denuncias') cleanup = mountReports(panel, ctxArgs);
    else if (tab.id === 'registro') cleanup = mountLog(panel, ctxArgs);
    else cleanup = mountSettings(panel, ctxArgs);
    if (tab.id !== 'denuncias') loadCount();

    return () => { alive = false; cleanup?.(); };
}
