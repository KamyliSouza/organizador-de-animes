// Cargos do site. A regra de verdade mora no banco (sql/schema.sql, seção 5b); aqui ficam só os nomes
// e as contas simples que o painel usa para mostrar ou esconder botões.
//
//   Dona (owner) > Administração (admin) > Moderação (mod) > Membro (member)
//
// Quem age só atinge quem tem um cargo ESTRITAMENTE menor que o seu.

export const ROLES = {
    owner:  { rank: 3, short: 'Dona',   long: 'Dona do site' },
    admin:  { rank: 2, short: 'Admin',  long: 'Administração' },
    mod:    { rank: 1, short: 'Mod',    long: 'Moderação' },
    member: { rank: 0, short: '',       long: 'Membro' },
};

/** Normaliza o que vem do banco (nulo, vazio ou cargo desconhecido = membro). */
export const normalizeRole = (role) => (ROLES[role] ? role : 'member');

export const rankOf = (role) => ROLES[normalizeRole(role)].rank;

/** Faz parte da equipe (moderação, administração ou Dona)? */
export const isStaff = (role) => rankOf(role) >= 1;

/** `actor` pode agir em quem tem o cargo `target`? (cargo estritamente maior) */
export const canAct = (actor, target) => isStaff(actor) && rankOf(actor) > rankOf(target);

/** Cargos que `actor` pode conceder (só administração e Dona mexem em cargos, sempre abaixo do seu). */
export function grantableRoles(actor) {
    if (rankOf(actor) < 2) return [];
    return ['admin', 'mod', 'member'].filter((r) => rankOf(r) < rankOf(actor));
}

/** O que cada cargo pode mexer nas configurações do site. */
export const SETTING_RANK = { signups_open: 3, announcement: 2, blocked_names: 2 };
export const canEditSetting = (role, key) => rankOf(role) >= (SETTING_RANK[key] ?? 99);

export const MOTIVES = [
    ['nome', 'Nome ofensivo ou impróprio'],
    ['bio', 'Descrição (bio) imprópria'],
    ['foto', 'Foto imprópria'],
    ['spam', 'Spam ou propaganda'],
    ['outro', 'Outro motivo'],
];
export const motiveLabel = (key) => (MOTIVES.find(([k]) => k === key) || [key, key])[1];

/** Frases do registro de ações. */
const ACTIONS = {
    reset_display_name: 'restaurou o nome de exibição de',
    reset_bio: 'restaurou a bio de',
    reset_avatar: 'restaurou a foto de',
    reset_username: 'restaurou o nome de usuário de',
    rename: 'renomeou',
    suspend: 'suspendeu',
    unsuspend: 'reativou',
    set_role: 'mudou o cargo de',
    report_resolved: 'resolveu uma denúncia contra',
    report_dismissed: 'descartou uma denúncia contra',
    report_open: 'reabriu uma denúncia contra',
    setting_signups_open: 'mudou os cadastros',
    setting_announcement: 'mudou o aviso do site',
    setting_blocked_names: 'mudou a lista de nomes proibidos',
};
export const actionLabel = (action) => ACTIONS[action] || action;

const clip = (v, n = 80) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const quoted = (v) => (clip(v) ? `“${clip(v)}”` : '(vazio)');

/** Texto curto com o "antes e depois" de uma ação do registro. Devolve '' quando não há nada a mostrar. */
export function describeDetails(action, details) {
    const d = details && typeof details === 'object' ? details : {};
    switch (action) {
        case 'rename':
        case 'reset_username':
            return `${quoted(d.antes)} → ${quoted(d.depois)}`;
        case 'reset_display_name':
        case 'reset_bio':
            return `Antes: ${quoted(d.antes)}`;
        case 'suspend':
            return d.motivo ? `Motivo: ${clip(d.motivo, 120)}` : '';
        case 'set_role':
            return `${ROLES[normalizeRole(d.antes)].long} → ${ROLES[normalizeRole(d.depois)].long}`;
        case 'setting_signups_open':
            return `${d.antes === false ? 'Fechados' : 'Abertos'} → ${d.depois === false ? 'fechados' : 'abertos'}`;
        case 'setting_announcement':
            return `${quoted(d.antes)} → ${quoted(d.depois)}`;
        case 'setting_blocked_names':
            return Number.isFinite(Number(d.total)) ? `${Number(d.total)} ${Number(d.total) === 1 ? 'palavra' : 'palavras'} na lista` : '';
        case 'report_resolved':
        case 'report_dismissed':
        case 'report_open':
            return d.motivo ? `Motivo: ${motiveLabel(d.motivo)}` : '';
        default:
            return '';
    }
}
