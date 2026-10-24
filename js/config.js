// =====================================================================
// CONFIGURAÇÃO DO SITE
//
// Este é o ÚNICO arquivo que você precisa editar para ligar o login e os
// perfis públicos. Veja o passo a passo no README.md.
//
// Enquanto supabaseUrl / supabaseAnonKey estiverem vazios, o site funciona
// em "modo local": a biblioteca fica salva só neste navegador (como era
// antes), sem login e sem perfis.
//
// Estas chaves são PÚBLICAS por natureza (ficam visíveis no navegador de
// qualquer site estático). Quem protege os dados são as regras do banco
// (sql/schema.sql). NUNCA coloque aqui a chave "service_role".
// =====================================================================

export const config = {
    siteName: 'KamyList',

    // Supabase > Project Settings > API
    supabaseUrl: '',        // ex.: 'https://abcdefghijk.supabase.co'
    supabaseAnonKey: '',    // chave "anon" / "public"

    // Opcional: busca de séries e filmes (TMDB). Crie uma chave GRATUITA em
    // https://www.themoviedb.org/settings/api (use a "API Key (v3 auth)").
    // Sem ela, a busca de séries/filmes fica desativada (a de animes não depende disso).
    tmdbApiKey: '',

    // Versão da biblioteca do Supabase carregada pela CDN.
    supabaseEsmUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',

    // Código-fonte (aparece no rodapé). Deixe '' para esconder o link.
    repoUrl: 'https://github.com/KamyliSouza/organizador-de-animes',
};

export const hasSupabase = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);
