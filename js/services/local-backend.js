// Modo local: tudo fica no localStorage deste navegador. É o que roda enquanto
// o Supabase não estiver configurado, e usa a MESMA chave do tracker antigo
// ("media_tracker_data"), então as obras que você já tem aparecem sozinhas.
import { uuid } from '../core/dom.js';
import { AppError } from '../core/errors.js';
import { normalizeEntry } from '../domain/entry.js';
import { LEGACY_STORAGE_KEY } from '../domain/backup.js';

const ONLY_CLOUD = 'Esta função precisa do login ativado (configure o Supabase em js/config.js).';
const LOCAL_USER = { id: 'local', email: '' };
const LOCAL_PROFILE = {
    id: 'local', username: 'local', displayName: 'Modo local', bio: '', isPublic: false, showNotes: false,
};

export function createLocalBackend() {
    let memory = null; // usado se o navegador bloquear o localStorage

    const read = () => {
        try {
            const list = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
            return Array.isArray(list) ? list.map(normalizeEntry) : [];
        } catch {
            return memory ?? [];
        }
    };

    const write = (list) => {
        try {
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(list));
            memory = null;
        } catch (e) {
            memory = list;
            throw new AppError('Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).', e);
        }
    };

    const stamp = (entry) => normalizeEntry({ ...entry, id: uuid(), createdAt: new Date().toISOString() });
    const reject = () => Promise.reject(new AppError(ONLY_CLOUD));

    return {
        mode: 'local',
        features: { accounts: false },

        auth: {
            getUser: async () => LOCAL_USER,
            onChange: () => () => {},
            signUp: reject,
            signIn: reject,
            signOut: async () => {},
            sendPasswordReset: reject,
            updatePassword: reject,
            deleteAccount: reject,
            usernameAvailable: async () => null,
        },

        meta: { schemaVersion: async () => null },

        profiles: {
            getMine: async () => LOCAL_PROFILE,
            updateMine: reject,
            getPublic: async () => null,
            listPublic: async () => [],
        },

        library: {
            listMine: async () => read(),
            async create(entry) {
                const created = stamp(entry);
                write([...read(), created]);
                return created;
            },
            async update(entry) {
                const list = read();
                const i = list.findIndex((e) => e.id === String(entry.id));
                if (i < 0) throw new AppError('Obra não encontrada.');
                list[i] = normalizeEntry({ ...entry, createdAt: list[i].createdAt });
                write(list);
                return list[i];
            },
            async remove(id) { write(read().filter((e) => e.id !== String(id))); },
            async addMany(entries) {
                const created = entries.map(stamp);
                write([...read(), ...created]);
                return created;
            },
            async replaceAll(entries) {
                const created = entries.map(stamp);
                write(created);
                return created;
            },
            listPublic: async () => [],
        },
    };
}
