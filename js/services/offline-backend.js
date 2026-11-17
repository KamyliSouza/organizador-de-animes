// Serviço de dados "de mentira" para quando o site abre SEM internet e a biblioteca do Supabase não está no aparelho (nunca foi baixada).
// Todas as chamadas falham como falha de rede; a tela da biblioteca então mostra a cópia guardada (services/offlineCache.js).
import { AppError } from '../core/errors.js';

const down = () => new AppError('Sem conexão com a internet.', new TypeError('Failed to fetch'));
// Qualquer caminho (backend.library.listMine(), backend.follows.requests()...) vira uma promessa recusada por falta de rede.
const dead = () => new Proxy(function () {}, {
    apply: () => Promise.reject(down()),
    get: (_, key) => (key === 'then' || typeof key === 'symbol' ? undefined : dead()),
});

export function createOfflineBackend() {
    return {
        mode: 'cloud',
        features: { accounts: true },
        offlineStub: true,
        auth: { getUser: async () => null, onChange: () => () => {}, signOut: () => Promise.reject(down()) },
        meta: dead(), profiles: dead(), follows: dead(), access: dead(), moderation: dead(), library: dead(),
    };
}
