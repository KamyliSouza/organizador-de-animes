// Limites de troca de foto e fundo na tela (Personalização). O banco é quem aplica (sql/schema.sql, seção 7); aqui só aparece:
//  - uma linha de apoio com quantas trocas já foram feitas hoje, ou com quanto tempo falta para poder trocar;
//  - o botão de escolher imagem travado durante a espera, com contagem regressiva (e liberado sozinho quando acaba);
//  - uma conferência rápida antes de começar (recorte/conversão), para a pessoa não perder tempo preparando uma imagem que seria recusada.
// Foto e fundo compartilham a mesma consulta (o limite por dia soma os dois): uma troca em um painel atualiza a linha do outro.
// Se o banco ainda não tem a versão 12 (sem a função my_media_limits), nada disso aparece e tudo funciona como antes.
import { limitHint, limitMessage } from '../domain/mediaLimits.js';

const store = { info: null, at: 0, subs: new Set(), pending: null };

/** Pergunta ao banco (uma consulta por vez, mesmo que vários painéis peçam juntos) e avisa os painéis. */
function refreshShared(be) {
    if (store.pending) return store.pending;
    store.pending = (async () => {
        let info = null;
        try { info = (await be.profiles.mediaLimits?.()) || null; } catch { info = null; }
        store.info = info;
        store.at = Date.now();
        store.pending = null;
        store.subs.forEach((fn) => fn());
        return info;
    })();
    return store.pending;
}

/** Segundos que ainda faltam para trocar `kind` ('avatar' | 'background'), descontando o tempo desde a última consulta. */
function waitLeft(kind) {
    const part = store.info?.[kind];
    if (!part || part.wait <= 0) return 0;
    return Math.max(0, Math.ceil(part.wait - (Date.now() - store.at) / 1000));
}

/**
 * Liga os limites a um painel. `hint` é o parágrafo de apoio; `onChange(bloqueado)` é chamado quando o botão deve travar ou liberar.
 * Devolve { blocked(), check(), refresh(), destroy() }.
 */
export function bindMediaLimits(be, { kind, hint, onChange }) {
    let timer = 0;

    const paint = () => {
        const left = waitLeft(kind);
        hint.textContent = limitHint(store.info, kind, left, store.info?.[kind]?.reason);
        onChange?.(left > 0);
        if (left > 0 && !timer) timer = setInterval(tick, 1000);
        if (left <= 0 && timer) { clearInterval(timer); timer = 0; }
    };
    function tick() {
        if (waitLeft(kind) <= 0) refreshShared(be);   // a espera acabou: confere de novo (a janela de 24 h pode ter mudado)
        paint();
    }

    store.subs.add(paint);
    refreshShared(be);

    return {
        blocked: () => waitLeft(kind) > 0,
        refresh: () => refreshShared(be),
        /** Consulta o banco agora. Devolve o texto da recusa, ou '' se pode trocar. */
        async check() {
            const info = await refreshShared(be);
            const left = waitLeft(kind);
            if (!info || left <= 0) return '';
            return limitMessage({ kind, reason: info[kind].reason, wait: left, limit: info.dailyLimit });
        },
        destroy() {
            if (timer) clearInterval(timer);
            timer = 0;
            store.subs.delete(paint);
        },
    };
}
