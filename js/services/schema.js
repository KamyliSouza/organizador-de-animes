// Versão do esquema do banco (sql/schema.sql) que este site espera.
// Se o banco do Supabase estiver numa versão menor, a biblioteca avisa para rodar o SQL de novo.
// 1 = original · 2 = Em espera, favoritos e códigos de obra · 3 = foto de perfil · 4 = seguir, feed e análises · 5 = cores do perfil
export const REQUIRED_SCHEMA = 5;
