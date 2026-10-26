# KamyList — tracker de animes com login e perfis públicos

Organize animes, séries e filmes, marque episódios por temporada, veja a agenda da semana e compartilhe sua lista com os amigos por um link (`#/u/seu_usuario`).

É um site **100% estático** (HTML + CSS + JavaScript puro, sem build), então roda direto no **GitHub Pages**. O login e os perfis ficam no **Supabase** (plano gratuito basta), que guarda as contas e as listas.

> Sem configurar o Supabase o site funciona em **modo local**, igual à versão antiga: a lista fica só no navegador, sem login nem perfis. Ótimo para testar antes de ligar o resto.

---

## Passo a passo (cerca de 15 minutos)

### 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com>, crie uma conta e clique em **New project**.
2. Escolha um nome, uma senha para o banco (guarde) e a região mais próxima (ex.: *South America (São Paulo)*).
3. Espere o projeto terminar de criar.

### 2. Criar as tabelas e as regras de segurança

1. No Supabase, abra **SQL Editor → New query**.
2. Copie **todo** o conteúdo de [`sql/schema.sql`](sql/schema.sql), cole e clique em **Run**.
3. Pode rodar de novo quando quiser (por exemplo, depois de atualizar o site): o script não duplica nada.

Isso cria as tabelas `profiles` e `entries`, as regras que impedem uma pessoa de ver ou mexer na lista de outra e as funções usadas pelos perfis públicos (inclusive a que permite excluir a própria conta). Também cria o armazenamento das **fotos de perfil** (bucket público `avatars`, com limite de 64 KB por arquivo).

### 3. Copiar as chaves para o site

1. No Supabase, clique no botão **Connect** (no topo da página do projeto). Ele mostra a **Project URL** (algo como `https://abcdefghijk.supabase.co`, que é o *Project ID* seguido de `.supabase.co`) e a chave pública.
2. A chave também fica em **Settings → API Keys**. Projetos novos têm a **Publishable key** (começa com `sb_publishable_`); projetos antigos têm a chave **anon**. Qualquer uma das duas serve.
3. Abra [`js/config.js`](js/config.js) e preencha:

```js
supabaseUrl: 'https://abcdefghijk.supabase.co',
supabaseAnonKey: 'sb_publishable_...',   // ou a chave anon
```

> A chave publishable/anon é **pública por natureza** (fica visível no navegador de qualquer site estático). Quem protege os dados são as regras do banco do passo 2. **Nunca** coloque aqui a chave **secret** nem a `service_role`.

### 4. Configurar o login (Authentication)

No Supabase, em **Authentication → URL Configuration**:

| Campo | O que colocar |
|---|---|
| **Site URL** | O endereço do seu site no GitHub Pages, ex.: `https://kamylisouza.github.io/organizador-de-animes/` |
| **Redirect URLs** | Adicione `https://kamylisouza.github.io/organizador-de-animes/**` (e `http://localhost:8000/**` se for testar no computador) |

Isso é necessário para os links de **confirmar e-mail** e **recuperar senha** voltarem para o seu site.

Em **Authentication → Sign In / Providers → Email** você escolhe:

- **Confirm email** ligado (padrão): quem cria a conta recebe um e-mail e precisa clicar no link. É o mais seguro.
- **Confirm email** desligado: a pessoa entra na hora. Para um grupo pequeno de amigos costuma ser mais prático, e evita o limite de e-mails do plano gratuito (poucos e-mails por hora).

### 5. Publicar no GitHub Pages

1. Envie os arquivos para o repositório (`index.html`, pastas `css`, `js`, `sql` e `favicon.svg`).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha `main` e a pasta `/ (root)`.
3. Em um ou dois minutos o site estará em `https://SEU_USUARIO.github.io/NOME_DO_REPO/`.

Pronto: crie sua conta, abra **Perfil e configurações**, ative **Perfil público** e mande o link para os amigos.

---

## Atualizando um site que já está no ar

**Ordem importante:** primeiro rode o `sql/schema.sql` de novo no Supabase (SQL Editor → New query → cole tudo → Run) e **depois** suba os arquivos novos no GitHub. É seguro repetir: nada é duplicado nem apagado, as obras existentes continuam como estão.

Sem esse passo, estas coisas não funcionam (o site mostra um aviso amarelo na biblioteca quando o banco está desatualizado):

- salvar uma obra como **Dropado** ou **Em espera** (o banco antigo só conhece Assistindo, Quero Ver e Concluído);
- marcar obras como **favoritas** e guardar o código da fonte (para detectar obras repetidas);
- a **foto de perfil** (o SQL cria o armazenamento `avatars` e a coluna que guarda a versão da foto);
- o botão **Excluir minha conta**.

---

## Testar no computador

Os módulos JavaScript não funcionam abrindo o `index.html` com duplo clique. Use um servidor local:

```bash
cd organizador-de-animes
python3 -m http.server 8000
# abra http://localhost:8000
```

---

## Conta: Personalização e Configurações

Em **Perfil** (menu do topo) a conta tem duas abas, cada uma com o próprio botão de salvar (o que foi digitado numa aba não é salvo pela outra, e o site avisa antes de descartar alterações ao trocar de aba):

- **Personalização** (`#/configuracoes`): foto de perfil, nome de exibição, bio e nome de usuário.
- **Configurações** (`#/configuracoes/conta`): privacidade (perfil público, mostrar anotações), e-mail e senha, sair da conta, backup e a zona de perigo (excluir a conta).

## Foto de perfil

- Em **Personalização → Foto de perfil → Escolher/Trocar foto**. Aceita JPG, PNG, WebP e GIF de até 12 MB.
- O **navegador** recorta um quadrado no centro e reduz para **128×128** em WebP (JPEG nos navegadores sem suporte a WebP), geralmente com **3 a 10 KB**. Só essa versão pequena é enviada. O servidor ainda recusa qualquer arquivo acima de **64 KB** ou que não seja WebP/JPEG.
- Fica uma **única foto por conta**: o arquivo se chama como o ID da conta, então trocar **sobrescreve** a anterior (nada de imagens antigas acumulando). **Remover foto** e **Excluir a conta** apagam o arquivo de verdade do Storage.
- A foto é **pública** (qualquer pessoa que veja o perfil, o Explorar ou o menu do site pode vê-la); só a dona consegue enviar, trocar ou apagar a dela.
- O número da versão vai no endereço da imagem (`?v=...`), por isso uma foto trocada aparece na hora, sem ficar presa no cache.

**Limites do plano gratuito do Supabase** (valem na data desta versão; confira em *Settings → Billing / Usage*):

| Item | Plano gratuito | Para este site |
|---|---|---|
| Armazenamento | 1 GB | uma foto de ~5 KB cabe mais de 100 mil vezes |
| Tamanho máximo por arquivo | 50 MB (global) | o bucket limita a 64 KB |
| Tráfego de saída (egress) | ~5 GB + ~5 GB em cache por mês | cada foto exibida pesa poucos KB |
| Redimensionar imagens no servidor | não incluído no plano gratuito | por isso a redução é feita no navegador |
| Projeto sem uso | pausa após ~1 semana sem atividade | basta abrir o site/Supabase para retomar |

Se você apagar usuários direto no painel do Supabase (*Authentication → Users*), a foto da pessoa **não** é removida sozinha (o banco não consegue apagar arquivos do Storage): apague em **Storage → avatars**. Pelo botão "Excluir minha conta" do próprio site isso é feito automaticamente.

## Perfis e privacidade

- Todo perfil **começa privado**. Só aparece em **Explorar** e em `#/u/usuario` depois que a pessoa ativa **Perfil público**.
- As **anotações** (diário) continuam só para a dona da conta, mesmo com o perfil público. Para mostrá-las, ative **Mostrar minhas anotações**. Isso é garantido no banco, não só na tela.
- Quem não está logado pode ver perfis públicos, mas não consegue ler nem editar nada além disso.
- Trocar o nome de usuário muda o link do perfil (o antigo deixa de funcionar).
- **Excluir a conta:** em **Perfil → Configurações → Zona de perigo**. É preciso digitar o nome de usuário para confirmar. Apaga a conta, o perfil, a foto e todas as obras, para sempre (exporte um backup antes se quiser guardar a lista). O link do perfil deixa de existir e o nome de usuário volta a ficar livre.

## Status das obras

**Assistindo**, **Quero Ver**, **Concluído**, **Em espera** e **Dropado**. *Em espera* é para o anime que você pausou e pretende retomar; *Dropado* é para o que você abandonou. As duas aparecem com a capa em tons de cinza e têm contador próprio no topo. Marcar um episódio numa obra em espera ou dropada a coloca de volta em *Assistindo*.

Ao salvar uma obra como **Concluído**, todos os episódios de todas as temporadas são marcados como vistos (só quando o status *muda* para Concluído: editar uma obra que já estava concluída não mexe nos episódios).

## Favoritos

O coração no card fixa a obra como favorita (até **8**). No perfil, os favoritos aparecem numa seção **Favoritos** logo acima da biblioteca, inclusive para quem visita o perfil público. O limite é aplicado pelo site (no banco o campo é só um marcador).

## Obras repetidas

Ao digitar o título (ou escolher um resultado da busca), o formulário avisa se você já tem aquela obra. A comparação ignora maiúsculas, acentos e pontuação, e também reconhece a mesma obra vinda de outra fonte pelo código dela (MyAnimeList, AniList ou TMDB). É só um aviso: ao salvar você escolhe *Cancelar*, *Ver a existente* ou *Adicionar mesmo assim*.

## Cartão de compartilhamento e capas

Para o cartão virar uma imagem baixável, o navegador só aceita a capa se o site dela permitir (CORS). Quando não permite, o KamyList tenta de novo com um pedido novo e, se ainda assim falhar, busca a capa por um serviço de imagens intermediário (por padrão `wsrv.nl`, gratuito e de terceiros: ele recebe o endereço da capa, nada da sua conta). Se preferir outro serviço, ou nenhum, ajuste `imageProxy` no `js/config.js`:

```js
imageProxy: 'https://wsrv.nl/?url={url}&w=560&h=840&fit=cover&output=jpg&q=85', // padrão (pode omitir a linha)
// imageProxy: '',                                                              // desliga: sem capa quando o site não libera
```

Se mesmo assim a capa não puder entrar, o cartão sai sem ela e mostra um aviso.

## Trazer a lista da versão antiga

- **Do mesmo navegador:** ao entrar pela primeira vez, a biblioteca avisa se encontrar obras salvas da versão antiga e oferece **Importar**. Também fica em **Perfil e configurações → Seus dados**.
- **De outro navegador/computador:** na versão antiga, exporte o backup; aqui use **Importar backup** e escolha **Adicionar** (mantém o que você já tem) ou **Substituir tudo**.
- **Exportar** gera um arquivo `.json` com toda a sua lista, bom para guardar uma cópia.

## Busca de séries e filmes (TMDB, opcional)

A busca de **animes** funciona sem chave, com duas fontes: **AniList** (a primeira da lista e a padrão) e **MyAnimeList** (via Jikan). A fonte escolhida fica lembrada neste navegador.

- No **MyAnimeList** as sequências (2ª temporada, filmes) são buscadas quando você escolhe a obra, por isso há uma pequena espera. O Jikan limita o número de buscas por segundo; o site espaça os pedidos, tenta de novo sozinho quando o serviço pede calma ou está lento e avisa quando mesmo assim não deu. Se o MAL estiver fora do ar, troque para o AniList.

Para buscar séries e filmes:

1. Crie uma conta gratuita em <https://www.themoviedb.org/settings/api> e gere uma chave (**API Key v3**).
2. Coloque em `tmdbApiKey` no `js/config.js`.

> **Importante:** a chave do TMDB que estava no `index.html` do repositório antigo ficou pública no histórico do GitHub. Gere uma **nova** chave e apague/revogue a antiga no painel do TMDB.
> Quando a chave está ativa, o rodapé mostra a atribuição exigida pelo TMDB automaticamente.

---

## Como o código está organizado

```
index.html              página única (carrega CSS e js/main.js)
css/                    tokens (cores), base, componentes e telas
js/
  main.js               inicia tudo e define as rotas
  config.js             o único arquivo que você precisa editar
  core/                 DOM seguro, roteador, modal, toasts, tema, ícones
  domain/               regras puras: obras, temporadas, estatísticas, backup
  services/             backends (local e Supabase), sessão, busca (Jikan, AniList, TMDB)
  ui/                   componentes: cards, filtros, modais, cartão de compartilhar, avatar, abas da conta
  views/                telas: início, biblioteca, login, perfil, explorar, personalização, configurações
sql/schema.sql          tabelas, regras de segurança e funções do Supabase (pode rodar de novo a qualquer momento)
```

Os dois backends (`local-backend.js` e `supabase-backend.js`) têm a mesma interface, por isso as telas não sabem de onde os dados vêm.

## Segurança em resumo

- **Regras no banco (RLS):** cada pessoa só lê e altera as próprias obras; perfis públicos só são lidos por funções que respeitam as opções de privacidade.
- **Sem XSS:** todo texto vindo de usuários ou de APIs é escapado antes de ir para a tela; capas só aceitam `https`.
- **CSP:** o `index.html` só permite scripts do próprio site e do jsDelivr (onde fica a biblioteca do Supabase) e só conversa com as APIs usadas.
- **Fotos:** bucket `avatars` com limite de 64 KB e só WebP/JPEG; cada pessoa só envia/troca/apaga o arquivo que tem o próprio ID como nome. O site só monta o endereço da foto com ID (UUID) e versão numérica válidos.
- **Limites:** até **2000 obras por conta**, e campos com tamanho máximo, validados no banco.
- **Cadastro aberto:** qualquer pessoa com o link pode criar conta. Se quiser restringir a só os amigos, desligue **Authentication → Sign In / Providers → Allow new users to sign up** depois que todos tiverem criado a conta, ou crie os usuários manualmente em **Authentication → Users**.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Não foi possível iniciar o KamyList" | URL ou chave erradas no `js/config.js`, ou sem internet |
| "Perfil não encontrado" nas configurações | O `sql/schema.sql` não foi executado (ou a conta foi criada antes dele) |
| Aviso amarelo "O banco de dados precisa ser atualizado", "O banco ainda não aceita este status" ou "Não foi possível excluir a conta" | O `sql/schema.sql` novo ainda não foi executado (veja "Atualizando um site que já está no ar") |
| "O armazenamento de fotos ainda não existe" ou "A foto ficou grande demais" | O `sql/schema.sql` novo não foi executado (cria o bucket `avatars` com o limite de 64 KB) |
| MAL mostra "Muitas buscas seguidas" ou "Serviço indisponível" | O Jikan limitou ou está lento: espere alguns segundos ou use o AniList |
| E-mail de confirmação não chega | Veja o spam; o plano gratuito limita e-mails por hora. Para grupos pequenos, desligue **Confirm email** |
| Link do e-mail leva a uma página errada | **Site URL** / **Redirect URLs** não batem com o endereço do GitHub Pages |
| Busca de séries/filmes desativada | Falta a `tmdbApiKey` no `js/config.js` |
| Tela em branco abrindo o arquivo direto | Use um servidor local (veja "Testar no computador") |

---

Dados das obras: [MyAnimeList](https://myanimelist.net) via [Jikan](https://jikan.moe), [AniList](https://anilist.co) e [TMDB](https://www.themoviedb.org). Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
