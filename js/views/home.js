// "/" mostra a biblioteca para quem está logado (ou no modo local) e a página de boas-vindas para visitantes.
import { isCloud, state } from '../services/session.js';

export async function mount(root, ctx) {
    const view = isCloud() && !state.user ? await import('./landing.js') : await import('./library.js');
    return view.mount(root, ctx);
}
