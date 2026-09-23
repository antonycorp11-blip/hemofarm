// Tutorial = the opening quest chain (GDD §8). It only listens to the same semantic events as the rest of the game.
import type { GameEvents } from '../core/events';
import { state, type Resources } from '../core/state';
import { L } from '../core/i18n';

export type Speaker = 'vesper' | 'boris' | 'hematico' | 'davi' | 'lia' | 'rubelia' | 'aureliano' | 'merchant' | 'inspector' | 'ulf' | 'leonor';
export const SPEAKERS: Record<Speaker, string> = {
  vesper: L('Conde Vesper', 'Count Vesper'), boris: L('Bóris Ossário', 'Boris Ossuary'), hematico: L('Dr. Hemático', 'Dr. Hematic'),
  davi: 'Davi 17-B', lia: 'Lia 04-A', rubelia: L('Lady Rubélia', 'Lady Rubelia'), aureliano: 'Sir Aureliano',
  merchant: L('Mercador de Sangue', 'Blood Merchant'), inspector: L('Fiscal da Casa Rubra', 'Inspector of House Rubra'),
  ulf: L('Ulf Quebra-Cerca', 'Ulf Fencebreaker'), leonor: L('Tia Leonor', 'Aunt Leonor'),
};

// Short names as they appear in toasts ("Bóris: ...") so the HUD can attach the portrait.
export const SHORT: Record<Speaker, string> = {
  vesper: 'Vesper', boris: L('Bóris', 'Boris'), hematico: L('Hemático', 'Hematic'), davi: 'Davi', lia: 'Lia', rubelia: L('Rubélia', 'Rubelia'),
  aureliano: 'Aureliano', merchant: L('Mercador', 'Merchant'), inspector: L('Fiscal', 'Inspector'), ulf: 'Ulf', leonor: 'Leonor',
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
      { who: 'vesper', text: L('Ah. Finalmente. O novo administrador.', 'Ah. At last. The new administrator.') },
      { who: 'vesper', text: L('A boa notícia: a propriedade é sua. A má notícia: tudo dentro dela também.', 'The good news: the property is yours. The bad news: so is everything in it.') },
      { who: 'vesper', text: L('Sua tia? Partiu numa viagem longa. Muito longa. Não pergunte.', 'Your aunt? She left on a long trip. A very long one. Don\'t ask.') },
      { who: 'boris', text: L('Inventário inicial: dois alojamentos deteriorados, oito humanos, uma horta e quatro reclamações por escrito.', 'Starting inventory: two rundown bunkhouses, eight humans, one garden and four written complaints.') },
      { who: 'davi', text: L('Cinco.', 'Five.') },
      { who: 'boris', text: L('Cinco reclamações por escrito. E um caderno da antiga administradora, com páginas arrancadas.', 'Five written complaints. And a notebook from the previous administrator, with pages torn out.') },
      { who: 'vesper', text: L('Comecemos pelo luxo extravagante conhecido como teto.', 'Let us begin with the extravagant luxury known as a roof.') },
    ],
  },
  {
    id: 't1_teto',
    lines: [
      { who: 'boris', text: L('Habitações aumentam a capacidade. Humanos aparentemente preferem não dormir na lama.', 'Housing raises capacity. Humans apparently prefer not to sleep in the mud.') },
      { who: 'davi', text: L('Descoberta científica do século.', 'Scientific breakthrough of the century.') },
      { who: 'boris', text: L('Ignore o sarcasmo. Ele ainda não é tributável.', 'Ignore the sarcasm. It isn\'t taxable yet.') },
      { who: 'vesper', text: L('Toque num lote vazio e construa uma habitação. Uma basta. Não queremos criar expectativas.', 'Tap an empty lot and build a house. One will do. We don\'t want to raise expectations.') },
    ],
    objective: obj({ text: L('Construa uma Habitação', 'Build a House'), event: 'BUILDING_BUILT', match: p => p.kind === 'housing' }),
    target: { slot: 'house_c' },
    satisfied: () => ['house_c', 'house_d'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'boris', text: L('O lote demarcado com estacas, perto das casas. Toque nele.', 'The lot marked with stakes, near the houses. Tap it.') },
    reward: { gold: 150 },
    done: [{ who: 'boris', text: L('Excelente. Agora parece intencional. O castelo mandou 150 de Ouro pela iniciativa.', 'Excellent. Now it looks intentional. The castle sent 150 Gold for the initiative.') }],
  },
  {
    id: 't2_comida',
    lines: [
      { who: 'vesper', text: L('Humanos alimentados recuperam vitalidade mais rápido. Humanos famintos produzem outra coisa: reuniões.', 'Fed humans recover vitality faster. Hungry humans produce something else: meetings.') },
      { who: 'davi', text: L('Chamamos de organização.', 'We call it organizing.') },
      { who: 'boris', text: L('Registrei como "anomalia operacional". Construa ou melhore uma área de Alimentação.', 'I filed it as an "operational anomaly". Build or upgrade a Dining area.') },
    ],
    objective: obj({ text: L('Construa ou melhore uma Alimentação', 'Build or upgrade a Dining area'), event: ['BUILDING_BUILT', 'BUILDING_UPGRADED'], match: p => p.kind === 'food' }),
    target: { slot: 'food' },
    satisfied: () => (state.buildings.food?.level ?? 0) > 0 || (state.buildings.food_b?.level ?? 0) > 1,
    hint: { who: 'boris', text: L('O lote perto dos cercados serve. Ou toque na mesa atual para melhorá-la.', 'The lot near the pens will do. Or tap the current table to upgrade it.') },
    reward: { food: 20 },
    done: [{ who: 'lia', text: L('Mesa nova! Ninguém vai reclamar hoje. Bom, quase ninguém.', 'A new table! Nobody will complain today. Well, almost nobody.') }],
  },
  {
    id: 't3_horta',
    lines: [
      { who: 'lia', text: L('Comida não nasce no refeitório. Quer dizer, nasce, mas antes passa pela horta.', 'Food isn\'t born in the dining hall. I mean, it is, but it goes through the garden first.') },
      { who: 'boris', text: L('Toque no segundo cercado e escolha o que plantar. Os humanos cuidam do resto. Voluntariamente, dizem os formulários.', 'Tap the second pen and choose what to plant. The humans handle the rest. Voluntarily, say the forms.') },
    ],
    objective: obj({ text: L('Plante algo na segunda horta', 'Plant something in the second garden'), event: 'CROP_PLANTED', match: p => p.plotId === 'pen_b' }),
    target: { pen: 'pen_b' },
    satisfied: () => !!state.plots.pen_b,
    hint: { who: 'lia', text: L('É o cercado de baixo, o vazio. Nabo cresce rápido, se estiver com pressa.', 'It\'s the lower pen, the empty one. Turnips grow fast, if you\'re in a hurry.') },
    reward: { food: 15 },
  },
  {
    id: 't4_coleta',
    lines: [
      { who: 'hematico', text: L('Permita-me apresentar a maravilhosa ciência da hemoprodução sustentável!', 'Allow me to present the marvelous science of sustainable hemoproduction!') },
      { who: 'hematico', text: L('Retiramos pouco, esperamos recuperar, retiramos de novo. Elegante. Circular. Quase ecológico.', 'We take a little, wait for recovery, take again. Elegant. Circular. Almost ecological.') },
      { who: 'davi', text: L('A palavra "quase" está trabalhando muito nessa frase.', 'The word "almost" is working very hard in that sentence.') },
      { who: 'hematico', text: L('Humanos saudáveis entram na fila do Posto de Coleta sozinhos. Observe três coletas.', 'Healthy humans join the Collection Post line on their own. Watch three collections.') },
    ],
    objective: obj({ text: L('Acompanhe 3 coletas de Sangue', 'Watch 3 Blood collections'), event: 'BLOOD_COLLECTED', count: 3 }),
    target: { slot: 'collect' },
    hint: { who: 'hematico', text: L('A fila fica ao lado dos tanques, a nordeste. Humanos cansados ou famintos não coletam bem.', 'The line is next to the tanks, to the northeast. Tired or hungry humans don\'t give well.') },
    reward: { gold: 150 },
  },
  {
    id: 't5_ficha',
    lines: [
      { who: 'rubelia', text: L('Perdão pela interrupção. Disseram que sua nova remessa já sabe ficar em fila. Promissor.', 'Pardon the interruption. I hear your new batch already knows how to queue. Promising.') },
      { who: 'vesper', text: L('Lady Rubélia compra para a alta sociedade. Ela sente um erro de classificação a três bairros de distância.', 'Lady Rubelia buys for high society. She can smell a grading error three districts away.') },
      { who: 'rubelia', text: L('Toque em um humano. Quero ver o que você anda criando aqui.', 'Tap a human. I want to see what you\'ve been raising here.') },
    ],
    objective: obj({ text: L('Toque em um humano para ver a ficha', 'Tap a human to see their record'), event: 'HUMAN_INSPECTED' }),
    hint: { who: 'rubelia', text: L('Qualquer um serve. Os pequenos que andam por aí. Eles não mordem. Nós mordemos.', 'Any of them. The little ones walking around. They don\'t bite. We do.') },
  },
  {
    id: 't6_pedido',
    lines: [
      { who: 'rubelia', text: L('Perfil sanguíneo, qualidade, temperamento. Tudo que importa numa boa recepção.', 'Blood profile, quality, temperament. Everything that matters at a good reception.') },
      { who: 'rubelia', text: L('Tenho um pedido para você. Abra o pergaminho de contratos, no alto da tela.', 'I have an order for you. Open the contract scroll at the top of the screen.') },
      { who: 'davi', text: L('"Recepção" é uma palavra muito otimista.', '"Reception" is a very optimistic word.') },
    ],
    objective: obj({ text: L('Aceite o contrato da Lady Rubélia', 'Accept Lady Rubelia\'s contract'), event: 'CONTRACT_ACCEPTED' }),
    satisfied: () => !!state.contracts.active || state.contracts.done.length > 0,
    hint: { who: 'rubelia', text: L('O pergaminho com selo vermelho, ao lado dos seus números. Não me faça esperar.', 'The scroll with the red seal, next to your numbers. Don\'t keep me waiting.') },
  },
  {
    id: 't7_patio',
    lines: [
      { who: 'boris', text: L('Entregas saem pelo Pátio de Embarque. Nós ainda não temos um. Detalhe administrativo.', 'Deliveries leave from the Boarding Yard. We don\'t have one yet. Administrative detail.') },
      { who: 'boris', text: L('Construa o Pátio. O castelo adiantou o Ouro da coleta para isso.', 'Build the Yard. The castle advanced the collection Gold for it.') },
    ],
    objective: obj({ text: L('Construa o Pátio de Embarque', 'Build the Boarding Yard'), event: 'BUILDING_BUILT', match: p => p.kind === 'boarding' }),
    target: { slot: 'boarding' },
    satisfied: () => ['boarding'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'boris', text: L('O lote grande ao sul da praça, perto da torre.', 'The big lot south of the square, near the tower.') },
  },
  {
    id: 't8_entrega',
    lines: [
      { who: 'rubelia', text: L('Agora escolha. Dois Rubra, bem alimentados, moral acima de 50. Toque neles e envie ao Pátio.', 'Now choose. Two Rubra, well fed, morale above 50. Tap them and send them to the Yard.') },
      { who: 'davi', text: L('E se eles levarem a gente?', 'And what if they take us?') },
      { who: 'boris', text: L('Chamaremos de venda. É a parte do negócio que paga os colchões.', 'We\'ll call it a sale. It\'s the part of the business that pays for the mattresses.') },
    ],
    objective: obj({ text: L('Entregue o contrato da Rubélia', 'Deliver Rubelia\'s contract'), event: 'CONTRACT_COMPLETED' }),
    satisfied: () => state.contracts.done.length > 0,
    target: { slot: 'boarding' },
    hint: { who: 'boris', text: L('Na ficha de cada humano aparece se ele atende ao pedido. Rubra, moral acima de 50.', 'Each human\'s record shows whether they fit the order. Rubra, morale above 50.') },
  },
  {
    id: 't5_dizimo',
    lines: [
      { who: 'vesper', text: L('Agora a parte que me interessa. Ao fim de cada noite, a carruagem do castelo vem buscar a Sangria.', 'Now the part I care about. At the end of every night, the castle carriage comes for the Bloodletting.') },
      { who: 'vesper', text: L('Se o Sangue bastar, o castelo paga em Ouro. Se não bastar, leva humanos. Aleatoriamente. Somos justos assim.', 'If there\'s enough Blood, the castle pays in Gold. If not, it takes humans. At random. We\'re fair like that.') },
      { who: 'davi', text: L('Aprecio a consistência.', 'I appreciate the consistency.') },
      { who: 'vesper', text: L('Três noites sem pagar e a propriedade volta para mim. Com você dentro, se possível.', 'Three nights unpaid and the property returns to me. With you inside, if possible.') },
    ],
    objective: obj({ text: L('Pague a Sangria desta noite', 'Pay tonight\'s Bloodletting'), event: 'TITHE_PAID' }),
    reward: { prestige: 5 },
    done: [
      { who: 'vesper', text: L('A propriedade continua de pé. Isso já nos coloca acima da gerente anterior.', 'The property is still standing. That already puts us ahead of the previous manager.') },
      { who: 'boris', text: L('Relatório: zero estruturas perdidas, um humano pedindo aumento.', 'Report: zero structures lost, one human asking for a raise.') },
      { who: 'davi', text: L('Eu pedi colchão.', 'I asked for a mattress.') },
      { who: 'boris', text: L('Classifiquei como aumento.', 'I classified it as a raise.') },
    ],
  },
  {
    id: 't10_familia',
    lines: [
      { who: 'lia', text: L('Posso dar uma ideia? Gente vendida, gente levada… a fazenda vai esvaziar.', 'Can I suggest something? People sold, people taken… the farm will empty out.') },
      { who: 'lia', text: L('Casais daqui podem mandar buscar parentes. Adultos, com carta e mala. Só precisamos de uma Casa das Famílias.', 'Couples here can send for relatives. Adults, with a letter and a suitcase. We just need a Family House.') },
      { who: 'boris', text: L('E o parente herda o sangue dos dois. Pares bem escolhidos, parentes melhores. Anotei como "planejamento de estoque".', 'And the relative inherits both their blood. Well-chosen pairs, better relatives. I noted it as "stock planning".') },
      { who: 'davi', text: L('O romantismo desta fazenda me comove.', 'The romance on this farm moves me.') },
    ],
    objective: obj({ text: L('Construa a Casa das Famílias', 'Build the Family House'), event: 'BUILDING_BUILT', match: p => p.kind === 'family' }),
    target: { slot: 'family' },
    satisfied: () => ['family'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'lia', text: L('O lote ao lado da torre de vigia, no sudeste.', 'The lot next to the watchtower, to the southeast.') },
    done: [
      { who: 'lia', text: L('Pronto! Casais se formam sozinhos quando convivem. Ou toque num humano e escolha um par, se quiser caprichar na herança.', 'Done! Couples form on their own when they spend time together. Or tap a human and pick a partner, if you want to shape the inheritance.') },
    ],
  },
  {
    id: 't11_laboratorio',
    lines: [
      { who: 'hematico', text: L('Agora que possuímos recursos, podemos desperdiçá-los com método!', 'Now that we have resources, we can waste them methodically!') },
      { who: 'hematico', text: L('Construa um Laboratório. Eu cuido do resto. Dos incêndios também, dentro do possível.', 'Build a Laboratory. I\'ll handle the rest. The fires too, within reason.') },
    ],
    objective: obj({ text: L('Construa o Laboratório', 'Build the Laboratory'), event: 'BUILDING_BUILT', match: p => p.kind === 'lab' }),
    target: { slot: 'lab' },
    satisfied: () => ['lab'].some(id => (state.buildings[id]?.level ?? 0) > 0),
    hint: { who: 'hematico', text: L('O lote a leste, perto dos tanques. Toque nele!', 'The lot to the east, near the tanks. Tap it!') },
    reward: { essence: 30 },
    done: [
      { who: 'hematico', text: L('O Laboratório destila Essência de cada coleta de Sangue. O Sangue continua todo seu; a Essência é minha. Nossa. Minha.', 'The Laboratory distills Essence from every Blood collection. The Blood is still all yours; the Essence is mine. Ours. Mine.') },
    ],
  },
  {
    id: 't12_pesquisa',
    lines: [
      { who: 'hematico', text: L('Minha árvore de pesquisas! Quatro ramos: Sangue, Rebanho, Defesa e Castelo. Cada nó tem níveis e é comprado na hora, com Essência.', 'My research tree! Four branches: Blood, Herd, Defense and Castle. Each node has levels and is bought instantly with Essence.') },
      { who: 'hematico', text: L('Comece por Ração Nutritiva, no ramo Rebanho. Humanos saudáveis recuperam sangue mais rápido.', 'Start with Nutritious Rations, in the Herd branch. Healthy humans regain blood faster.') },
      { who: 'boris', text: L('A proposta foi aprovada pelo departamento responsável.', 'The proposal was approved by the responsible department.') },
      { who: 'vesper', text: L('Qual departamento?', 'Which department?') },
      { who: 'boris', text: L('Eu.', 'Me.') },
    ],
    objective: obj({ text: L('Pesquise Ração Nutritiva na árvore', 'Research Nutritious Rations in the tree'), event: 'RESEARCH_STARTED', match: p => p.nodeId === 'r1' }),
    satisfied: () => (state.research.lv.r1 ?? 0) > 0,
    target: { slot: 'lab' },
    hint: { who: 'hematico', text: L('Toque no frasco no alto da tela (ou no Laboratório → Pesquisas). Ração Nutritiva fica logo acima do centro.', 'Tap the flask at the top of the screen (or Laboratory → Research). Nutritious Rations is just above the center.') },
  },
  {
    id: 't13_lobisomens',
    lines: [
      { who: 'aureliano', text: L('Lobisomens.', 'Werewolves.') },
      { who: 'vesper', text: L('Eles chamam de caça.', 'They call it hunting.') },
      { who: 'aureliano', text: L('Nós chamamos de invasão.', 'We call it trespassing.') },
      { who: 'boris', text: L('O jurídico chama de "fora do horário comercial".', 'Legal calls it "outside business hours".') },
      { who: 'davi', text: L('Talvez eles tenham um plano de saúde melhor.', 'Maybe they have a better health plan.') },
      { who: 'aureliano', text: L('Toque no alerta vermelho. Coloque Cálices para gerar Sangue, Sentinelas para atirar e Muralhas para segurar. Proteja a cerca!', 'Tap the red alert. Place Chalices to make Blood, Sentinels to shoot and Walls to hold. Protect the fence!') },
    ],
    objective: obj({ text: L('Defenda a fazenda do ataque', 'Defend the farm from the attack'), event: 'RAID_ENDED' }),
    hint: { who: 'aureliano', text: L('O alerta vermelho à direita, abaixo do HUD. Toque em "Defender".', 'The red alert on the right, below the HUD. Tap "Defend".') },
    done: [
      { who: 'aureliano', text: L('A cerca continua de pé. Na próxima lua cheia eles voltam, e em maior número.', 'The fence still stands. Next full moon they\'ll be back, and in greater numbers.') },
      { who: 'davi', text: L('Um deles olhou pra mim como se me conhecesse.', 'One of them looked at me like it knew me.') },
      { who: 'hematico', text: L('Pesquisas de Defesa liberam Gárgulas, Alquimistas e uma nuvem de morcegos muito, muito entusiasmada.', 'Defense research unlocks Gargoyles, Alchemists and a very, very enthusiastic cloud of bats.') },
    ],
  },
];
