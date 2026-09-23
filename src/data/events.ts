// Decision events (GDD §11.1–11.2): a character brings a problem, the player picks a response.
// Effects go through WorldApi so this file stays pure data + small functions.
import type { Speaker } from './tutorial';

export interface WorldApi {
  gold(d: number): void;
  blood(d: number): void;
  food(d: number): void;
  prestige(d: number): void;
  morale(d: number): void;           // everyone
  tension(d: number): void;
  pause(what: 'collect' | 'food' | 'build', ms: number): void;
  sellBest(): string | null;         // sells the best non-named human, returns their label
  avgMorale(): number;
  resources(): { gold: number; blood: number; food: number; prestige: number };
  toast(msg: string, kind?: 'good' | 'bad' | ''): void;
}

export interface Choice {
  label: string;
  cost?: string;                     // shown under the label
  can?: (w: WorldApi) => boolean;
  apply: (w: WorldApi) => void;
  reply?: { who: Speaker; text: string };
}

export interface GameEventDef {
  id: string;
  title: string;
  who: Speaker | 'merchant' | 'inspector';
  text: string;
  choices: Choice[];
  ignore: (w: WorldApi) => void;     // what happens if the player lets it expire
  weight?: number;
  minNight?: number;
}

const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const EVENTS: GameEventDef[] = [
  {
    id: 'colchoes', title: 'Colchões ou Caos', who: 'davi', weight: 3,
    text: 'Precisamos conversar. As camas são ruins. A comida melhorou, admito. Mas as camas continuam sendo um crime contra a coluna.',
    choices: [
      { label: '"Trocaremos os colchões."', cost: '−250 Ouro · +12 moral · −8 tensão', can: w => w.resources().gold >= 250,
        apply: w => { w.gold(-250); w.morale(12); w.tension(-8); }, reply: { who: 'davi', text: 'Viu? Civilização. Pequena, mas identificável.' } },
      { label: '"Hoje ninguém coleta."', cost: 'sem coleta por 90 s · +18 moral · −12 tensão',
        apply: w => { w.pause('collect', 90000); w.morale(18); w.tension(-12); }, reply: { who: 'davi', text: 'Um feriado. Tecnicamente histórico.' } },
      { label: '"Vou avaliar a solicitação."', cost: '+10 tensão',
        apply: w => w.tension(10), reply: { who: 'davi', text: 'Claro. O idioma oficial da administração.' } },
      { label: '"Bóris, resolva."', cost: 'resultado aleatório',
        apply: w => { if (Math.random() < 0.5) { w.morale(6); w.tension(-5); w.toast('Bóris resolveu. Ninguém sabe como.', 'good'); } else { w.tension(6); w.toast('Bóris resolveu com um formulário de 40 páginas. Pioras.', 'bad'); } },
        reply: { who: 'boris', text: 'Finalmente, uma crise compatível com meu salário inexistente.' } },
    ],
    ignore: w => w.tension(12),
  },
  {
    id: 'cozinheiro', title: 'O Cozinheiro Sumiu', who: 'boris', weight: 2,
    text: 'O humano encarregado da panela desapareceu. Não de forma sinistra: ele só está dormindo atrás do poço. A comida para por 90 segundos.',
    choices: [
      { label: 'Contratar um ghoul temporário', cost: '−80 Ouro', can: w => w.resources().gold >= 80, apply: w => w.gold(-80),
        reply: { who: 'boris', text: 'O ghoul cozinha mal, mas cozinha rápido.' } },
      { label: 'Improvisar com o estoque', cost: '−15 Comida · −3 moral', can: w => w.resources().food >= 15,
        apply: w => { w.food(-15); w.morale(-3); }, reply: { who: 'lia', text: 'Pão amassado com esperança. Nutritivo, dizem.' } },
      { label: 'Esperar ele acordar', cost: 'sem refeições por 90 s', apply: w => w.pause('food', 90000),
        reply: { who: 'davi', text: 'Jejum solidário. Só que ninguém concordou.' } },
    ],
    ignore: w => w.pause('food', 90000),
  },
  {
    id: 'vip', title: 'Cliente VIP', who: 'rubelia', weight: 2, minNight: 2,
    text: 'Um conde de passagem viu seu melhor humano pela janela da carruagem. Paga em dobro. Agora. Sem perguntas.',
    choices: [
      { label: 'Vender o melhor humano', cost: '+ Ouro alto · o humano deixa a fazenda',
        apply: w => { const who = w.sellBest(); if (who) { w.gold(420); w.prestige(8); w.tension(4); w.toast(`${who} foi vendido ao conde. +420 Ouro.`, 'good'); } },
        reply: { who: 'rubelia', text: 'Negócio fechado. O conde já está pálido de alegria. Mais pálido.' } },
      { label: 'Recusar', cost: '+4 moral', apply: w => w.morale(4), reply: { who: 'davi', text: 'Ficamos. Hoje, pelo menos.' } },
    ],
    ignore: w => w.morale(2),
  },
  {
    id: 'panfleto', title: 'O Panfleto', who: 'boris', weight: 2,
    text: 'Alguém anda distribuindo panfletos. O título é "Colheita justa para quem é colhido". A diagramação é surpreendentemente boa.',
    choices: [
      { label: 'Negociar melhorias', cost: '−100 Ouro · −15 tensão', can: w => w.resources().gold >= 100,
        apply: w => { w.gold(-100); w.tension(-15); }, reply: { who: 'davi', text: 'Diálogo. Que conceito revolucionário.' } },
      { label: 'Investigar o autor', cost: '−5 moral · −8 tensão', apply: w => { w.morale(-5); w.tension(-8); },
        reply: { who: 'boris', text: 'Suspeito principal: todo mundo. Registrado.' } },
      { label: 'Ignorar', cost: '+12 tensão', apply: w => w.tension(12), reply: { who: 'lia', text: 'Eles estão fazendo uma segunda edição. Com mapa.' } },
    ],
    ignore: w => w.tension(12),
  },
  {
    id: 'mercador', title: 'Mercador de Sangue', who: 'merchant', weight: 2,
    text: 'Compro Sangue por Ouro, preço de ocasião. A ocasião é que eu estou com pressa.',
    choices: [
      { label: 'Vender 50 Sangue', cost: '+150 Ouro', can: w => w.resources().blood >= 50, apply: w => { w.blood(-50); w.gold(150); } },
      { label: 'Vender 100 Sangue', cost: '+320 Ouro', can: w => w.resources().blood >= 100, apply: w => { w.blood(-100); w.gold(320); } },
      { label: 'Recusar', cost: 'guardar para a Sangria', apply: () => undefined },
    ],
    ignore: () => undefined,
  },
  {
    id: 'carruagem_errada', title: 'A Carruagem Errada', who: 'vesper', weight: 1,
    text: 'Chegou um comprador que queria a fazenda vizinha. Ele já desceu, já reclamou do frio e já pediu o cardápio.',
    choices: [
      { label: 'Redirecionar com cortesia', cost: '+5 Prestígio', apply: w => w.prestige(5), reply: { who: 'vesper', text: 'Boas maneiras são o melhor marketing da eternidade.' } },
      { label: 'Cobrar taxa de estacionamento', cost: '+120 Ouro · −3 Prestígio', apply: w => { w.gold(120); w.prestige(-3); },
        reply: { who: 'boris', text: 'Emiti um recibo. Ele não entendeu. Pagou mesmo assim.' } },
    ],
    ignore: w => w.prestige(1),
  },
  {
    id: 'fiscal', title: 'Fiscal da Casa Rubra', who: 'inspector', weight: 2, minNight: 2,
    text: 'Inspeção de qualidade. Vou avaliar a moral do seu estoque e a limpeza das suas intenções.',
    choices: [
      { label: 'Arrumar tudo às pressas', cost: '−150 Ouro · +10 Prestígio', can: w => w.resources().gold >= 150,
        apply: w => { w.gold(-150); w.prestige(10); } },
      { label: 'Deixar como está', cost: 'depende da moral média',
        apply: w => { if (w.avgMorale() >= 55) { w.prestige(12); w.toast('Fiscal: Humanos satisfeitos. Raro. +12 Prestígio.', 'good'); } else { w.prestige(-8); w.toast('Fiscal: Moral abaixo do padrão. −8 Prestígio.', 'bad'); } } },
      { label: 'Oferecer um "presente"', cost: '−10 Prestígio · +80 Ouro de volta?', apply: w => { w.prestige(-10); if (Math.random() < 0.5) w.gold(80); } },
    ],
    ignore: w => { if (w.avgMorale() < 55) w.prestige(-8); },
  },
  {
    id: 'greve', title: 'Ghoul em Greve', who: 'boris', weight: 1,
    text: 'Um dos ghouls pede "condições pós-vida melhores". Ele fez uma placa. Com letras.',
    choices: [
      { label: 'Dar equipamento novo', cost: '−120 Ouro', can: w => w.resources().gold >= 120, apply: w => w.gold(-120),
        reply: { who: 'boris', text: 'Ele recebeu uma pá. Chorou. Acho que de alegria.' } },
      { label: 'Aumento simbólico', cost: '−6 Prestígio', apply: w => w.prestige(-6) },
      { label: 'Ignorar', cost: 'obras 50% mais lentas por 3 min', apply: w => w.pause('build', 180000) },
    ],
    ignore: w => w.pause('build', 180000),
  },
];

// Short rebellion (GDD §11.3–11.4): demands built from what's actually wrong on the farm.
export const REBELLION = {
  title: 'Rebelião na praça',
  text: 'Temos exigências: comida melhor, menos coleta e o fim daquela música no refeitório.',
  lines: [
    'Não queremos o impossível. Começamos por colchões.',
    'A pauta tem sete itens. O oitavo é não sumir misteriosamente.',
    'Defendam o estoque! Espera. Nós somos o estoque.',
  ],
};

export const ARGUE_LINES = [
  'Você pegou o meu lugar na fila!', 'A fila é por ordem de palidez.', 'Esse banco é meu desde terça.',
  'Quem comeu o último pão?', 'Eu tava aqui antes da lua nascer.',
];

export const pickEvent = (night: number, recent: string[]) => {
  const pool = EVENTS.filter(e => (e.minNight ?? 1) <= night && !recent.includes(e.id));
  const bag = pool.flatMap(e => Array(e.weight ?? 1).fill(e));
  return bag.length ? rand(bag) : rand(EVENTS);
};
