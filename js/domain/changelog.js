// Histórico de novidades do site (aparece no botão de versão do rodapé).
// Para cada atualização nova: acrescente um bloco NO TOPO da lista e troque SITE_VERSION pelo mesmo número.
// Escreva para a comunidade: frases curtas, sem termos técnicos.
export const SITE_VERSION = '1.8';

export const CHANGELOG = [
    {
        version: '1.8',
        title: 'Formulário, Personalização e foto de perfil',
        items: [
            'Ao adicionar ou editar uma obra, a análise e as anotações agora têm janelas próprias: o formulário fica mais curto e você escreve com mais espaço. O texto vale na hora, então fechar a janela não perde nada.',
            'Foto de perfil com recorte circular: ao escolher a imagem, você arrasta, amplia e enquadra dentro de um círculo (também funciona com os dedos e com o teclado) antes de enviar.',
            'Personalização reorganizada: a foto e os dados do perfil ficam no mesmo painel, e as cores ocupam a largura toda logo abaixo, sem espaço vazio no computador.',
        ],
    },
    {
        version: '1.7',
        title: 'Correções e acabamento',
        items: [
            'Nova logo: o kanji 菫 (sumire, "violeta").',
            'Cards mais certinhos: o +1 agora fica ao lado do seletor de status e o rodapé do card não deixa mais um buraco quando a obra não está em "Assistindo".',
            'Modo lista: o botão +1 fica ao lado do status e o ícone de detalhes se junta aos outros ícones.',
            'O seletor de status não estica mais em celulares de tela muito nítida.',
            'Ao editar uma obra o teclado do celular não abre sozinho (ele só abre ao adicionar).',
            'No feed, clicar na capa abre os detalhes da obra.',
            'As etiquetas de status e categoria agora mudam de cor conforme o tema escolhido, para não se confundirem com o fundo da página.',
            'Painel da equipe: as abas não quebram mais as palavras ao meio quando o zoom do navegador é grande.',
            'Novo botão de versão no rodapé, com o histórico de novidades (é esta janela).',
        ],
    },
    {
        version: '1.6',
        title: 'Cargos e painel da equipe',
        items: [
            'Cargos Dona, Administração e Moderação, com selo ao lado do nome.',
            'Denúncias de perfis, com fila para a equipe resolver.',
            'Painel da equipe com membros, denúncias, registro de ações e configurações do site.',
            'Aviso do site no topo, nomes proibidos e opção de fechar os cadastros.',
        ],
    },
    {
        version: '1.5',
        title: 'Mangás e light novels',
        items: [
            'Nova aba "Ler", com mangás, manhwas, manhuas e light novels.',
            'Progresso por capítulos e volumes, com o botão +1 Cap.',
            'Busca no AniList e no MyAnimeList (via Jikan).',
            'Estatísticas, feed e cartão de compartilhar também entendem a leitura.',
        ],
    },
    {
        version: '1.4',
        title: 'Cores, ajustes e mais controle',
        items: [
            'Cores do perfil: oito combinações, com contraste conferido, que valem para o site todo e para o perfil que você visita.',
            'Seletor de status em cada card e em cada linha do modo lista.',
            'O +1 Ep só aparece em obras "Assistindo".',
            'Os números do topo (Obras, Assistindo, Quero ver...) filtram a lista.',
            'Clicar na capa abre os detalhes da obra.',
            'O botão voltar do celular fecha as janelas em vez de sair da página.',
        ],
    },
    {
        version: '1.3',
        title: 'Seguir pessoas, feed e análises',
        items: [
            'Seguir pessoas, com pedidos para quem tem perfil privado.',
            'Feed com o que as pessoas que você segue adicionam, concluem ou analisam.',
            'Análises das obras, com opção de esconder spoilers.',
        ],
    },
    {
        version: '1.2',
        title: 'Foto de perfil e configurações',
        items: [
            'Foto de perfil, reduzida automaticamente antes de enviar.',
            'Configurações separadas em "Personalização" e "Configurações".',
        ],
    },
    {
        version: '1.1',
        title: 'Status, favoritos e compartilhar',
        items: [
            'Marcar uma obra como "Concluído" completa todos os episódios.',
            'Aviso quando a obra que você vai adicionar já está na sua lista.',
            'Favoritos fixados no perfil (o coração do card).',
            'Status "Em espera" e "Dropado".',
            'Cartão de compartilhamento da obra.',
        ],
    },
];
