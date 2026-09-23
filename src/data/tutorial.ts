// Tutorial = the opening quest chain (GDD §8). It only listens to the same semantic events as the rest of the game.
import type { GameEvents } from '../core/events';
import { state, type Resources } from '../core/state';

export type Speaker = 'vesper' | 'boris' | 'hematico' | 'davi' | 'lia' | 'rubelia' | 'aureliano';
export const SPEAKERS: Record<Speaker, string> = {
  vesper: 'Conde Vesper', boris: 'Bóris Ossário', hematico: 'Dr. Hemático', davi: 'Davi 17-B', lia: 'Lia 04-A',
  rubelia: 'Lady Rubélia', aureliano: 'Sir Aureliano',
};

// Short names as they appear in toasts ("Bóris: ...") so the HUD can attach the portrait.
export const SHORT: Record<Speaker, string> = {
  vesper: 'Vesper', boris: 'Bóris', hematico: 'Hemático', davi: 'Davi', lia: 'Lia', rubelia: 'Rubélia', aureliano: 'Aureliano',
};

export interface Line { who: Speaker; text: string }
type EventName = keyof GameEvents;

export interface Objective {
  text: string;
  events: EventName[];
  count?: number;
  match?: (payload: any) => boolean;
}

export interface Step {
  id: string;
  lines: Line[];
  objective?: Objective;
  target?: { slot?: string; pen?: string };  // what the adaptive hint points at
  hint?: Line;                                // said after 12 s without progress
  reward?: Partial<Resources>;
  done?: Line[];                              // said when the objective completes
  // Objective already true (e.g. built earlier, or restored from an old save): the step completes by itself.
  satisfied?: () => boolean;
}

// Typed helper: the match function sees the payload of the (first) event it listens to.
const obj = <E extends EventName>(o: { text: string; event: E | E[]; count?: number; match?: (p: GameEvents[E]) => boolean }): Objective =>
  ({ text: o.text, events: Array.isArray(o.event) ? o.event : [o.event], count: o.count, match: o.match as (p: any) => boolean });

export const TUTORIAL: Step[] = [
  {
    id: 't0_heranca',
    lines: [
      { who: 'vesper', text: 'Ah. Finalmente. O novo administrador.' },
      { who: 'vesper', text: 'A boa notícia: a propriedade é sua. A má notícia: tudo dentro dela também.' },
      { who: 'boris', text: 'Inventário inicial: dois alojamentos deteriorados, oito humanos, uma horta e quatro reclamações por escrito.' },
      { who: 'davi', text: 'Cinco.' },
      { who: 'boris', text: 'Cinco reclamações por escrito.' },
      { who: 'vesper', text: 'Comecemos pelo luxo extravagante conhecido como teto.' },
    ],
  },
  {
    id: 't1_teto',
    lines: [
      { who: 'boris', text: 'Habitações aumentam a capacidade. Humanos aparentemente preferem não dormir na lama.' },
      { who: 'davi', text: 'Descoberta científica do século.' },
      { who: 'boris', text: 'Ignore o sarcasmo. Ele ainda não é tributável.' },
      { who: 'vesper', text: 'Toque num lote vazio e construa uma habitação. Uma basta. Não queremos criar expectativas.' },
    ],
    objective: obj({ text: 'Construa uma Habitação', event: 'BUILDING_BUILT', match: p => p.kind === 'housing' }),
    target: { slot: 'house_c' },
    satisfied: () => ['house_c', 'house_d'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'boris', text: 'O lote demarcado com estacas, perto das casas. Toque nele.' },
    reward: { gold: 150 },
    done: [{ who: 'boris', text: 'Excelente. Agora parece intencional. O castelo mandou 150 de Ouro pela iniciativa.' }],
  },
  {
    id: 't2_comida',
    lines: [
      { who: 'vesper', text: 'Humanos alimentados recuperam vitalidade mais rápido. Humanos famintos produzem outra coisa: reuniões.' },
      { who: 'davi', text: 'Chamamos de organização.' },
      { who: 'boris', text: 'Registrei como "anomalia operacional". Construa ou melhore uma área de Alimentação.' },
    ],
    objective: obj({ text: 'Construa ou melhore uma Alimentação', event: ['BUILDING_BUILT', 'BUILDING_UPGRADED'], match: p => p.kind === 'food' }),
    target: { slot: 'food' },
    satisfied: () => (state.buildings.food?.level ?? 0) > 0 || (state.buildings.food_b?.level ?? 0) > 1,
    hint: { who: 'boris', text: 'O lote perto dos cercados serve. Ou toque na mesa atual para melhorá-la.' },
    reward: { food: 20 },
    done: [{ who: 'lia', text: 'Mesa nova! Ninguém vai reclamar hoje. Bom, quase ninguém.' }],
  },
  {
    id: 't3_horta',
    lines: [
      { who: 'lia', text: 'Comida não nasce no refeitório. Quer dizer, nasce, mas antes passa pela horta.' },
      { who: 'boris', text: 'Toque no segundo cercado e escolha o que plantar. Os humanos cuidam do resto. Voluntariamente, dizem os formulários.' },
    ],
    objective: obj({ text: 'Plante algo na segunda horta', event: 'CROP_PLANTED', match: p => p.plotId === 'pen_b' }),
    target: { pen: 'pen_b' },
    satisfied: () => !!state.plots.pen_b,
    hint: { who: 'lia', text: 'É o cercado de baixo, o vazio. Nabo cresce rápido, se estiver com pressa.' },
    reward: { food: 15 },
  },
  {
    id: 't4_coleta',
    lines: [
      { who: 'hematico', text: 'Permita-me apresentar a maravilhosa ciência da hemoprodução sustentável!' },
      { who: 'hematico', text: 'Retiramos pouco, esperamos recuperar, retiramos de novo. Elegante. Circular. Quase ecológico.' },
      { who: 'davi', text: 'A palavra "quase" está trabalhando muito nessa frase.' },
      { who: 'hematico', text: 'Humanos saudáveis entram na fila do Posto de Coleta sozinhos. Observe três coletas.' },
    ],
    objective: obj({ text: 'Acompanhe 3 coletas de Sangue', event: 'BLOOD_COLLECTED', count: 3 }),
    target: { slot: 'collect' },
    hint: { who: 'hematico', text: 'A fila fica ao lado dos tanques, a nordeste. Humanos cansados ou famintos não coletam bem.' },
    reward: { gold: 150 },
  },
  {
    id: 't5_ficha',
    lines: [
      { who: 'rubelia', text: 'Perdão pela interrupção. Disseram que sua nova remessa já sabe ficar em fila. Promissor.' },
      { who: 'vesper', text: 'Lady Rubélia compra para a alta sociedade. Ela sente um erro de classificação a três bairros de distância.' },
      { who: 'rubelia', text: 'Toque em um humano. Quero ver o que você anda criando aqui.' },
    ],
    objective: obj({ text: 'Toque em um humano para ver a ficha', event: 'HUMAN_INSPECTED' }),
    hint: { who: 'rubelia', text: 'Qualquer um serve. Os pequenos que andam por aí. Eles não mordem. Nós mordemos.' },
  },
  {
    id: 't6_pedido',
    lines: [
      { who: 'rubelia', text: 'Perfil sanguíneo, qualidade, temperamento. Tudo que importa numa boa recepção.' },
      { who: 'rubelia', text: 'Tenho um pedido para você. Abra o pergaminho de contratos, no alto da tela.' },
      { who: 'davi', text: '"Recepção" é uma palavra muito otimista.' },
    ],
    objective: obj({ text: 'Aceite o contrato da Lady Rubélia', event: 'CONTRACT_ACCEPTED' }),
    satisfied: () => !!state.contracts.active || state.contracts.done.length > 0,
    hint: { who: 'rubelia', text: 'O pergaminho com selo vermelho, ao lado dos seus números. Não me faça esperar.' },
  },
  {
    id: 't7_patio',
    lines: [
      { who: 'boris', text: 'Entregas saem pelo Pátio de Embarque. Nós ainda não temos um. Detalhe administrativo.' },
      { who: 'boris', text: 'Construa o Pátio. O castelo adiantou o Ouro da coleta para isso.' },
    ],
    objective: obj({ text: 'Construa o Pátio de Embarque', event: 'BUILDING_BUILT', match: p => p.kind === 'boarding' }),
    target: { slot: 'boarding' },
    satisfied: () => ['boarding'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'boris', text: 'O lote grande ao sul da praça, perto da torre.' },
  },
  {
    id: 't8_entrega',
    lines: [
      { who: 'rubelia', text: 'Agora escolha. Dois Rubra, bem alimentados, moral acima de 50. Toque neles e envie ao Pátio.' },
      { who: 'davi', text: 'E se eles levarem a gente?' },
      { who: 'boris', text: 'Chamaremos de venda. É a parte do negócio que paga os colchões.' },
    ],
    objective: obj({ text: 'Entregue o contrato da Rubélia', event: 'CONTRACT_COMPLETED' }),
    satisfied: () => state.contracts.done.length > 0,
    target: { slot: 'boarding' },
    hint: { who: 'boris', text: 'Na ficha de cada humano aparece se ele atende ao pedido. Rubra, moral acima de 50.' },
  },
  {
    id: 't5_dizimo',
    lines: [
      { who: 'vesper', text: 'Agora a parte que me interessa. Ao fim de cada noite, a carruagem do castelo vem buscar o Dízimo.' },
      { who: 'vesper', text: 'Se o Sangue bastar, o castelo paga em Ouro. Se não bastar, leva humanos. Aleatoriamente. Somos justos assim.' },
      { who: 'davi', text: 'Aprecio a consistência.' },
      { who: 'vesper', text: 'Três noites sem pagar e a propriedade volta para mim. Com você dentro, se possível.' },
    ],
    objective: obj({ text: 'Pague o Dízimo desta noite', event: 'TITHE_PAID' }),
    reward: { prestige: 5 },
    done: [
      { who: 'vesper', text: 'A propriedade continua de pé. Isso já nos coloca acima do gerente anterior.' },
      { who: 'boris', text: 'Relatório: zero estruturas perdidas, um humano pedindo aumento.' },
      { who: 'davi', text: 'Eu pedi colchão.' },
      { who: 'boris', text: 'Classifiquei como aumento.' },
    ],
  },
  {
    id: 't10_familia',
    lines: [
      { who: 'lia', text: 'Posso dar uma ideia? Gente vendida, gente levada… a fazenda vai esvaziar.' },
      { who: 'lia', text: 'Casais daqui podem mandar buscar parentes. Adultos, com carta e mala. Só precisamos de uma Casa das Famílias.' },
      { who: 'boris', text: 'E o parente herda o sangue dos dois. Pares bem escolhidos, parentes melhores. Anotei como "planejamento de estoque".' },
      { who: 'davi', text: 'O romantismo desta fazenda me comove.' },
    ],
    objective: obj({ text: 'Construa a Casa das Famílias', event: 'BUILDING_BUILT', match: p => p.kind === 'family' }),
    target: { slot: 'family' },
    satisfied: () => ['family'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'lia', text: 'O lote ao lado da torre de vigia, no sudeste.' },
    done: [
      { who: 'lia', text: 'Pronto! Casais se formam sozinhos quando convivem. Ou toque num humano e escolha um par, se quiser caprichar na herança.' },
    ],
  },
  {
    id: 't11_laboratorio',
    lines: [
      { who: 'hematico', text: 'Agora que possuímos recursos, podemos desperdiçá-los com método!' },
      { who: 'hematico', text: 'Construa um Laboratório. Eu cuido do resto. Dos incêndios também, dentro do possível.' },
    ],
    objective: obj({ text: 'Construa o Laboratório', event: 'BUILDING_BUILT', match: p => p.kind === 'lab' }),
    target: { slot: 'lab' },
    satisfied: () => ['lab'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'hematico', text: 'O lote a leste, perto dos tanques. Toque nele!' },
    reward: { essence: 30 },
    done: [
      { who: 'hematico', text: 'O Laboratório destila Essência de cada coleta de Sangue. O Sangue continua todo seu; a Essência é minha. Nossa. Minha.' },
    ],
  },
  {
    id: 't12_pesquisa',
    lines: [
      { who: 'hematico', text: 'Minha árvore de pesquisas! Quatro ramos: Sangue, Rebanho, Defesa e Castelo. Cada nó tem níveis e é comprado na hora, com Essência.' },
      { who: 'hematico', text: 'Comece por Ração Nutritiva, no ramo Rebanho. Humanos saudáveis recuperam sangue mais rápido.' },
      { who: 'boris', text: 'A proposta foi aprovada pelo departamento responsável.' },
      { who: 'vesper', text: 'Qual departamento?' },
      { who: 'boris', text: 'Eu.' },
    ],
    objective: obj({ text: 'Pesquise Ração Nutritiva na árvore', event: 'RESEARCH_STARTED', match: p => p.nodeId === 'r1' }),
    satisfied: () => (state.research.lv.r1 ?? 0) > 0,
    target: { slot: 'lab' },
    hint: { who: 'hematico', text: 'Toque no frasco no alto da tela (ou no Laboratório → Pesquisas). Ração Nutritiva fica logo acima do centro.' },
  },
  {
    id: 't13_lobisomens',
    lines: [
      { who: 'aureliano', text: 'Lobisomens.' },
      { who: 'vesper', text: 'Eles chamam de caça.' },
      { who: 'aureliano', text: 'Nós chamamos de invasão.' },
      { who: 'boris', text: 'O jurídico chama de "fora do horário comercial".' },
      { who: 'davi', text: 'Talvez eles tenham um plano de saúde melhor.' },
      { who: 'aureliano', text: 'Toque no alerta vermelho. Coloque Cálices para gerar Sangue, Sentinelas para atirar e Muralhas para segurar. Proteja a cerca!' },
    ],
    objective: obj({ text: 'Defenda a fazenda do ataque', event: 'RAID_ENDED' }),
    hint: { who: 'aureliano', text: 'O alerta vermelho à direita, abaixo do HUD. Toque em "Defender".' },
    done: [
      { who: 'aureliano', text: 'A cerca continua de pé. Na próxima lua cheia eles voltam, e em maior número.' },
      { who: 'hematico', text: 'Pesquisas de Defesa liberam Gárgulas, Alquimistas e uma nuvem de morcegos muito, muito entusiasmada.' },
    ],
  },
];
