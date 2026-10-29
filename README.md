# KamyList — tracker de animes com login e perfis públicos

Organize animes, séries e filmes, marque episódios por temporada, veja a agenda da semana e compartilhe sua lista com quem quiser por um link (`#/u/seu_usuario`).

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
- **Confirm email** desligado: a pessoa entra na hora. Para um grupo pequeno costuma ser mais prático, e evita o limite de e-mails do plano gratuito (poucos e-mails por hora).

### 5. Publicar no GitHub Pages

1. Envie os arquivos para o repositório (`index.html`, pastas `css`, `js`, `sql` e `favicon.svg`).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha `main` e a pasta `/ (root)`.
3. Em um ou dois minutos o site estará em `https://SEU_USUARIO.github.io/NOME_DO_REPO/`.

Pronto: crie sua conta, abra **Perfil e configurações**, ative **Perfil público** e mande o link para quem quiser.

---

## Atualizando um site que já está no ar

**Ordem importante:** primeiro rode o `sql/schema.sql` de novo no Supabase (SQL Editor → New query → cole tudo → Run) e **depois** suba os arquivos novos no GitHub. É seguro repetir: nada é duplicado nem apagado, as obras existentes continuam como estão.

Sem esse passo, estas coisas não funcionam (o site mostra um aviso amarelo na biblioteca quando o banco está desatualizado):

- salvar uma obra como **Dropado** ou **Em espera** (o banco antigo só conhece Assistindo, Quero ver e Concluído);
- marcar obras como **favoritas** e guardar o código da fonte (para detectar obras repetidas);
- a **foto de perfil** (o SQL cria o armazenamento `avatars` e a coluna que guarda a versão da foto);
- **seguir pessoas**, os **pedidos** para perfis privados, o **feed** e as **análises** (o SQL cria a tabela de seguidores, as colunas da análise e as funções do feed);
- as **cores do perfil** (o SQL cria a coluna `palette`);
- **mangás e light novels** (o SQL libera as categorias *Mangá* e *Light novel* e cria as colunas de capítulos, volumes e origem — a versão do banco passa a ser a **6**);
- **cargos, denúncias e o painel da equipe** (o SQL cria as tabelas de cargos, suspensões, denúncias, registro e configurações do site — a versão do banco passa a ser a **7**; veja "Cargos e painel da equipe", inclusive o SQL que define a Dona);
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

- **Personalização** (`#/configuracoes`): foto de perfil, nome de exibição, "sobre você", nome de usuário e **cores** (veja "Cores do perfil").
- **Configurações** (`#/configuracoes/conta`): privacidade (perfil público, mostrar anotações), e-mail e senha, sair da conta, backup e a zona de perigo (excluir a conta).

## Foto de perfil

- Em **Personalização → Foto de perfil → Escolher/Trocar foto**. Aceita JPG, PNG, WebP e GIF de até 12 MB.
- O **navegador** recorta um quadrado no centro e reduz para **128×128** em WebP (JPEG nos navegadores sem suporte a WebP), geralmente com **3 a 10 KB**. Só essa versão pequena é enviada. O servidor ainda recusa qualquer arquivo acima de **64 KB** ou que não seja WebP/JPEG.
- Fica uma **única foto por conta**: o arquivo se chama como o ID da conta, então trocar **sobrescreve** a anterior (nada de imagens antigas acumulando). **Remover foto** e **Excluir a conta** apagam o arquivo de verdade do Storage.
- A foto é **pública** (qualquer pessoa que veja o perfil, o Explorar ou o menu do site pode vê-la); só a própria pessoa consegue enviar, trocar ou apagar a sua.
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

- Todo perfil **começa privado**. Só aparece em **Explorar** e mostra a biblioteca para qualquer pessoa em `#/u/usuario` depois que a pessoa ativa **Perfil público**. Enquanto for privado, só quem a pessoa aprovou vê a biblioteca (veja "Seguir pessoas").
- As **anotações** (diário) continuam só para quem criou a conta, mesmo com o perfil público. Para mostrá-las, ative **Mostrar minhas anotações**. Isso é garantido no banco, não só na tela.
- Quem não entrou na conta pode ver perfis públicos, mas não consegue ler nem editar nada além disso.
- Trocar o nome de usuário muda o link do perfil (o antigo deixa de funcionar).
- **Excluir a conta:** em **Perfil → Configurações → Zona de perigo**. É preciso digitar o nome de usuário para confirmar. Apaga a conta, o perfil, a foto, as obras e os vínculos de seguir, para sempre (exporte um backup antes se quiser guardar a lista). O link do perfil deixa de existir e o nome de usuário volta a ficar livre.

## Seguir pessoas

- No perfil de alguém (`#/u/usuario`) há o botão **Seguir**. Em **perfil público** o vínculo é imediato. Em **perfil privado** o botão é **Pedir para seguir**: o pedido fica *pendente* até a pessoa dona do perfil aprovar. Quem pediu pode **cancelar** o pedido a qualquer momento.
- Quem tem um perfil privado vê um número vermelho no menu **Feed** quando há pedidos esperando e responde em **Feed → Pedidos** (**Aceitar** ou **Recusar**). Quem teve o pedido recusado pode pedir de novo.
- Em **Seguidores** (no próprio perfil) dá para **Remover** alguém: a pessoa perde o acesso na hora. Quem segue pode **Deixar de seguir** quando quiser (num perfil privado precisará pedir de novo).
- Se um perfil privado **vira público**, os pedidos pendentes são aceitos automaticamente (eles já poderiam ver tudo). Se um perfil público **vira privado**, quem já seguia continua seguindo.
- Cada conta pode seguir até **1000** perfis.

**O que cada pessoa enxerga de um perfil privado**

| Quem vê | O que aparece |
|---|---|
| Qualquer pessoa / quem ainda não teve o pedido aceito | só **nome**, **@usuário**, **foto** e as **cores do perfil** (sem bio, obras, análises, estatísticas nem número de seguidores) e o botão de seguir |
| Quem teve o pedido aceito | a biblioteca inteira, as análises, a bio e as contagens. As **anotações privadas continuam escondidas**, a não ser que a pessoa ative **Mostrar minhas anotações** |
| A própria pessoa | tudo (a tela do perfil é uma prévia do que quem segue vê) |

Observação: perfis privados continuam **encontráveis pelo nome de usuário** (é assim que dá para pedir para seguir), mas só com esse cartão limitado. Eles não aparecem na lista do **Explorar**.

## Feed

Em **Feed → Atividade** aparece o que as pessoas que você segue fizeram, da mais recente para a mais antiga (30 por vez, com **Carregar mais**).

Entram no feed: **obra adicionada**, **mudança de status** (ex.: começou a assistir, concluiu, dropou) e **análise escrita ou alterada**. Cada obra aparece **uma vez**, com a atividade mais recente dela.

**Não** entram no feed: marcar episódios, favoritar, mudar tags, editar anotações, e **importar backup / lista antiga** (as obras importadas chegam "em silêncio"). Anotações privadas nunca aparecem no feed.

Só atividade **nova** entra: as obras que já estavam na biblioteca antes de você rodar o SQL desta versão não aparecem no feed (ele começa vazio e vai enchendo conforme as pessoas adicionam, concluem ou analisam).

O feed **não atualiza sozinho**: ele carrega quando você abre a tela e no botão **Atualizar**. O número de pedidos no menu é conferido ao abrir o site, ao voltar para a aba e ao responder um pedido.

## Análises

Ao adicionar ou editar uma obra existe o campo **Minha análise** (até **2000 caracteres**) com a opção **Contém spoilers**.

- A **análise** é para ser lida: aparece no detalhe da obra e no feed para quem pode ver a sua biblioteca (todo mundo, se o perfil for público; só quem teve o pedido aceito, se for privado).
- As **anotações** são outra coisa: continuam sendo o seu diário, só você vê (a não ser que ative **Mostrar minhas anotações**).
- Análise marcada como **spoiler** aparece **escondida** atrás do botão **Mostrar análise** (no feed e no detalhe). Análises longas vêm recolhidas, com **Ler mais**.
- A marcação de spoiler só vale se houver texto na análise.

## Cores do perfil

Em **Perfil → Personalização → Cores** cada pessoa escolhe uma entre 8 combinações: Ameixa (padrão), Oceano, Floresta, Pôr do sol, Cereja, Índigo, Grafite e **Alto contraste** (preto e branco no tema claro; preto e amarelo no escuro). A escolha é salva na hora.

- **Para quem escolheu:** a combinação vale para o site inteiro (nos temas claro e escuro) sempre que a pessoa estiver com a sessão iniciada, em qualquer aparelho.
- **Para quem visita:** ao abrir o perfil de outra pessoa (com ou sem login, público ou privado ainda trancado), a página usa as cores dela. Ao sair do perfil, volta para as cores de quem está visitando.
- Todas as combinações passam no contraste de leitura **WCAG AA** (texto 4,5:1; botões e bordas 3:1) nos dois temas. Para conferir depois de mudar algo: `node tools/palettes.mjs --check`.
- **Criar ou ajustar uma combinação:** edite a lista em `tools/palettes.mjs` e rode `node tools/palettes.mjs` (sem `--check`): ele confere o contraste e gera o `css/palettes.css`. Adicione o nome também em `js/domain/palettes.js`. Não é preciso mudar o SQL.
- No modo local (sem Supabase) a escolha fica guardada só neste navegador.

## Mangás e light novels

A biblioteca (e o perfil de quem você visita) tem duas abas: **Assistir** (animes, filmes e séries) e **Ler** (mangás e light novels). Cada aba tem os próprios números, filtros, favoritos e estatísticas. A última aba usada fica lembrada neste navegador; no perfil de outra pessoa abre a primeira aba que tiver obras.

- **Categorias:** *Mangá* e *Light novel*. Manhwa (Coreia) e manhua (China) são cadastrados como *Mangá* e ganham um selo de origem ("Manhwa", "Manhua") nos cards, na lista e nos detalhes.
- **Progresso por contadores:** capítulos lidos / total e volumes lidos / total. O botão **+1 Cap** soma um capítulo (só em obras *Lendo*) e **Progresso** abre a janela para ajustar os quatro números. Total **0** quer dizer "não sei" (obra em publicação): o card mostra só o que já foi lido, sem barra de progresso. Os lidos nunca passam do total.
- **Status de leitura:** *Lendo*, *Quero ler*, *Concluído*, *Em espera* e *Dropado* (por baixo são os mesmos status dos animes, só mudam os nomes). Ao escolher *Concluído*, capítulos e volumes vão até o total, quando ele é conhecido. Obras *Quero ler* ainda não têm +1 Cap: para começar, mude o status para *Lendo*.
- **Busca:** **AniList** e **MyAnimeList** (via Jikan), sem chave. A busca preenche título, capa, sinopse, gêneros, totais e origem. O TMDB não tem mangá, por isso não aparece na lista. A mesma obra vinda das duas fontes é reconhecida como repetida.
- **Sem temporadas nem agenda:** mangás não usam temporadas, e a **Agenda** da semana existe só na aba *Assistir*.
- **Favoritos:** o limite de **8** vale por aba (8 em Assistir e 8 em Ler).
- **Estatísticas:** o modal tem duas abas. *Ler* mostra capítulos e volumes lidos, mangá × light novel e os gêneros mais lidos.
- **Feed e compartilhar:** o feed usa "começou a ler" e "concluiu a leitura"; o cartão de compartilhar mostra o progresso de leitura.
- **Backup:** o `.json` exportado leva os novos campos, e backups antigos (de antes dos mangás) continuam entrando normalmente.

## Cargos e painel da equipe

O site tem quatro cargos. O cargo aparece como um selo ao lado do nome (perfil, Explorar, feed, pedidos e listas de seguidores); **membros não têm selo**.

| Cargo | Selo | O que pode |
|---|---|---|
| **Dona** | Dona | Tudo. É a única que abre e fecha os cadastros e a única que cria ou remove administradores. Só existe uma. |
| **Administração** | Admin | Tudo o que a moderação faz, mais o **aviso do site** e a **lista de nomes proibidos**. Define quem é moderação ou membro. Não mexe na Dona nem em outra administração. |
| **Moderação** | Mod | Buscar membros, restaurar nome, bio, foto e @, **renomear**, **suspender** e reativar contas, tratar denúncias e ver o registro. Não mexe em cargos nem nas configurações do site. |
| **Membro** | — | Nível padrão. Pode **denunciar** perfis. |

**Regra de ouro:** quem age só atinge quem tem um cargo **menor** que o seu, e só concede cargos menores que o seu. Isso é conferido no banco de dados (não só nos botões da tela), e os cargos ficam numa tabela fechada: nenhum usuário consegue editar o próprio cargo, nem pelo site nem pela API.

### Definir a Dona (uma vez)

Não existe botão para isso, de propósito. No Supabase, abra **SQL Editor → New query**, troque o e-mail e rode:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict (user_id) do update set role = 'owner';
```

Recarregue o site: aparece **Painel** no menu (no celular, em **Perfil e configurações → Painel da equipe**).

**Passar o cargo de Dona para outra pessoa** (só pode haver uma): rode os dois comandos juntos. A conta nova precisa existir antes. A Dona não consegue excluir a própria conta pelo site; passe o cargo antes.

```sql
delete from public.user_roles where role = 'owner';
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'NOVA_DONA@exemplo.com';
```

> **Proteja a conta da Dona:** ela pode tudo. Use uma senha forte e só dela e ative a verificação em duas etapas no **e-mail** dessa conta (e nas contas do Supabase e do GitHub). Quem controla o e-mail consegue redefinir a senha do site.

### O painel (`#/admin`)

Só aparece para quem tem cargo (quem não tem é mandado de volta ao início; mesmo que alguém force a página, o banco recusa tudo). Tem quatro abas:

- **Membros:** busca por nome ou @usuário e o botão **Gerenciar** (restaurar dados, renomear, suspender e cargo). A moderação não vê e-mails nem bibliotecas privadas.
- **Denúncias:** a fila de denúncias em aberto, com o motivo, o detalhe e quem denunciou. Dá para **resolver**, **descartar** ou **reabrir**, e gerenciar a pessoa ali mesmo. A equipe só vê denúncias contra quem tem cargo menor que o seu (ninguém vê denúncias contra a Dona).
- **Registro:** toda ação da equipe (quem fez, quando, em quem e o antes e depois). O registro só cresce: nem a Dona edita pelo site. Os nomes ficam gravados como texto, então continuam legíveis mesmo se a conta for excluída.
- **Site** (administração e Dona): **cadastros** (só a Dona), **aviso do site** (até 280 caracteres, aparece no topo para todo mundo) e **nomes proibidos**.

### Denunciar

Em qualquer perfil que não seja o seu aparece **Denunciar**: a pessoa escolhe o motivo (nome, bio, foto, spam ou outro) e, se quiser, escreve um detalhe de até 300 caracteres. Só a equipe vê, e a pessoa denunciada não sabe quem denunciou. Cada pessoa tem **uma denúncia aberta por perfil** (repetir não duplica) e no máximo **10 em aberto** ao mesmo tempo.

### Restaurar, renomear e suspender

- **Restaurar:** o nome de exibição volta para "Usuário" + 4 caracteres; a bio fica vazia; o @ vira `user_` + um código (o link antigo do perfil deixa de funcionar); a foto some. A pessoa pode editar de novo depois. Ao restaurar a foto, o site a esconde na hora e tenta apagar o arquivo; se o Supabase recusar, apague em **Storage → avatars** (o perfil já aparece sem foto).
- **Renomear:** troca só o nome de exibição (1 a 40 caracteres), mesmo que contenha uma palavra da lista de nomes proibidos.
- **Suspender:** o perfil some para as outras pessoas (Explorar, link do perfil, seguidores, feed). Quem é suspensa continua vendo a própria biblioteca e vê um aviso no topo com o motivo, mas não consegue seguir nem denunciar, e perde os poderes de equipe enquanto durar. **Reativar** devolve tudo.

### Nomes proibidos e cadastros fechados

- **Nomes proibidos:** a lista vale para nomes de usuário e nomes de exibição **que contêm** a palavra (sem diferenciar maiúsculas nem acentos). Cuidado com palavras curtas: elas valem também dentro de outras palavras. Vale para contas novas e para quem editar o nome; quem já tinha um nome assim só é barrado ao tentar mudá-lo, e a equipe pode renomear.
- **Cadastros fechados:** o banco recusa qualquer conta nova, **inclusive** a criada manualmente em *Authentication → Users → Add user* do Supabase. Quem já tem conta continua entrando normalmente. A página "Criar conta" avisa antes de a pessoa preencher tudo. Para criar contas à mão, reabra os cadastros no painel.

## Status das obras

**Assistindo**, **Quero ver**, **Concluído**, **Em espera** e **Dropado**. *Em espera* é para o anime que você pausou e pretende retomar; *Dropado* é para o que você abandonou. As duas aparecem com a capa em tons de cinza e têm contador próprio no topo.

- **Trocar o status:** todo card (e cada linha, no modo lista) tem um seletor de status. Ao escolher *Concluído*, todos os episódios são marcados como vistos.
- **+1 Ep:** o botão só aparece em obras *Assistindo*. Para começar uma obra de *Quero ver*, mude o status para *Assistindo* ou marque episódios em **Temporadas**. Marcar um episódio em **Temporadas** numa obra em espera ou dropada a coloca de volta em *Assistindo*.
- **Números no topo:** cada número (Obras, Assistindo, Quero ver…) é um botão que filtra a lista pelo status correspondente. O mesmo vale no perfil de outras pessoas.
- **Capa:** clicar na capa abre os detalhes da obra, nos cards e no modo lista (também no perfil de outras pessoas).

Ao salvar uma obra como **Concluído**, todos os episódios de todas as temporadas são marcados como vistos (só quando o status *muda* para Concluído: editar uma obra que já estava concluída não mexe nos episódios).

## Favoritos

O coração no card fixa a obra como favorita (até **8**). No perfil, os favoritos aparecem numa seção **Favoritos** logo acima da biblioteca, inclusive para quem visita o perfil público. O limite é aplicado pelo site (no banco o campo é só um marcador).

## Botão voltar

O botão voltar do navegador (ou do celular) fecha o modal aberto (estatísticas, detalhes, formulário…) em vez de sair da tela. Com dois modais abertos, fecha um por vez. Fechar pelo X ou pelo Esc não deixa "entrada fantasma" no histórico.

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

A busca de **animes** e de **mangás/light novels** funciona sem chave, com duas fontes: **AniList** (a primeira da lista e a padrão) e **MyAnimeList** (via Jikan). A fonte escolhida fica lembrada neste navegador.

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
css/                    tokens (cores), palettes.css (combinações de cores, gerado), base, componentes e telas
js/
  main.js               inicia tudo e define as rotas
  config.js             o único arquivo que você precisa editar
  core/                 DOM seguro, roteador, modal, toasts, tema, ícones
  domain/               regras puras: obras, temporadas, estatísticas, backup, cargos
  services/             backends (local e Supabase), sessão, busca (Jikan, AniList, TMDB)
  ui/                   componentes: cards, filtros, modais, cartão de compartilhar, avatar, abas da conta, abas Assistir/Ler, progresso de leitura
  views/                telas: início, biblioteca, login, perfil, explorar, feed (atividade e pedidos), personalização, configurações, painel da equipe (admin.js)
tools/palettes.mjs      gera css/palettes.css e confere o contraste das cores (node tools/palettes.mjs --check)
sql/schema.sql          tabelas, regras de segurança e funções do Supabase (pode rodar de novo a qualquer momento)
```

Os dois backends (`local-backend.js` e `supabase-backend.js`) têm a mesma interface, por isso as telas não sabem de onde os dados vêm.

## Segurança em resumo

- **Regras no banco (RLS):** cada pessoa só lê e altera as próprias obras; perfis públicos só são lidos por funções que respeitam as opções de privacidade.
- **Sem XSS:** todo texto vindo de usuários ou de APIs é escapado antes de ir para a tela; capas só aceitam `https`.
- **CSP:** o `index.html` só permite scripts do próprio site e do jsDelivr (onde fica a biblioteca do Supabase) e só conversa com as APIs usadas.
- **Seguir e feed:** a tabela de seguidores não pode ser lida nem escrita direto (só por funções do banco que conferem quem está com a sessão iniciada). Um perfil privado só entrega as obras a quem a pessoa dona do perfil aceitou, e o feed só devolve atividade de quem você segue com vínculo aceito. As anotações privadas nunca saem no feed.
- **Fotos:** bucket `avatars` com limite de 64 KB e só WebP/JPEG; cada pessoa só envia/troca/apaga o arquivo que tem o próprio ID como nome. O site só monta o endereço da foto com ID (UUID) e versão numérica válidos.
- **Cargos e moderação:** os cargos ficam em uma tabela fechada (ninguém lê nem escreve direto). Toda ação da equipe passa por funções do banco que conferem o cargo de quem chama, só agem em quem tem cargo menor e deixam rastro no registro. Conta suspensa perde os poderes de equipe. As denúncias e o registro também são tabelas fechadas.
- **Limites:** até **2000 obras por conta**, e campos com tamanho máximo, validados no banco.
- **Cadastro aberto:** qualquer pessoa com o link pode criar conta. A Dona pode fechar os cadastros no painel (aba **Site**). Se preferir restringir pelo próprio Supabase, desligue **Authentication → Sign In / Providers → Allow new users to sign up** depois que todos tiverem criado a conta, ou crie os usuários manualmente em **Authentication → Users**.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Não foi possível iniciar o KamyList" | URL ou chave erradas no `js/config.js`, ou sem internet |
| "Perfil não encontrado" nas configurações | O `sql/schema.sql` não foi executado (ou a conta foi criada antes dele) |
| Aviso amarelo "O banco de dados precisa ser atualizado", "O banco ainda não aceita este status" ou "Não foi possível excluir a conta" | O `sql/schema.sql` novo ainda não foi executado (veja "Atualizando um site que já está no ar") |
| Botão "Seguir" ou o Feed dão erro, ou a análise não salva | O `sql/schema.sql` novo ainda não foi executado (a versão 5 inclui seguidores, feed, análises e cores do perfil; a 6, mangás e light novels) |
| "O banco ainda não aceita mangás e light novels" ao salvar | O `sql/schema.sql` da versão 6 ainda não foi executado |
| O painel não abre ou "Denunciar" dá erro | O `sql/schema.sql` da versão 7 ainda não foi executado, ou a sua conta ainda não tem cargo (veja "Definir a Dona") |
| "Não foi possível criar a conta agora: os cadastros podem estar fechados" | A Dona fechou os cadastros (painel → Site). Vale também para *Add user* no Supabase |
| "A Dona do site não pode excluir a conta" | Passe o cargo de Dona para outra pessoa antes (veja "Passar o cargo de Dona") |
| "O armazenamento de fotos ainda não existe" ou "A foto ficou grande demais" | O `sql/schema.sql` novo não foi executado (cria o bucket `avatars` com o limite de 64 KB) |
| MAL mostra "Muitas buscas seguidas" ou "Serviço indisponível" | O Jikan limitou ou está lento: espere alguns segundos ou use o AniList |
| E-mail de confirmação não chega | Veja o spam; o plano gratuito limita e-mails por hora. Para grupos pequenos, desligue **Confirm email** |
| Link do e-mail leva a uma página errada | **Site URL** / **Redirect URLs** não batem com o endereço do GitHub Pages |
| Busca de séries/filmes desativada | Falta a `tmdbApiKey` no `js/config.js` |
| Tela em branco abrindo o arquivo direto | Use um servidor local (veja "Testar no computador") |

---

Dados das obras: [MyAnimeList](https://myanimelist.net) via [Jikan](https://jikan.moe), [AniList](https://anilist.co) e [TMDB](https://www.themoviedb.org). Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
