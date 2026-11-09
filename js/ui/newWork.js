// "Nova obra" sempre à mão: o botão do topo (computador) e o botão flutuante (celular) chamam requestNewWork() em qualquer tela.
// Na biblioteca, quem abre o formulário é a própria tela (ela guarda a lista na memória e atualiza os cartões na hora).
// Nas outras telas o formulário abre daqui, com a aba lembrada, e a obra é salva do mesmo jeito (mesmos dados, mesmas regras).
import { messageOf } from '../core/errors.js';
import { currentPath, navigate, refresh } from '../core/router.js';
import { toast } from '../core/toast.js';
import { sectionOf } from '../domain/entry.js';
import { backend, isCloud, state } from '../services/session.js';
import { loadSection, saveSection } from './sectionTabs.js';

let libraryOpener = null;

/** A biblioteca registra como abrir o formulário enquanto está na tela. Devolve a função que desfaz o registro. */
export function registerLibraryOpener(open) {
    libraryOpener = open;
    return () => { if (libraryOpener === open) libraryOpener = null; };
}

/** Quem tem biblioteca: o modo local ou uma conta logada (visitante não tem). */
export const canAddWork = () => !isCloud() || Boolean(state.user);

/** Telas em que o botão não aparece: a de nova senha (a pessoa está no meio de trocar a senha). */
const HIDDEN_ON = ['/nova-senha'];
export const showsNewWork = (path = currentPath()) => canAddWork() && !HIDDEN_ON.includes(path);

let opening = false;

export async function requestNewWork() {
    if (libraryOpener) { libraryOpener(); return; }
    if (opening) return;                 // clique duplo enquanto a lista carrega
    opening = true;
    try {
        const be = backend();
        let entries;
        try {
            entries = await be.library.listMine();
        } catch (err) {
            console.error(err);
            toast(messageOf(err, 'Não foi possível abrir o formulário. Verifique sua conexão e tente de novo.'), { type: 'error' });
            return;
        }
        const { openMediaForm } = await import('./mediaFormModal.js');   // o formulário só é baixado quando alguém o usa fora da biblioteca
        openMediaForm({
            entry: null,
            section: loadSection(),
            existing: entries,
            // "Já tenho esta obra": leva para a biblioteca, na aba dela.
            onShowExisting: (found) => { saveSection(sectionOf(found)); navigate('/'); },
            onSave: async (data) => {
                const saved = await be.library.create(data);
                if (saved) saveSection(sectionOf(saved));     // a biblioteca abre na aba onde a obra foi parar
                toast('Obra adicionada à sua biblioteca!', { type: 'success', action: { label: 'Ver', href: '#/' } });
                // Telas que mostram a biblioteca desta pessoa precisam da lista nova (a de configurações, por exemplo, não é refeita para não perder o que está sendo digitado).
                const mine = state.profile?.username;
                const path = currentPath();
                if (path === '/' || (mine && path === `/u/${mine}`)) refresh();
            },
        });
    } finally {
        opening = false;
    }
}
