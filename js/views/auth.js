// Login, cadastro, "esqueci a senha" e "nova senha" (um módulo, vários modos).
import { debounce, html, setHtml } from '../core/dom.js';
import { AppError, messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { backend, refreshSession } from '../services/session.js';

const USERNAME_RX = /^[a-z0-9_]{3,20}$/;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
    login: { title: 'Entrar', lead: 'Bem-vindo de volta! Entre para ver sua biblioteca.', submit: 'Entrar' },
    signup: { title: 'Criar conta', lead: 'Leva menos de um minuto. Seu perfil começa privado.', submit: 'Criar conta' },
    forgot: { title: 'Recuperar senha', lead: 'Digite seu e-mail e enviaremos um link para criar uma nova senha.', submit: 'Enviar link' },
    recovery: { title: 'Nova senha', lead: 'Escolha uma nova senha para a sua conta.', submit: 'Salvar nova senha' },
};

const passwordField = (id, label, autocomplete) => html`
    <div class="field">
        <label for="${id}">${label}</label>
        <input id="${id}" class="input" type="password" required minlength="8" autocomplete="${autocomplete}" placeholder="Mínimo de 8 caracteres">
    </div>`;

const emailField = html`
    <div class="field">
        <label for="au-email">E-mail</label>
        <input id="au-email" class="input" type="email" required autocomplete="email" inputmode="email" placeholder="voce@exemplo.com">
    </div>`;

function formFor(mode) {
    switch (mode) {
        case 'signup':
            return html`
                <div class="field">
                    <label for="au-username">Nome de usuário</label>
                    <input id="au-username" class="input" required maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex: kamyli_sumire">
                    <p class="username-status" data-username-status aria-live="polite"></p>
                    <p class="field-hint">3 a 20 caracteres: letras minúsculas, números e _ . Aparece no link do seu perfil.</p>
                </div>
                ${emailField}
                ${passwordField('au-password', 'Senha', 'new-password')}`;
        case 'forgot':
            return emailField;
        case 'recovery':
            return html`${passwordField('au-password', 'Nova senha', 'new-password')}${passwordField('au-password2', 'Repita a nova senha', 'new-password')}`;
        default:
            return html`${emailField}${passwordField('au-password', 'Senha', 'current-password')}`;
    }
}

export function mount(root, ctx) {
    const mode = COPY[ctx.name] ? ctx.name : 'login';
    const copy = COPY[mode];
    const be = backend();
    document.title = `${copy.title} · KamyList`;

    setHtml(root, html`
        <div class="auth-wrap">
            <section class="auth-card glass-panel" aria-labelledby="au-title">
                <div>
                    <span class="eyebrow">${icon(mode === 'recovery' || mode === 'forgot' ? 'lock' : 'user', { size: 14 })} Conta</span>
                    <h1 id="au-title" style="margin-top:10px">${copy.title}</h1>
                    <p class="muted" style="margin-top:6px">${copy.lead}</p>
                </div>
                <div data-feedback></div>
                <form novalidate data-form>
                    ${formFor(mode)}
                    <button type="submit" class="button button-primary button-block" data-submit>${copy.submit}</button>
                </form>
                ${mode === 'login' ? html`
                    <div class="auth-links">
                        <a href="#/recuperar">Esqueci minha senha</a>
                        <a href="#/criar-conta">Criar conta</a>
                    </div>` : ''}
                ${mode === 'signup' ? html`<p class="auth-switch">Já tem conta? <a href="#/entrar">Entrar</a></p>` : ''}
                ${mode === 'forgot' ? html`<p class="auth-switch"><a href="#/entrar">Voltar para o login</a></p>` : ''}
            </section>
        </div>`);

    const $ = (s) => root.querySelector(s);
    const feedback = $('[data-feedback]');
    const form = $('[data-form]');
    const submit = $('[data-submit]');

    const showError = (message) => setHtml(feedback, html`<div class="notice-box is-error" role="alert">${icon('alert')}<div>${message}</div></div>`);
    const showSuccess = (message) => setHtml(feedback, html`<div class="notice-box" role="status">${icon('checkCircle')}<div>${message}</div></div>`);
    const setBusy = (busy) => {
        submit.disabled = busy;
        setHtml(submit, busy ? html`${spinner(17)} Aguarde...` : copy.submit);
    };

    // --- checagem do nome de usuário enquanto digita (cadastro) -----------------------
    let usernameOk = null;
    let usernameToken = 0;
    const status = $('[data-username-status]');
    const checkUsername = debounce(async (value) => {
        const token = ++usernameToken;
        if (!value) { status.textContent = ''; status.className = 'username-status'; usernameOk = null; return; }
        if (!USERNAME_RX.test(value)) { status.textContent = 'Use 3 a 20 caracteres: a-z, 0-9 e _'; status.className = 'username-status bad'; usernameOk = false; return; }
        status.textContent = 'Verificando...'; status.className = 'username-status';
        const free = await be.auth.usernameAvailable(value);
        if (token !== usernameToken) return;
        usernameOk = free;
        status.textContent = free === null ? '' : free ? 'Disponível ✓' : 'Já está em uso';
        status.className = 'username-status ' + (free === true ? 'ok' : free === false ? 'bad' : '');
    }, 350);

    const usernameInput = $('#au-username');
    if (usernameInput) usernameInput.addEventListener('input', () => {
        usernameInput.value = usernameInput.value.toLowerCase().replace(/\s/g, '');
        checkUsername(usernameInput.value);
    });

    // --- envio -------------------------------------------------------------------------
    const val = (id) => root.querySelector(id)?.value ?? '';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.replaceChildren();

        const email = val('#au-email').trim();
        const password = val('#au-password');

        if (mode !== 'recovery' && !EMAIL_RX.test(email)) { showError('Digite um e-mail válido.'); $('#au-email').focus(); return; }
        if (mode !== 'forgot' && password.length < 8) { showError('A senha precisa ter pelo menos 8 caracteres.'); $('#au-password').focus(); return; }
        if (mode === 'recovery' && password !== val('#au-password2')) { showError('As senhas não conferem.'); $('#au-password2').focus(); return; }
        if (mode === 'signup') {
            const username = val('#au-username').trim();
            if (!USERNAME_RX.test(username)) { showError('Escolha um nome de usuário com 3 a 20 caracteres (a-z, 0-9 e _).'); usernameInput.focus(); return; }
            if (usernameOk === false) { showError('Esse nome de usuário já está em uso. Escolha outro.'); usernameInput.focus(); return; }
        }

        setBusy(true);
        try {
            if (mode === 'login') {
                await be.auth.signIn({ email, password });
                await refreshSession();
                navigate('/');
                toast('Que bom te ver de novo!', { type: 'success' });
            } else if (mode === 'signup') {
                const { needsConfirmation } = await be.auth.signUp({ email, password, username: val('#au-username').trim() });
                if (needsConfirmation) {
                    form.hidden = true;
                    showSuccess(html`<strong>Quase lá!</strong> Enviamos um e-mail de confirmação para <strong>${email}</strong>. Clique no link para ativar a conta e depois <a href="#/entrar">entre aqui</a>. Não achou? Olhe o spam.`);
                    return;
                }
                await refreshSession();
                navigate('/');
                toast('Conta criada! Seja bem-vindo(a).', { type: 'success' });
            } else if (mode === 'forgot') {
                await be.auth.sendPasswordReset(email);
                form.hidden = true;
                showSuccess(html`Se existir uma conta com <strong>${email}</strong>, o link para criar uma nova senha já está a caminho. Confira também o spam.`);
                return;
            } else if (mode === 'recovery') {
                await be.auth.updatePassword(password);
                await refreshSession();
                navigate('/');
                toast('Senha alterada com sucesso!', { type: 'success' });
            }
        } catch (err) {
            if (!(err instanceof AppError)) console.error(err);   // senha errada etc. são erros esperados, não vão para o console
            showError(messageOf(err));
            setBusy(false);
        }
    });

    root.querySelector('input')?.focus({ preventScroll: true });
    return () => checkUsername.cancel();
}
