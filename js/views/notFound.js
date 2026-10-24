import { html, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';

export function mount(root) {
    document.title = 'Página não encontrada · KamyList';
    setHtml(root, html`
        <div class="glass-panel empty-state">
            ${icon('compass', { size: 44 })}
            <h3>Página não encontrada</h3>
            <p>O endereço que você abriu não existe.</p>
            <a class="button button-primary" href="#/">${icon('arrowLeft', { size: 17 })} Voltar ao início</a>
        </div>`);
}
