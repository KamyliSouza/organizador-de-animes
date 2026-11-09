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

Pronto: crie sua conta, clique no seu avatar (canto superior direito) e abra **Configurações**, ative **Perfil público** e mande o link para quem quiser.

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
- as **abas visíveis no perfil** e as contagens por tipo no Explorar (a versão do banco passa a ser a **8**);
- as **notas com meia estrela** (o SQL passa as notas de 1–5 para a escala de 0–10, **uma única vez**: 4 estrelas viram 8 pontos, que continuam aparecendo como 4 estrelas — a versão do banco passa a ser a **9**). Rodar o SQL de novo depois disso não muda mais as notas;
- o **alto contraste** como opção de acessibilidade guardada na conta (o SQL cria a tabela privada `user_prefs` e passa para ela quem usava a cor "Alto contraste" — a versão do banco passa a ser a **10**; veja "Acessibilidade: alto contraste");
- o **fundo do perfil**, que vale no site todo (o SQL cria as colunas `bg_v` e `bg_blur`, o armazenamento `backgrounds` e libera "Imagem de fundo" no Restaurar da equipe — a versão do banco passa a ser a **11**; veja "Fundo do perfil");
- os **limites para trocar a foto e o fundo** (o SQL cria a tabela privada `media_changes`, as funções dos limites e um gatilho no armazenamento — a versão do banco passa a ser a **12**; veja "Limites para trocar a foto e o fundo");
- a **isenção da equipe nos limites de troca** (Dona, Administração e Moderação não têm espera nem limite por dia — a versão do banco passa a ser a **13**; veja "Limites para trocar a foto e o fundo");
- a **denúncia com snapshot** e a **remoção de conteúdo campo a campo** pela equipe (o SQL acrescenta a coluna `snapshot` às denúncias e a função `admin_wipe_text` — a versão do banco passa a ser a **15**; veja "Snapshot da denúncia e remoção de conteúdo");
- a **privacidade forçada**, a **suspensão com prazo e o banimento**, os **avisos (strikes)** e o **link do Discord** da tela de conta suspensa (o SQL cria as tabelas fechadas `account_limits` e `strikes`, acrescenta `ends_at` e `kind` às suspensões e a configuração `discord_url` — a versão do banco passa a ser a **16**; veja "Suspensão, banimento, avisos e privacidade forçada");
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

Clicando no **seu avatar**, no canto superior direito (em qualquer tamanho de tela), abre o **menu da conta**: **Meu perfil** (a sua página pública), **Personalização**, **Configurações**, **Painel da equipe** (só para quem tem cargo) e **Sair da conta**. Ele abre com Enter, Espaço ou seta para baixo, anda com as setas e fecha com Esc. A barra inferior do celular não tem mais o botão Perfil (sem login, ou no modo sem conta, ela continua com **Entrar** / **Ajustes**). A conta tem duas abas, cada uma com o próprio botão de salvar (o que foi digitado numa aba não é salvo pela outra, e o site avisa antes de descartar alterações ao trocar de aba):

- **Personalização** (`#/configuracoes`): o quadro **Seu perfil** (foto de perfil à esquerda; nome de exibição, nome de usuário e "sobre você" à direita) e, logo abaixo, os quadros **Cores** (veja "Cores do perfil") e **Acessibilidade** (veja "Acessibilidade: alto contraste"). No celular e em telas estreitas tudo vira uma coluna só.
- **Configurações** (`#/configuracoes/conta`): privacidade (perfil público, mostrar anotações), e-mail e senha, sair da conta, backup e a zona de perigo (excluir a conta).

## Foto de perfil

- Em **Personalização → Foto de perfil → Escolher/Trocar foto**. Aceita JPG, PNG, WebP e GIF de até 12 MB.
- Ao escolher o arquivo abre a janela **Ajustar foto**: a pessoa enquadra a imagem dentro de um **círculo** (arrastar com o mouse ou o dedo, pinça com dois dedos, roda do mouse, controle de **Zoom** de 100% a 400%, e pelo teclado: setas movem a foto, `+` e `-` dão zoom, `0` e o botão **Centralizar** voltam ao início). A parte dentro do círculo é a que aparece no perfil. **Cancelar**, **Esc** ou o X não enviam nada. Só depois de **Usar esta foto** o arquivo é preparado e enviado.
- O **navegador** corta o quadrado escolhido (sem mexer, é o quadrado central) e reduz para **128×128** em WebP (JPEG nos navegadores sem suporte a WebP), geralmente com **3 a 10 KB**. Só essa versão pequena é enviada. O servidor ainda recusa qualquer arquivo acima de **64 KB** ou que não seja WebP/JPEG.
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

Se você apagar usuários direto no painel do Supabase (*Authentication → Users*), a foto da pessoa **não** é removida sozinha (o banco não consegue apagar arquivos do Storage): apague em **Storage → avatars** (e **backgrounds**). Pelo botão "Excluir minha conta" do próprio site isso é feito automaticamente.

## Fundo do perfil

Em **Personalização → Fundo do perfil** a pessoa escolhe uma imagem que aparece **atrás do site inteiro** (biblioteca, feed, Explorar, configurações, painel...) **enquanto ela estiver com login**, exatamente como as cores. Ao abrir o perfil de **outra pessoa** (`#/u/nome`), a página usa o fundo dela enquanto você estiver ali (se ela não tem fundo, a página fica sem imagem); ao sair do perfil, volta o seu. Sem login, o visitante só vê imagem de fundo dentro de um perfil que tenha. Ao sair da conta, a imagem some na hora. O fundo é uma camada única do site (`js/core/siteBackground.js`) e a chave "Desfoque" muda o site todo na hora, antes mesmo de salvar.

- **Envio:** JPG, PNG, WebP ou GIF de até **20 MB**. O **navegador** reduz a imagem (no máximo **1600 px** no lado maior, sem ampliar) e a converte para **WebP** antes de enviar (JPEG nos navegadores sem suporte a WebP), geralmente com **60 a 200 KB**. Se a imagem não couber em 360 KB, o site baixa a qualidade e, se for preciso, as dimensões. O servidor ainda recusa qualquer arquivo acima de **384 KB** ou que não seja WebP/JPEG. Depois do envio, a tela mostra o tamanho final e o da imagem original.
- **Uma imagem por conta:** o arquivo (bucket público `backgrounds`) se chama como o ID da conta, então trocar **sobrescreve** a anterior. **Remover fundo** apaga o arquivo. O número da versão (`bg_v`) vai no endereço da imagem, então um fundo trocado aparece na hora.
- **Chave "Desfoque nos cards"** (salva na hora, ligada por padrão):
  - **Ligada:** os cards ficam **semitransparentes** com desfoque (`backdrop-filter`) da imagem que está atrás deles.
  - **Desligada:** os cards ficam **opacos** e a imagem fica com **50% do brilho** (`brightness(.5)`).
- **Contraste:** as cores dos cards vêm do tema (claro ou escuro) e da combinação de cores em uso, e um "véu" na cor do tema fica entre a imagem e os cards. O resultado foi medido com imagens de pior caso (toda branca, toda preta e uma foto colorida) nas 8 combinações de cores, nos dois temas e nos dois modos: todo texto fica com **pelo menos 4,5:1**. Textos que ficariam direto sobre a imagem (o título de cada página com o subtítulo e os botões, a barra de filtros do painel, o título "Favoritos" e os avisos) ganham um painel. A medição cobriu a biblioteca, o Explorar, o feed, os pedidos, as duas abas de configurações, o perfil e o painel da equipe. Menu, rodapé e barra de baixo ficam um pouco mais firmes sobre a imagem. Quem usa **Alto contraste** (opção de quem está olhando) não vê a imagem, e quem pede "reduzir transparência" no sistema vê os cards opacos.
- **Público como a foto de perfil:** o fundo aparece até em perfil privado ainda trancado (é só visual, não revela a biblioteca). Conta suspensa: some para os outros.
- **Moderação:** em **Gerenciar → Restaurar dados do perfil** a equipe marca **Imagem de fundo do perfil** e o fundo some na hora (o arquivo também é apagado; se o Supabase recusar, apague em **Storage → backgrounds**). A ação vai para o registro como "restaurou o fundo do perfil de". Ao denunciar, o motivo "Foto" agora é **"Foto ou fundo impróprio"**.
- Se a imagem não carregar (arquivo apagado, sem internet), o site volta ao visual normal sozinho e não fica tentando de novo a cada tela.
- **Excluir a conta** apaga a foto **e** o fundo do armazenamento (antes da versão 1.15 só a foto era apagada). Se você apagar usuários direto no painel do Supabase, remova o arquivo em **Storage → backgrounds** também.

## Limites para trocar a foto e o fundo

Para ninguém ficar trocando a foto ou o fundo sem parar (para fugir de denúncias ou só para gastar armazenamento), o **banco** aplica dois limites (seção 7 do `sql/schema.sql`):

- **Espera de 30 segundos** entre uma troca e outra. A foto e o fundo têm cada um a sua espera: trocar a foto não trava o botão do fundo.
- **No máximo 10 trocas nas últimas 24 horas**, somando foto e fundo (janela móvel: a vaga volta 24 h depois da troca).
- **Remover** a foto ou o fundo não conta como troca. Uma tentativa recusada também não gasta troca.
- Como o limite fica no próprio armazenamento (gatilho em `storage.objects`), vale também para quem tentar enviar direto à API, sem passar pelo site. Trocas feitas pelo painel do Supabase ou por rotinas do servidor (sem login) não são limitadas.
- **Quem tem cargo não tem limite:** Dona, Administração e Moderação trocam foto e fundo sem espera e sem teto por dia, e essas trocas nem são registradas. Ao perder o cargo, os limites passam a valer na hora. No painel Foto/Fundo da Personalização aparece o aviso "Seu cargo na equipe não tem limite de trocas de foto e fundo". (Função `media_exempt()` no `sql/schema.sql`; exige a versão 13 do banco.)
- Na tela (Personalização), cada painel mostra "Trocas de foto e fundo nas últimas 24 horas: X de 10". Durante a espera o botão fica travado com a contagem regressiva ("Espere 17 s para trocar a foto de novo") e libera sozinho; no limite do dia a mensagem diz em quanto tempo libera. O site também confere **antes** de abrir o recorte ou converter a imagem, para você não perder tempo preparando algo que seria recusado.
- **Mudar os números:** edite a função `media_limits()` no fim do `sql/schema.sql` (hoje `select 30, 10`: segundos de espera e trocas por dia) e rode o SQL de novo. O site lê os números do banco.
- Se o Supabase não deixar o SQL Editor criar o gatilho no armazenamento, o script **não para**: aparece o aviso "não foi possível criar o gatilho de limites no armazenamento" no resultado e os limites deixam de valer para envios diretos à API (o resto do site funciona). Nesse caso, avise para ver outra forma de ligar o gatilho.

## Perfis e privacidade

- Todo perfil **começa privado**. Só aparece em **Explorar** e mostra a biblioteca para qualquer pessoa em `#/u/usuario` depois que a pessoa ativa **Perfil público**. Enquanto for privado, só quem a pessoa aprovou vê a biblioteca (veja "Seguir pessoas").
- **Abas visíveis no perfil:** em **Configurações → Privacidade** você escolhe quais abas (Anime, Mangá, Light Novel) outras pessoas veem. As obras de uma aba desligada ficam escondidas **de verdade** (o banco não as entrega no perfil, no Explorar nem no feed); você continua vendo tudo na sua biblioteca. Pelo menos uma aba precisa ficar ligada, e com **só uma** ligada o seletor de abas some do perfil. Na prévia do seu próprio perfil, um aviso lista as abas escondidas. Perfis criados antes dessa versão começam com as três abas ligadas.
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

Ao adicionar ou editar uma obra existem dois botões, **Minha análise** e **Anotações / Diário**. Cada um abre uma **janela própria** para escrever com espaço (o formulário não fica com campos enormes). O botão mostra um resumo do que já foi escrito (ou "Vazia"). O texto vale mesmo que a janela seja fechada pelo X, pelo fundo ou com Esc; **Concluir** só fecha, e **Limpar texto** esvazia o campo. A análise aceita até **2000 caracteres** e tem a opção **Contém spoilers**; as anotações aceitam até **5000**.

- A **análise** é para ser lida: aparece no detalhe da obra e no feed para quem pode ver a sua biblioteca (todo mundo, se o perfil for público; só quem teve o pedido aceito, se for privado).
- As **anotações** são outra coisa: continuam sendo o seu diário, só você vê (a não ser que ative **Mostrar minhas anotações**).
- Análise marcada como **spoiler** aparece **escondida** atrás do botão **Mostrar análise** (no feed e no detalhe). Análises longas vêm recolhidas, com **Ler mais**.
- A marcação de spoiler só vale se houver texto na análise.

## Cores do perfil

Em **Perfil → Personalização → Cores** cada pessoa escolhe uma entre 8 combinações: Ameixa (padrão), Oceano, Floresta, Pôr do sol, Cereja, Índigo, Strong Violet (violeta intenso, base `#7F29C5`) e Grafite. A escolha é salva na hora. (O **Alto contraste** deixou de ser uma cor de perfil e virou uma opção de acessibilidade própria, logo abaixo desta lista: veja "Acessibilidade: alto contraste".)

- **Para quem escolheu:** a combinação vale para o site inteiro (nos temas claro e escuro) sempre que a pessoa estiver com a sessão iniciada, em qualquer aparelho.
- **Para quem visita:** ao abrir o perfil de outra pessoa (com ou sem login, público ou privado ainda trancado), a página usa as cores dela. Ao sair do perfil, volta para as cores de quem está visitando.
- Todas as combinações passam no contraste de leitura **WCAG AA** (texto 4,5:1; botões e bordas 3:1) nos dois temas. Para conferir depois de mudar algo: `node tools/palettes.mjs --check` (ele confere também o alto contraste, em nível AAA).
- **Etiquetas que mudam com o tema:** as cores de *Assistindo*, *Quero ver*, *Concluído*, *Em espera*, *Dropado*, *Filme* e *Série* também fazem parte da combinação. Cada papel usa por padrão a cor de sempre, mas, quando essa cor ficaria parecida com a cor do próprio tema (por exemplo "Concluído" verde no Floresta, ou "Série" azul no Oceano), o tema troca por outra família de cor (campo `roles` em `tools/palettes.mjs`). O comando de conferência também barra qualquer etiqueta com matiz a menos de 25° da cor do tema e confere o contraste do texto sobre o fundo da própria etiqueta.
- **Criar ou ajustar uma combinação:** edite a lista em `tools/palettes.mjs` e rode `node tools/palettes.mjs` (sem `--check`): ele confere o contraste e gera o `css/palettes.css` (e o trecho de cores de `css/contrast.css`). Adicione o nome também em `js/domain/palettes.js`. Não é preciso mudar o SQL.
- No modo local (sem Supabase) a escolha fica guardada só neste navegador.

## Acessibilidade: alto contraste

Em **Personalização → Acessibilidade** (no modo local, em **Ajustes**) há a chave **Alto contraste**: preto e branco no tema claro, preto e amarelo no tema escuro, bordas firmes, fundos opacos (sem vidro fosco nem brilhos), contornos de foco de 4 px e links sublinhados. Todas as cores passam no nível **AAA** (texto 7:1, componentes 4,5:1).

- **É uma opção só de quem a liga.** Ela fica guardada **na conta** (tabela privada `user_prefs`, que só a própria pessoa lê e altera — não fica na tabela de perfis, que qualquer pessoa consegue ler) e vale em qualquer aparelho em que ela entrar. Ninguém mais a vê: o perfil público da pessoa não leva a opção, e quem visita o perfil dela continua com o próprio visual. O contrário também vale: o alto contraste de quem visita fica por cima das cores do perfil visitado.
- **Vale por cima de tudo:** do tema claro/escuro, do "automático" do sistema e de qualquer combinação de cores (as amostras do seletor de cores continuam mostrando as cores reais de cada uma).
- **Aplica antes da página pintar:** a última escolha fica em cache neste navegador (`kamylist_contrast`), então não há "piscada" ao abrir. Ao **sair da conta** o cache é apagado, e quem entrar depois no mesmo navegador não herda a opção. Sem Supabase (modo local) a chave fica só neste navegador.
- **Quem usava a cor "Alto contraste":** o SQL passa essa pessoa para a opção (com a cor do perfil no padrão); no navegador, quem a tinha guardada passa para a opção automaticamente.
- **Ajustar as cores:** edite `HIGH_CONTRAST` em `tools/palettes.mjs` e rode `node tools/palettes.mjs`: ele confere o contraste e reescreve só o trecho marcado (`@cores:inicio` … `@cores:fim`) de `css/contrast.css`. As regras de forma (bordas, links, foco) ficam no resto do arquivo, escritas à mão.

## Abas: Anime, Mangá e Light Novel

A biblioteca (e o perfil de quem você visita) tem três abas: **Anime** (inclui filmes e séries, cada um com o selo da própria categoria no card), **Mangá** e **Light Novel**. Cada aba tem os próprios números, filtros, favoritos e estatísticas. A última aba usada fica lembrada neste navegador; no perfil de outra pessoa abre a primeira aba que tiver obras. (Quem tinha "Assistir" ou "Ler" guardado no navegador cai em *Anime* e *Mangá*.)

- **Novas obras já no tipo certo:** o botão **Nova obra** começa na categoria da aba em que você está (*Anime*, *Mangá* ou *Light novel*). Dentro da família ainda dá para trocar a categoria no formulário (Anime ↔ Filme ↔ Série, ou Mangá ↔ Light novel). Se isso mudar a obra de aba (Mangá ↔ Light novel), o site leva você para a aba onde ela foi parar.
- **Mesmo nome em tipos diferentes:** o anime e o mangá de "Death Note" podem existir juntos, e o filme e a série também. O aviso de **obra repetida** só vale dentro do mesmo tipo (categoria) e diz qual é o tipo na mensagem. A busca do formulário mostra o tipo de cada resultado e marca com "já na sua lista" o que você já tem *daquele tipo*.
- **Busca na biblioteca:** o campo de busca vale para a aba atual. Se o mesmo nome aparece em outra aba, um aviso abaixo da lista mostra onde ("Também há resultados para essa busca em: Mangá (1)") e o botão leva você até lá, mantendo a busca.
- **Progresso das obras dos outros:** no perfil de outra pessoa, o card (e a linha do modo lista) diz onde ela está: **"Episódio: 4 da Temporada: 2"** em anime e série, **"Volume: 5, Capítulo: 10"** em mangá e light novel. A temporada conta só as de TV (OVA, filme e especial aparecem pelo nome, como "Episódio: 2 de OVA Especial"); com uma temporada só, aparece apenas "Episódio: 7". Filmes e obras que ainda não começaram mantêm o texto de sempre. Na sua própria biblioteca nada muda.
- **Explorar em três linhas:** cada cartão do Explorar resume a biblioteca por tipo, **Animes**, **Mangás** e **Light Novels**, cada um com *total*, *ativas* (assistindo ou lendo agora) e *concluídas*. Só entram as abas ligadas da pessoa; uma aba escondida não aparece (nem nas contas).
- **Categorias:** *Mangá* e *Light novel*. Manhwa (Coreia) e manhua (China) são cadastrados como *Mangá* e ganham um selo de origem ("Manhwa", "Manhua") nos cards, na lista e nos detalhes.
- **Progresso por contadores:** capítulos lidos / total e volumes lidos / total. O botão **+1 Cap** soma um capítulo (só em obras *Lendo*) e **Progresso** abre a janela para ajustar os quatro números. Total **0** quer dizer "não sei" (obra em publicação): o card mostra só o que já foi lido, sem barra de progresso. Os lidos nunca passam do total.
- **Status de leitura:** *Lendo*, *Quero ler*, *Concluído*, *Em espera* e *Dropado* (por baixo são os mesmos status dos animes, só mudam os nomes). Ao escolher *Concluído*, capítulos e volumes vão até o total, quando ele é conhecido. Obras *Quero ler* ainda não têm +1 Cap: para começar, mude o status para *Lendo*.
- **Busca:** **AniList** e **MyAnimeList** (via Jikan), sem chave. A busca preenche título, capa, sinopse, gêneros, totais e origem. O TMDB não tem mangá, por isso não aparece na lista. A mesma obra vinda das duas fontes é reconhecida como repetida.
- **Sem temporadas nem agenda:** mangás não usam temporadas, e a **Agenda** da semana existe só na aba *Anime*.
- **Favoritos:** cada aba tem os seus, sem limite de quantidade (veja "Favoritos").
- **Estatísticas:** o modal tem as mesmas três abas. *Anime* mostra o tempo assistido e a divisão entre anime, filme e série; *Mangá* e *Light Novel* mostram capítulos e volumes lidos e os gêneros mais lidos.
- **Feed e compartilhar:** o feed usa "começou a ler" e "concluiu a leitura"; o cartão de compartilhar mostra o progresso de leitura.
- **Backup:** o `.json` exportado leva os novos campos, e backups antigos (de antes dos mangás) continuam entrando normalmente.

## Biblioteca: abas de status e botão Filtros

A tela da biblioteca (e o perfil de quem você visita) ficou com menos caixas e mais clareza. De cima para baixo:

- **Anime · Mangá · Light Novel:** as três abas de sempre, com o número de obras de cada uma; a última aba usada fica lembrada.
- **Abas de status:** *Todas · Assistindo · Quero ver · Concluídas · Em espera · Dropadas* (em Mangá e Light Novel, *Lendo* e *Quero ler*), cada uma com o **número de obras** e uma bolinha na cor do status. Elas **substituem os cartões de números** e continuam filtrando a lista. Os números são sempre os da aba atual, não mudam com a busca, e se atualizam sozinhos quando você muda o status de uma obra, soma um episódio ou adiciona/exclui. Teclado: setas, *Home* e *End* andam entre as abas de status.
- **Busca** (título ou tag), botão **Filtros** e o alternador **cards / lista** (lembrado neste navegador).
- **Filtros:** abre um painel com **Categoria** (Anime, Filme, Série; só aparece na aba Anime) e **Ordenar por** (Mais recentes, Título A-Z, Melhor nota, Maior progresso). Quando algo está diferente do padrão, o botão mostra um número com os ajustes ativos e o painel tem **Limpar filtros**. Se a lista ficar vazia por causa dos filtros ou da busca, o aviso "Nenhuma obra encontrada" traz o botão **Limpar filtros e busca**.
- **Favoritos:** continuam por aba, como antes: o coração em cada obra e, no perfil, a faixa **Favoritos** com rolagem lateral.
- O código está em `js/ui/libraryBrowser.js` (busca, Filtros e lista) e `js/ui/statusTabs.js` (abas de status e contagem); a biblioteca e o perfil usam o mesmo.

## Botão "Nova obra" sempre à mão

Quem está logada (ou usa o site no modo local) tem o botão **Nova obra** em todas as telas: **no computador** ele fica no topo, ao lado da sua foto (em telas até cerca de 1050 px vira só o ícone `+`, com o nome na dica e para o leitor de tela) e **no celular** ele é um botão flutuante logo acima da barra de baixo. Visitantes sem conta não veem o botão, nem quem está trocando a senha (`#/nova-senha`).

- **Na biblioteca** ele abre o formulário de sempre (na aba em que você está) e o cartão novo aparece na hora.
- **Nas outras telas** (Feed, Explorar, seu perfil, configurações...) o formulário abre na aba que você usou por último. Ao salvar, o aviso tem um atalho **Ver** para a biblioteca; se você está no seu próprio perfil, ele já mostra a obra nova. A obra é salva do mesmo jeito, com as mesmas regras (aviso de obra repetida, limites de texto, etc.): nenhum dado ou endereço mudou, e não há nada novo para rodar no Supabase.
- O botão antigo do cabeçalho da biblioteca saiu (ficaria repetido). O botão **Adicionar obra** do estado vazio continua.
- O código está em `js/ui/newWork.js` (quem abre o formulário) e `js/ui/chrome.js` (os dois botões). O botão flutuante usa o espaço logo acima da barra de baixo, mesmo com texto grande.

## Cargos e painel da equipe

O site tem quatro cargos. O cargo aparece como um selo ao lado do nome (perfil, Explorar, feed, pedidos e listas de seguidores); **membros não têm selo**.

| Cargo | Selo | O que pode |
|---|---|---|
| **Dona** | Dona | Tudo. É a única que abre e fecha os cadastros e a única que cria ou remove administradores. Só existe uma. |
| **Administração** | Admin | Tudo o que a moderação faz, mais o **aviso do site**, a **lista de palavras proibidas** e a **lista de sites permitidos**. Define quem é moderação ou membro. Não mexe na Dona nem em outra administração. |
| **Moderação** | Mod | Buscar membros, restaurar nome, bio, foto e @, **remover textos ofensivos** e **zerar foto e fundo**, **renomear**, **suspender** e reativar contas, tratar denúncias e ver o registro. Não mexe em cargos nem nas configurações do site. |
| **Membro** | — | Nível padrão. Pode **denunciar** perfis. |

**Regra de ouro:** quem age só atinge quem tem um cargo **menor** que o seu, e só concede cargos menores que o seu. Isso é conferido no banco de dados (não só nos botões da tela), e os cargos ficam numa tabela fechada: nenhum usuário consegue editar o próprio cargo, nem pelo site nem pela API.

### Definir a Dona (uma vez)

Não existe botão para isso, de propósito. No Supabase, abra **SQL Editor → New query**, troque o e-mail e rode:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict (user_id) do update set role = 'owner';
```

Recarregue o site: aparece **Painel** no menu (no celular, no menu do avatar, no canto superior direito → **Painel da equipe**).

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
- **Denúncias:** a fila de denúncias em aberto, com o motivo, o detalhe, quem denunciou e a **cópia do perfil na hora da denúncia** (veja abaixo). Dá para **resolver**, **descartar** ou **reabrir**, **zerar a foto e o fundo**, remover textos e gerenciar a pessoa ali mesmo. A equipe só vê denúncias contra quem tem cargo menor que o seu (ninguém vê denúncias contra a Dona).
- **Registro:** toda ação da equipe (quem fez, quando, em quem e o antes e depois). O registro só cresce: nem a Dona edita pelo site. Os nomes ficam gravados como texto, então continuam legíveis mesmo se a conta for excluída.
- **Site** (administração e Dona): **cadastros** (só a Dona), **aviso do site** (até 280 caracteres, aparece no topo para todo mundo), **palavras proibidas** e **sites permitidos nos textos**.

### Denunciar

Em qualquer perfil que não seja o seu aparece **Denunciar**: a pessoa escolhe o motivo (nome, bio, foto, spam ou outro) e, se quiser, escreve um detalhe de até 300 caracteres. Só a equipe vê, e a pessoa denunciada não sabe quem denunciou. Cada pessoa tem **uma denúncia aberta por perfil** (repetir não duplica) e no máximo **10 em aberto** ao mesmo tempo.

### Snapshot da denúncia e remoção de conteúdo

- **Snapshot:** quando alguém denuncia, o banco guarda junto uma **cópia do que o perfil mostrava naquele momento**: nome, @, bio, a versão da foto e do fundo e, das obras, só os textos que **quem denunciou conseguia ver** (perfil público ou seguidor aceito, aba ativa; anotações só se a pessoa deixou aparecer). No máximo 10 obras (as mexidas mais recentemente que têm análise, anotações, tags ou título digitado à mão), com os textos cortados (análise 600 caracteres, anotações 400, título 120, tags 40). No card da denúncia, **Como estava na hora da denúncia** mostra a cópia e marca **mudou depois** no que a pessoa editou desde então. Só a equipe lê. Denúncias feitas antes deste patch não têm cópia (o card avisa). **As imagens não são copiadas:** o snapshot guarda só a versão da foto e do fundo; se a imagem ainda é a mesma ela aparece, se foi trocada ou removida o card diz isso (o arquivo antigo não existe mais).
- **Remover conteúdo (campo a campo):** em **Gerenciar → Remover conteúdo** (todas as obras da pessoa) ou nos botões **Remover** ao lado de cada texto da cópia (só aquela obra), a equipe troca o texto por **[Conteúdo removido pela moderação]**: nome de exibição, bio, título digitado à mão (títulos que vieram da busca não mudam), análise, anotações; as **tags** ficam vazias. **Progresso, nota, status, favoritos, temporadas e capa não mudam**, e o texto removido **não aparece como novidade no feed**. O registro de ações guarda o antes do nome e da bio; das obras guarda só a quantidade (ou o título da obra), nunca o texto, porque as anotações são privadas. A cópia da denúncia continua guardada. Quem edita pelo painel não passa pela conferência de palavras e sites (o aviso de remoção não precisa dela).
- **Zerar foto e fundo:** um botão só (em **Gerenciar** e, desde a 1.20, entre as **ações rápidas** do card da denúncia) tira a foto de perfil e a imagem de fundo e tenta apagar os arquivos, como o **Restaurar** faz campo a campo.

### Fila de denúncias com contexto e ações rápidas

Exige a **versão 17** do banco (rode o `sql/schema.sql` de novo **antes** de subir os arquivos). A moderação só vê denúncias sobre quem tem cargo menor que o seu, como antes.

- **Contexto em cada denúncia:** logo abaixo do motivo, o card mostra a situação **atual** da conta denunciada (suspensa com prazo ou banida, **avisos ativos**, perfil e anotações **travados**), quantas denúncias a pessoa tem no total e quantas outras estão em aberto, o que **já aconteceu** com ela (avisos, suspensões, banimentos e ajustes de conteúdo, contados no Registro) e quantas denúncias **quem denunciou** já fez e quantas foram descartadas (com um selo quando a maioria foi descartada). São só informações para decidir: nada muda sozinho.
- **Ordem da fila:** o seletor **Ordem** troca entre mais recentes primeiro (padrão) e mais antigas primeiro.
- **Ações rápidas (denúncias em aberto):** a primeira, destacada, resolve o motivo da denúncia (nome → **Restaurar nome**, bio → **Limpar bio**, foto → **Zerar foto e fundo**, spam e outros → **Dar aviso**); as outras são **Dar aviso**, **Suspender** (com prazo; o padrão é 7 dias, como em **Gerenciar**), **Perfil privado** (trava o perfil), **Zerar foto e fundo** e, só para Administração e Dona, **Banir**. Cada uma abre uma janela com o que vai acontecer, o motivo (que a pessoa vê; já vem escrito com o motivo da denúncia e pode ser editado) e as opções **Marcar esta denúncia como resolvida** (ligada) e **Resolver também as outras N em aberto sobre esta pessoa** (desligada).
- **Tudo ou nada:** a ação e a resolução acontecem **na mesma chamada ao banco** (`admin_act_on_report`): se a ação falhar (por exemplo, aviso sem motivo, ou conta já suspensa), a denúncia continua aberta e nada fica pela metade. As mesmas regras de cargo valem, porque a função usa as de sempre. No 3º aviso ativo a conta é suspensa por 7 dias, como em **Gerenciar**.
- **Ligação com a denúncia:** o Registro e o histórico guardam o número da denúncia que originou cada ação ("por denúncia #12"), sem mexer nas ações feitas por **Gerenciar**.
- **Histórico de punições por conta:** **Gerenciar → Histórico de punições** lista, do mais novo para o mais antigo, avisos (e os retirados), suspensões (inclusive a automática do 3º aviso), banimentos, reativações, travas de privacidade e o que foi restaurado, removido ou renomeado, com quem fez, quando e a denúncia de origem. Só mostra o que está no Registro: ações de antes da versão 7 do banco não existem lá. Quando a conta é excluída, o histórico dela vai junto (o Registro geral guarda só o nome).
- **Registro com filtros:** a aba **Registro** ganhou **Mostrar** (Tudo, Punições, Conteúdo e perfil, Denúncias, Equipe e site) e **Pessoa** (parte de um @usuário; vale para quem agiu e para quem sofreu a ação). O registro continua se chamando `mod_log` no banco (a tabela não foi renomeada).

### Restaurar, renomear e suspender

- **Restaurar:** o nome de exibição volta para "Usuário" + 4 caracteres; a bio fica vazia; o @ vira `user_` + um código (o link antigo do perfil deixa de funcionar); a foto some; o fundo do perfil some. A pessoa pode editar de novo depois. Ao restaurar a foto, o site a esconde na hora e tenta apagar o arquivo; se o Supabase recusar, apague em **Storage → avatars** (o perfil já aparece sem foto).
- **Renomear:** troca só o nome de exibição (1 a 40 caracteres), mesmo que contenha uma palavra da lista de nomes proibidos.
- **Suspender:** o perfil some para as outras pessoas (Explorar, link do perfil, seguidores, feed) e a pessoa não consegue seguir nem denunciar, e perde os poderes de equipe enquanto durar. **Reativar** devolve tudo. Desde a versão 1.19 a suspensão tem **prazo** e a pessoa vê uma **tela própria** (veja a seção abaixo).

### Suspensão, banimento, avisos e privacidade forçada

Tudo isto fica em **Gerenciar** (Membros ou o botão de uma denúncia) e exige a **versão 16** do banco (rode o `sql/schema.sql` de novo **antes** de subir os arquivos). Cada ação só age em quem tem cargo menor que o seu e fica no **Registro**.

- **Suspensão com prazo:** escolha **1, 3, 7 ou 30 dias** (ou **sem prazo**, que dura até a equipe reativar) e escreva o motivo. Passado o prazo, a conta volta **sozinha** (o banco confere a data a cada uso; não há nada para rodar). Suspensões antigas, de antes da 1.19, continuam valendo como "sem prazo".
- **Banimento:** só **Administração e Dona** banem. Não tem prazo; só a equipe reativa (**Reativar conta**).
- **Tela de conta suspensa ou banida:** enquanto vale, a pessoa vê **só esta tela**: o motivo, o prazo ("Até 12/11/2026 às 14:30, faltam 3 dias") e, se você cadastrou, o botão **Falar com a equipe no Discord**. Ela ainda pode **baixar um backup** da biblioteca, **conferir de novo** e **sair da conta**. Quando o prazo acaba, a tela some sozinha. A tela é só a parte visível: quem barra de verdade é o banco (o perfil some, não dá para seguir, denunciar nem agir como equipe). Não há botão de excluir conta nessa tela.
- **Link do Discord:** painel → aba **Site** → **Link do Discord** (Administração e Dona). Aceita qualquer endereço `https://` (até 200 caracteres), então confira se é o seu servidor; vazio = a tela diz só "fale com a equipe do site".
- **Avisos (strikes):** **Gerenciar → Avisos → Dar um aviso** (com o motivo). Cada aviso **ativo** aparece para a pessoa num **banner no topo de todas as telas** ("Você tem 2 de 3 avisos da equipe"), que não dá para fechar e some quando a equipe **retira** os avisos. No **3º aviso ativo** a conta é **suspensa por 7 dias** e os 3 avisos viram "usados": o contador recomeça do zero depois. Não há validade automática: um aviso ativo só sai se a equipe o retirar. Conta já suspensa ou banida não recebe aviso.
- **Privacidade forçada:** **Gerenciar → Privacidade forçada** deixa o **perfil** e/ou as **anotações** sempre privados. Vale na hora (desliga o que estava ligado) e o banco desfaz qualquer tentativa de ligar de novo, até por chamada direta à API. A pessoa continua vendo o próprio conteúdo; em **Configurações → Privacidade** a opção aparece travada, com a explicação e o motivo. **Tirar a trava não liga nada sozinho**: a opção só volta a ficar com a pessoa. A trava das anotações **não** cobre as análises (elas aparecem para quem vê a lista; para tirar uma análise ofensiva use **Remover conteúdo**).
- **Onde isto mora no banco:** a trava e os avisos ficam em tabelas fechadas (`account_limits`, `strikes`), não em colunas do perfil, porque o perfil pode ser editado pela própria pessoa e lido por qualquer visitante. O gatilho `profiles_force_privacy` mantém `is_public` e `show_notes` desligados enquanto a trava existir.

### Segurança dos textos, palavras proibidas e cadastros fechados

- **Limpeza dos textos:** nome de exibição, bio, título, tags, gêneros, sinopse, anotações e análise passam por uma limpeza antes de serem salvas (no navegador e, de novo, no banco) e também antes de serem mostradas, então textos antigos aparecem limpos sem precisar apagar nada. Saem os caracteres de controle e os "invisíveis" (largura zero, setas de direção de texto, preenchimentos em branco), as letras empilhadas sem fim (no máximo 2 marcas por letra), repetições do mesmo caractere acima de 10 e espaços e linhas em branco demais. O "junta-letras" só fica entre emojis. Nome, título e tags viram uma linha só; anotações, análise, bio e sinopse mantêm as quebras de linha (no máximo uma linha em branco seguida).
- **Palavras proibidas nos textos:** a mesma lista dos nomes vale para a **bio**, o **título digitado à mão** (obra sem código de fonte), as **tags**, as **anotações** e a **análise**. Aqui a palavra precisa aparecer **inteira** (por exemplo, "ban" não pega "banana"); acento, maiúscula, número no lugar de letra (0 1 3 4 5 7 @ $) e letra repetida ("p4l4vr4", "paaalavra") não escondem a palavra. Palavras com **6 letras ou mais** também pegam a escrita separada ("p a l a v r a") ou colada em outra ("palavrazinha"). A lista **não** é enviada ao navegador: quem a vê é só a equipe, no painel. Só o que mudou é conferido (editar o progresso de uma obra antiga nunca é recusado por um texto antigo); a sinopse não é conferida porque em geral vem da fonte de busca.
- **Sites permitidos:** nesses mesmos campos (e no nome de exibição) só podem aparecer endereços de sites da lista de **sites permitidos** (aba **Site** do painel; começa com myanimelist.net, anilist.co, themoviedb.org, imdb.com e mangadex.org) e dos subdomínios deles. Conta como endereço o que começa com `http://`, `https://` ou `www.`, e nomes como `exemplo.net` ou `exemplo[.]net`; finais que também são palavras do dia a dia (`.com`, `.me`, `.to`, `.in`, `.it`, `.us`, `.de`, `.pt`, `.es`, `.co`) só contam quando seguidos de `/`, `?` ou `#` (para não recusar "muito.com certeza"). Os endereços continuam sendo só texto, nunca viram link clicável.
- **Se o banco recusar:** o aviso diz o campo ("Anotações", "Análise"...). Na importação de backup, a obra que causou o problema aparece no aviso e a importação inteira daquele lote é desfeita.
- **Nomes proibidos:** a lista vale para nomes de usuário e nomes de exibição **que contêm** a palavra (sem diferenciar maiúsculas nem acentos). Cuidado com palavras curtas: elas valem também dentro de outras palavras. Vale para contas novas e para quem editar o nome; quem já tinha um nome assim só é barrado ao tentar mudá-lo, e a equipe pode renomear.
- **Cadastros fechados:** o banco recusa qualquer conta nova, **inclusive** a criada manualmente em *Authentication → Users → Add user* do Supabase. Quem já tem conta continua entrando normalmente. A página "Criar conta" avisa antes de a pessoa preencher tudo. Para criar contas à mão, reabra os cadastros no painel.

## Status das obras

**Assistindo**, **Quero ver**, **Concluído**, **Em espera** e **Dropado**. *Em espera* é para o anime que você pausou e pretende retomar; *Dropado* é para o que você abandonou. As duas aparecem com a capa em tons de cinza e têm contador próprio no topo.

- **Trocar o status:** todo card (e cada linha, no modo lista) tem um seletor de status. Ao escolher *Concluído*, todos os episódios são marcados como vistos.
- **+1 Ep:** o botão só aparece em obras *Assistindo*. Para começar uma obra de *Quero ver*, mude o status para *Assistindo* ou marque episódios em **Temporadas**. Marcar um episódio em **Temporadas** numa obra em espera ou dropada a coloca de volta em *Assistindo*.
- **Números no topo:** cada número (Obras, Assistindo, Quero ver…) é um botão que filtra a lista pelo status correspondente. O mesmo vale no perfil de outras pessoas.
- **Capa:** clicar na capa abre os detalhes da obra, nos cards, no modo lista, no perfil de outras pessoas e **no feed** (o feed busca a sinopse na lista pública da pessoa, uma vez por pessoa enquanto a tela está aberta).
- **Cards e modo lista:** o **+1** fica logo ao lado do seletor de status, o progresso e os botões ficam sempre colados na parte de baixo do card (a folga de altura entre cards da mesma linha fica acima do progresso, nunca no meio dos controles), e no modo lista o ícone de **Detalhes** fica junto dos outros ícones de ação. O seletor de status tem largura máxima de **12rem**, então não estica em telas de DPI alto.
- **Teclado do celular:** ao **adicionar** uma obra o campo do título recebe o foco (o teclado abre); ao **editar** não (o foco vai para a própria janela).

Ao salvar uma obra como **Concluído**, todos os episódios de todas as temporadas são marcados como vistos (só quando o status *muda* para Concluído: editar uma obra que já estava concluída não mexe nos episódios).

## Notas com meia estrela

A nota vai de **0,5 a 5 estrelas, em passos de meia estrela** (ou fica sem nota). Por baixo ela é guardada como um número de 0 a 10 (cada meia estrela vale 1 ponto), por isso o banco aceita de 0 a 10.

- **No formulário da obra:** passe o mouse sobre as estrelas para ver a prévia e clique — a **metade esquerda** de uma estrela dá meia estrela, a **direita** dá a estrela inteira. No celular, toque na metade desejada. **Limpar** volta para "Sem nota".
- **Teclado:** com o campo focado, ← ↓ tiram meia estrela e → ↑ põem meia estrela; PageUp/PageDown mudam uma estrela; Home = sem nota; End = 5 estrelas. Leitores de tela anunciam "3,5 de 5 estrelas" (o campo é um controle deslizante de 0 a 10).
- **Onde aparecem:** cartões, modo lista, feed, perfis e o cartão de compartilhar (imagem e texto copiado).
- **Busca:** a nota da comunidade (AniList/MyAnimeList) vem preenchida arredondada para o ponto mais próximo (por exemplo, 93 de 100 → 9 pontos = 4,5 estrelas).
- **Ordenar por "Melhor nota"** usa os pontos (0 a 10), então 4,5 estrelas vem antes de 4.
- **Notas antigas:** na atualização, todas as notas de 1 a 5 viram o dobro (uma vez só), então nada muda na tela. No modo local o site faz essa conversão sozinho na primeira abertura, e guarda uma marca (`kamylist_rating_scale`) para não repetir.
- **Backup:** o `.json` exportado agora é um objeto `{ "app": "KamyList", "ratingScale": 10, "exportedAt": ..., "entries": [...] }`. Backups antigos (uma lista simples, ou um objeto sem `ratingScale`) continuam entrando e têm as notas dobradas na importação; um backup novo é importado como está. O mesmo vale para **Importar obras salvas neste navegador**.

## Favoritos

O coração no card fixa a obra como favorita. **Não há limite**: dá para favoritar quantas obras quiser, e cada aba (Anime, Mangá, Light Novel) mostra só os favoritos dela. No perfil, os favoritos aparecem numa seção **Favoritos** logo acima da biblioteca, inclusive para quem visita o perfil público, numa **faixa de uma linha só com rolagem lateral**: deslize com o dedo, use a barra de rolagem, Shift + roda do mouse, as setas do teclado (com a faixa selecionada) ou os botões **‹ ›** (que só aparecem quando os favoritos passam da largura da tela). No banco o campo é só um marcador; nada limita a quantidade.

## Botão voltar

O botão voltar do navegador (ou do celular) fecha o modal aberto (estatísticas, detalhes, formulário…) em vez de sair da tela. Com dois modais abertos, fecha um por vez. Fechar pelo X ou pelo Esc não deixa "entrada fantasma" no histórico.

## Obras repetidas

Ao digitar o título (ou escolher um resultado da busca), o formulário avisa se você já tem aquela obra **do mesmo tipo** (anime, filme, série, mangá ou light novel; o mesmo nome em tipos diferentes é permitido). A comparação ignora maiúsculas, acentos e pontuação, e também reconhece a mesma obra vinda de outra fonte pelo código dela (MyAnimeList, AniList ou TMDB). É só um aviso: ao salvar você escolhe *Cancelar*, *Ver a existente* ou *Adicionar mesmo assim*.

## Cartão de compartilhamento e capas

Para o cartão virar uma imagem baixável, o navegador só aceita a capa se o site dela permitir (CORS). Quando não permite, o KamyList tenta de novo com um pedido novo e, se ainda assim falhar, busca a capa por um serviço de imagens intermediário (por padrão `wsrv.nl`, gratuito e de terceiros: ele recebe o endereço da capa, nada da sua conta). Se preferir outro serviço, ou nenhum, ajuste `imageProxy` no `js/config.js`:

```js
imageProxy: 'https://wsrv.nl/?url={url}&w=560&h=840&fit=cover&output=jpg&q=85', // padrão (pode omitir a linha)
// imageProxy: '',                                                              // desliga: sem capa quando o site não libera
```

Se mesmo assim a capa não puder entrar, o cartão sai sem ela e mostra um aviso.

## Trazer a lista da versão antiga

- **Do mesmo navegador:** ao entrar pela primeira vez, a biblioteca avisa se encontrar obras salvas da versão antiga e oferece **Importar**. Também fica em **Seus dados**, na tela de configurações da conta (avatar no canto superior direito → **Configurações**).
- **De outro navegador/computador:** na versão antiga, exporte o backup; aqui use **Importar backup** e escolha **Adicionar** (mantém o que você já tem) ou **Substituir tudo**.
- **Exportar** gera um arquivo `.json` com toda a sua lista, bom para guardar uma cópia. Backups antigos entram normalmente (as notas de 1 a 5 são convertidas para a escala nova).

## Busca de séries e filmes (TMDB, opcional)

A busca de **animes** e de **mangás/light novels** funciona sem chave, com duas fontes: **AniList** (a primeira da lista e a padrão) e **MyAnimeList** (via Jikan). A fonte escolhida fica lembrada neste navegador.

- No **MyAnimeList** as sequências (2ª temporada, filmes) são buscadas quando você escolhe a obra, por isso há uma pequena espera. O Jikan limita o número de buscas por segundo; o site espaça os pedidos, tenta de novo sozinho quando o serviço pede calma ou está lento e avisa quando mesmo assim não deu. Se o MAL estiver fora do ar, troque para o AniList.

Para buscar séries e filmes:

1. Crie uma conta gratuita em <https://www.themoviedb.org/settings/api> e gere uma chave (**API Key v3**).
2. Coloque em `tmdbApiKey` no `js/config.js`.

> **Importante:** a chave do TMDB que estava no `index.html` do repositório antigo ficou pública no histórico do GitHub. Gere uma **nova** chave e apague/revogue a antiga no painel do TMDB.
> Quando a chave está ativa, o rodapé mostra a atribuição exigida pelo TMDB automaticamente.

---

## Logo e novidades do site

- **Logo:** o kanji **菫** (*sumire*, "violeta"). O contorno foi tirado da fonte Noto Sans CJK JP Bold (licença SIL Open Font License) e guardado como forma SVG, por isso aparece igual em qualquer aparelho, sem depender de fonte instalada. Está em `js/core/icons.js` (`brandKanji`, usada no topo do site) e em `favicon.svg` (ícone da aba).
- **Novidades:** o rodapé tem um botão discreto com a versão do site (`v1.22`). Ao clicar, abre a janela **Novidades do site** com o histórico de atualizações (a versão atual aberta e as anteriores recolhidas). O texto fica em `js/domain/changelog.js`: a cada atualização, acrescente um bloco **no topo** de `CHANGELOG` e troque `SITE_VERSION` pelo mesmo número.

## Como o código está organizado

```
index.html              página única (carrega CSS e js/main.js)
css/                    tokens (cores), palettes.css (combinações de cores, gerado), base, componentes, telas, profile-bg.css (fundo escolhido, no site todo) e contrast.css (alto contraste)
js/
  main.js               inicia tudo e define as rotas
  config.js             o único arquivo que você precisa editar
  core/                 DOM seguro, roteador, modal, toasts, tema, cores, alto contraste, fundo do site (siteBackground.js), ícones (inclui a logo 菫)
  domain/               regras puras: obras, temporadas, estatísticas, backup, cargos, limites de troca de foto/fundo, histórico de novidades (changelog.js)
  domain/textSafety.js  limpeza de textos, palavras proibidas e sites permitidos (as mesmas regras existem no banco)
  services/             backends (local e Supabase), sessão, busca (Jikan, AniList, TMDB)
  ui/                   componentes: cards, filtros, modais, cartão de compartilhar, avatar, menu da conta (accountMenu.js), botão Nova obra (newWork.js), abas da conta, abas Anime/Mangá/Light Novel e de status (statusTabs.js), progresso de leitura
  views/                telas: início, biblioteca, login, perfil, explorar, feed (atividade e pedidos), personalização, configurações, painel da equipe (admin.js)
tools/palettes.mjs      gera css/palettes.css e as cores de css/contrast.css e confere o contraste (node tools/palettes.mjs --check)
sql/schema.sql          tabelas, regras de segurança e funções do Supabase (pode rodar de novo a qualquer momento)
```

Os dois backends (`local-backend.js` e `supabase-backend.js`) têm a mesma interface, por isso as telas não sabem de onde os dados vêm.

## Segurança em resumo

- **Regras no banco (RLS):** cada pessoa só lê e altera as próprias obras; perfis públicos só são lidos por funções que respeitam as opções de privacidade.
- **Sem XSS:** todo texto vindo de usuários ou de APIs é escapado antes de ir para a tela; capas só aceitam `https`. Os textos também passam por uma limpeza (veja "Segurança dos textos") e endereços de sites só passam se estiverem na lista de sites permitidos; nada vira link clicável.
- **CSP:** o `index.html` só permite scripts do próprio site e do jsDelivr (onde fica a biblioteca do Supabase) e só conversa com as APIs usadas.
- **Seguir e feed:** a tabela de seguidores não pode ser lida nem escrita direto (só por funções do banco que conferem quem está com a sessão iniciada). Um perfil privado só entrega as obras a quem a pessoa dona do perfil aceitou, e o feed só devolve atividade de quem você segue com vínculo aceito. As anotações privadas nunca saem no feed.
- **Fotos e fundos:** bucket `avatars` com limite de 64 KB e bucket `backgrounds` com limite de 384 KB, os dois só WebP/JPEG; cada pessoa só envia/troca/apaga o arquivo que tem o próprio ID como nome. O site só monta o endereço da imagem com ID (UUID) e versão numérica válidos, e só aceita endereços `https`.
- **Cargos e moderação:** os cargos ficam em uma tabela fechada (ninguém lê nem escreve direto). Toda ação da equipe passa por funções do banco que conferem o cargo de quem chama, só agem em quem tem cargo menor e deixam rastro no registro. Conta suspensa perde os poderes de equipe. As denúncias e o registro também são tabelas fechadas.
- **Preferências privadas:** opções como o alto contraste ficam na tabela `user_prefs`, com RLS que só deixa a própria pessoa ler, criar e alterar a sua linha (visitantes não tocam nela, e nenhuma função pública a devolve). Ficam fora da tabela de perfis de propósito, porque a de perfis é legível por qualquer pessoa.
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
| O Explorar mostra zeros, ou "Abas visíveis no perfil" não salva | O `sql/schema.sql` da versão 8 ainda não foi executado (abas ativas do perfil e contagens por tipo) |
| Erro ao salvar uma nota com meia estrela, ou o aviso amarelo "O banco de dados precisa ser atualizado" logo depois de subir a versão 1.11 | O `sql/schema.sql` da versão 9 ainda não foi executado (rode o SQL **antes** de subir os arquivos). O contrário também acontece: com o SQL já rodado e os arquivos antigos ainda no ar, as notas aparecem como 5 estrelas (o site antigo não conhece a escala de 0 a 10) até você subir os arquivos novos |
| A chave "Alto contraste" não salva ("O banco de dados está desatualizado") | O `sql/schema.sql` da versão 10 ainda não foi executado (cria a tabela privada `user_prefs`). Sem ele o alto contraste não fica guardado na conta |
| O painel não abre ou "Denunciar" dá erro | O `sql/schema.sql` da versão 7 ainda não foi executado, ou a sua conta ainda não tem cargo (veja "Definir a Dona") |
| "Não foi possível criar a conta agora: os cadastros podem estar fechados" | A Dona fechou os cadastros (painel → Site). Vale também para *Add user* no Supabase |
| "A Dona do site não pode excluir a conta" | Passe o cargo de Dona para outra pessoa antes (veja "Passar o cargo de Dona") |
| "O armazenamento de fotos ainda não existe" ou "A foto ficou grande demais" | O `sql/schema.sql` novo não foi executado (cria o bucket `avatars` com o limite de 64 KB e, na versão 11, o `backgrounds` com 384 KB; o mesmo aviso aparece ao enviar o fundo do perfil) |
| O fundo do perfil não envia, ou a chave "Desfoque nos cards" não salva | O `sql/schema.sql` da versão 11 ainda não foi executado (cria as colunas `bg_v` e `bg_blur` e o armazenamento `backgrounds`) |
| "Gerenciar" dá erro ao dar um aviso, travar a privacidade ou suspender com prazo, ou o painel não mostra o campo do Discord | O `sql/schema.sql` da versão 16 ainda não foi executado (cria `account_limits`, `strikes` e o prazo das suspensões). Rode o SQL **antes** de subir os arquivos da 1.19 |
| A fila de denúncias não mostra o contexto (avisos, outras denúncias), as ações rápidas dão erro, o Registro não filtra ou o Histórico de punições não carrega | O `sql/schema.sql` da versão 17 ainda não foi executado (troca `admin_list_reports` e `admin_list_log` e cria `admin_act_on_report`, `admin_account_history` e `log_category`). Rode o SQL **antes** de subir os arquivos da 1.20 |
| "Espere N s para trocar a foto de novo" ou "Você já fez 10 trocas de foto e fundo nas últimas 24 horas" | É o limite de trocas funcionando (veja "Limites para trocar a foto e o fundo"). Sem a versão 12 do banco essas mensagens e os contadores não aparecem e não há limite |
| MAL mostra "Muitas buscas seguidas" ou "Serviço indisponível" | O Jikan limitou ou está lento: espere alguns segundos ou use o AniList |
| E-mail de confirmação não chega | Veja o spam; o plano gratuito limita e-mails por hora. Para grupos pequenos, desligue **Confirm email** |
| Link do e-mail leva a uma página errada | **Site URL** / **Redirect URLs** não batem com o endereço do GitHub Pages |
| Busca de séries/filmes desativada | Falta a `tmdbApiKey` no `js/config.js` |
| Tela em branco abrindo o arquivo direto | Use um servidor local (veja "Testar no computador") |

---

Dados das obras: [MyAnimeList](https://myanimelist.net) via [Jikan](https://jikan.moe), [AniList](https://anilist.co) e [TMDB](https://www.themoviedb.org). Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
