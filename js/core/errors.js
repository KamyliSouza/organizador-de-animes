// Erro com mensagem pronta para mostrar à pessoa (em português, sem jargão).
export class AppError extends Error {
    constructor(userMessage, cause) {
        super(userMessage);
        this.name = 'AppError';
        this.userMessage = userMessage;
        this.cause = cause;
    }
}

export function messageOf(err, fallback = 'Algo deu errado. Tente novamente.') {
    return err?.userMessage || fallback;
}

const NETWORK_RX = /failed to fetch|networkerror|network request failed|load failed|fetch failed|internet disconnected|network error|retryablefetch/i;

/**
 * O erro veio de falta de internet (e não de uma recusa do banco)? Olha o erro e a causa dele (o AppError guarda o erro original do Supabase).
 * Serve para decidir se vale mostrar a cópia da biblioteca guardada neste aparelho.
 */
export function isNetworkError(err) {
    for (let e = err, depth = 0; e && depth < 3; e = e.cause, depth += 1) {
        if (e instanceof TypeError) return true;
        if (NETWORK_RX.test(`${e.name || ''} ${e.message || ''}`)) return true;
    }
    return false;
}
