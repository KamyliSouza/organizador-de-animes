// Presets de cores do perfil. As cores em si ficam em css/palettes.css (gerado por tools/palettes.mjs,
// que também confere o contraste). Aqui só a lista: id, nome e uma descrição curta.
export const DEFAULT_PALETTE = 'default';

export const PALETTES = [
    { id: 'default', name: 'Ameixa', description: 'Roxo suave. É o visual padrão.' },
    { id: 'oceano', name: 'Oceano', description: 'Azul-petróleo, calmo e fresco.' },
    { id: 'floresta', name: 'Floresta', description: 'Verde profundo.' },
    { id: 'por-do-sol', name: 'Pôr do sol', description: 'Laranja queimado, quente.' },
    { id: 'cereja', name: 'Cereja', description: 'Vermelho-rosado.' },
    { id: 'indigo', name: 'Índigo', description: 'Azul-violeta.' },
    { id: 'grafite', name: 'Grafite', description: 'Cinza neutro, discreto.' },
    { id: 'alto-contraste', name: 'Alto contraste', description: 'Preto e branco no claro; preto e amarelo no escuro. Contraste máximo.' },
];

/** Devolve o id se ele for um preset conhecido; senão, o padrão. */
export const paletteId = (value) => (PALETTES.some((p) => p.id === value) ? value : DEFAULT_PALETTE);
