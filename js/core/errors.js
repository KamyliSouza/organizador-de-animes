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
