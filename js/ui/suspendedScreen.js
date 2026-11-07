// Tela estática de conta suspensa ou banida (Patch 19).
// Enquanto a conta estiver suspensa, só esta tela aparece: o menu, o conteúdo e o rodapé do site ficam escondidos (CSS: body.is-suspended).
// Ela mostra o motivo, o prazo e o link do Discord da equipe, e deixa baixar um backup da biblioteca ou sair da conta.
// Quando o prazo acaba, o site confere de novo sozinho e a tela some. Isto é só a parte visível: quem barra de verdade é o banco.
import { config } from '../config.js';
import { downloadBlob, html, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { nextCheckDelay, safeHttpsUrl, suspensionView } from '../domain/access.js';
import { buildBackup } from '../domain/backup.js';
import { isCloud, onSessionChange, refreshAccess, refreshSession, state } from '../services/session.js';

const isBlocked = () => isCloud() && Boolean(state.user) && state.access.suspended === true;

function screenHtml(view, discordUrl) {
    return html`
    <div class="suspended-card glass-panel">
        <p class="suspended-brand">${config.siteName}</p>
        <span class="suspended-icon ${view.ban ? 'is-ban' : ''}" aria-hidden="true">${icon(view.ban ? 'ban' : 'clock', { size: 34 })}</span>
        <h1 id="sus-title" tabindex="-1">${view.title}</h1>
        <p class="suspended-lead">${view.lead}</p>
        <dl class="suspended-facts">
            <div><dt>Motivo</dt><dd data-sus-reason>${view.reason || 'A equipe não escreveu um motivo.'}</dd></div>
            <div><dt>Prazo</dt><dd data-sus-term>${view.termText}</dd></div>
        </dl>
        ${discordUrl ? html`<p class="suspended-help">Acha que foi um engano? Fale com a equipe no Discord.</p>` : html`<p class="suspended-help">Acha que foi um engano? Fale com a equipe do site.</p>`}
        <div class="suspended-actions">
            ${discordUrl ? html`<a class="button button-primary" href="${discordUrl}" target="_blank" rel="noopener noreferrer" data-sus-discord>${icon('link', { size: 17 })} Falar com a equipe no Discord</a>` : ''}
            <button type="button" class="button button-secondary" data-sus-backup>${icon('download', { size: 17 })} Baixar backup</button>
            <button type="button" class="button button-secondary" data-sus-recheck>${icon('refresh', { size: 17 })} Conferir de novo</button>
            <button type="button" class="button button-ghost" data-sus-logout>${icon('logOut', { size: 17 })} Sair da conta</button>
        </div>
    </div>`;
}

/** Liga a tela de suspensão ao estado da sessão. Chame uma vez, depois de montar o resto do site. */
export function mountSuspensionGate() {
    // <div role="main"> (e não <main>): o site já tem um <main id="main"> (escondido por CSS enquanto a conta está suspensa), e a página não deve ter dois <main> no HTML.
    const screen = document.createElement('div');
    screen.setAttribute('role', 'main');
    screen.id = 'suspended-screen';
    screen.className = 'suspended-screen';
    screen.setAttribute('aria-labelledby', 'sus-title');
    screen.hidden = true;
    document.body.appendChild(screen);

    let shownKey = '';
    let timer = 0;

    const stopTimer = () => { clearTimeout(timer); timer = 0; };

    async function recheck({ manual = false } = {}) {
        stopTimer();
        try { await refreshAccess(); } catch (err) { console.error(err); }
        if (manual && isBlocked()) toast('A conta continua suspensa.', { type: 'info' });
    }

    function paint() {
        stopTimer();
        if (!isBlocked()) {
            if (!screen.hidden) { screen.hidden = true; screen.replaceChildren(); }
            document.body.classList.remove('is-suspended');
            shownKey = '';
            return;
        }
        const access = state.access;
        const discordUrl = safeHttpsUrl(state.site?.discordUrl);
        const view = suspensionView(access);
        const key = JSON.stringify([access.kind, access.endsAt, access.reason, discordUrl, view.term]);
        const first = screen.hidden;
        if (key !== shownKey || first) {
            setHtml(screen, screenHtml(view, discordUrl));
            shownKey = key;
        }
        screen.hidden = false;
        document.body.classList.add('is-suspended');
        document.title = `${view.title} · ${config.siteName}`;
        if (first) screen.querySelector('#sus-title')?.focus({ preventScroll: true });

        // Atualiza a frase do prazo (faltam X dias) a cada minuto e confere com o banco assim que a data chegar.
        const tick = () => {
            if (!isBlocked()) return;
            const v = suspensionView(state.access);
            const term = screen.querySelector('[data-sus-term]');
            if (term) term.textContent = v.termText;
            if (v.term === 'until') timer = setTimeout(tick, Math.min(nextCheckDelay(state.access) ?? 60_000, 60_000));
            else if (v.term === 'checking') recheck();
        };
        const delay = nextCheckDelay(access);
        if (delay != null) timer = setTimeout(tick, Math.min(delay, 60_000));
    }

    screen.addEventListener('click', async (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        const btn = target?.closest('button');
        if (!btn || !screen.contains(btn)) return;
        if (btn.matches('[data-sus-recheck]')) {
            btn.disabled = true;
            await recheck({ manual: true });
            btn.disabled = false;
        } else if (btn.matches('[data-sus-backup]')) {
            btn.disabled = true;
            try {
                const list = await state.backend.library.listMine();
                downloadBlob(new Blob([buildBackup(list)], { type: 'application/json' }), `kamylist-backup-${new Date().toISOString().slice(0, 10)}.json`);
                toast(`Backup com ${list.length} obras baixado.`, { type: 'success' });
            } catch (err) {
                console.error(err);
                toast(messageOf(err, 'Não foi possível baixar o backup.'), { type: 'error' });
            } finally { btn.disabled = false; }
        } else if (btn.matches('[data-sus-logout]')) {
            btn.disabled = true;
            try {
                await state.backend.auth.signOut();
                await refreshSession();
                navigate('/');
                toast('Você saiu da conta.', { type: 'info' });
            } catch (err) {
                btn.disabled = false;
                toast(messageOf(err), { type: 'error' });
            }
        }
    });

    // Voltou para a aba (talvez horas depois): confere se a suspensão já acabou.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isBlocked()) recheck(); });

    onSessionChange(paint);
    paint();
}
