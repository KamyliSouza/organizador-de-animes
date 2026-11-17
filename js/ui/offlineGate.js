// Telas que dependem do banco (Feed, Explorar, perfis, Configurações, entrar...) não têm o que mostrar sem internet.
// Em vez do erro cru, elas mostram este aviso, com o caminho para a biblioteca (que abre offline) e o retorno automático quando a internet volta.
// Só vale na conta (nuvem): o modo local não usa rede.
import { html, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { isOffline, onConnectionChange } from '../core/online.js';
import { refresh } from '../core/router.js';
import { isCloud, state } from '../services/session.js';

function mountOfflinePanel(root) {
    setHtml(root, html`
        <div class="glass-panel empty-state offline-panel" role="status">
            ${icon('info', { size: 44 })}
            <h3>Esta tela precisa de internet</h3>
            <p>Você está offline. Quando a conexão voltar, ela abre sozinha.${state.user ? ' Enquanto isso, sua biblioteca continua disponível para leitura.' : ''}</p>
            <div class="stack-row">
                ${state.user ? html`<a class="button button-primary" href="#/">${icon('film', { size: 17 })} Abrir minha biblioteca</a>` : ''}
                <button type="button" class="button button-secondary" data-retry>${icon('refresh', { size: 17 })} Tentar de novo</button>
            </div>
        </div>`);
    root.querySelector('[data-retry]').addEventListener('click', () => { if (isOffline()) return; refresh(); });
    return onConnectionChange((off) => { if (!off) refresh(); });
}

/** Envolve o carregador de uma rota: sem internet (e na conta), mostra o aviso no lugar da tela. */
export function offlineGate(loader) {
    return async () => {
        const mod = await loader();
        return { ...mod, mount: (root, ctx) => (isCloud() && isOffline() ? mountOfflinePanel(root) : mod.mount(root, ctx)) };
    };
}
