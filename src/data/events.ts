// Decision events (GDD §11.1–11.2): a character brings a problem, the player picks a response.
// Effects go through WorldApi so this file stays pure data + small functions.
// soul(): the Heart × Fang scale of "The Inheritance" (GDD_ADENDO A9): positive = Heart, negative = Fang.
import type { Speaker } from './tutorial';
import { L } from '../core/i18n';

export interface WorldApi {
  gold(d: number): void;
  blood(d: number): void;
  food(d: number): void;
  prestige(d: number): void;
  morale(d: number): void;           // everyone
  tension(d: number): void;
  soul(d: number): void;             // + Heart · − Fang
  flag(k: string): void;             // remember this choice; it comes back later (GDD_ADENDO A10)
  pause(what: 'collect' | 'food' | 'build', ms: number): void;
  sellBest(): string | null;         // sells the best non-named human, returns their label
  release(): string | null;          // a common human walks out through the gate for good, returns their label
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
  story?: boolean;                   // part of the mystery: only after the tutorial
  once?: boolean;                    // happens a single time in the whole campaign
}

const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const HEART = L('Coração', 'Heart'), FANG = L('Presa', 'Fang');

export const EVENTS: GameEventDef[] = [
  {
    id: 'colchoes', title: L('Colchões ou Caos', 'Mattresses or Mayhem'), who: 'davi', weight: 3,
    text: L('Precisamos conversar. As camas são ruins. A comida melhorou, admito. Mas as camas continuam sendo um crime contra a coluna.',
      'We need to talk. The beds are bad. The food got better, I admit. But the beds are still a crime against the spine.'),
    choices: [
      { label: L('"Trocaremos os colchões."', '"We\'ll replace the mattresses."'), cost: L('−250 Ouro · +12 moral · −8 tensão', '−250 Gold · +12 morale · −8 tension'), can: w => w.resources().gold >= 250,
        apply: w => { w.gold(-250); w.morale(12); w.tension(-8); w.soul(2); }, reply: { who: 'davi', text: L('Viu? Civilização. Pequena, mas identificável.', 'See? Civilization. Small, but recognizable.') } },
      { label: L('"Hoje ninguém coleta."', '"Nobody gives blood today."'), cost: L('sem coleta por 90 s · +18 moral · −12 tensão', 'no collection for 90 s · +18 morale · −12 tension'),
        apply: w => { w.pause('collect', 90000); w.morale(18); w.tension(-12); w.soul(3); }, reply: { who: 'davi', text: L('Um feriado. Tecnicamente histórico.', 'A holiday. Technically historic.') } },
      { label: L('"Vou avaliar a solicitação."', '"I\'ll review the request."'), cost: L('+10 tensão', '+10 tension'),
        apply: w => { w.tension(10); w.soul(-1); }, reply: { who: 'davi', text: L('Claro. O idioma oficial da administração.', 'Of course. The official language of management.') } },
      { label: L('"Bóris, resolva."', '"Boris, handle it."'), cost: L('resultado aleatório', 'random outcome'),
        apply: w => { if (Math.random() < 0.5) { w.morale(6); w.tension(-5); w.toast(L('Bóris resolveu. Ninguém sabe como.', 'Boris handled it. Nobody knows how.'), 'good'); } else { w.tension(6); w.toast(L('Bóris resolveu com um formulário de 40 páginas. Piorou.', 'Boris handled it with a 40-page form. It got worse.'), 'bad'); } },
        reply: { who: 'boris', text: L('Finalmente, uma crise compatível com meu salário inexistente.', 'Finally, a crisis worthy of my nonexistent salary.') } },
    ],
    ignore: w => w.tension(12),
  },
  {
    id: 'cozinheiro', title: L('O Cozinheiro Sumiu', 'The Cook Vanished'), who: 'boris', weight: 2,
    text: L('O humano encarregado da panela desapareceu. Não de forma sinistra: ele só está dormindo atrás do poço. A comida para por 90 segundos.',
      'The human in charge of the pot has disappeared. Not in a sinister way: he\'s just asleep behind the well. Meals stop for 90 seconds.'),
    choices: [
      { label: L('Contratar um ghoul temporário', 'Hire a temporary ghoul'), cost: L('−80 Ouro', '−80 Gold'), can: w => w.resources().gold >= 80, apply: w => w.gold(-80),
        reply: { who: 'boris', text: L('O ghoul cozinha mal, mas cozinha rápido.', 'The ghoul cooks badly, but cooks fast.') } },
      { label: L('Improvisar com o estoque', 'Improvise with the stock'), cost: L('−15 Comida · −3 moral', '−15 Food · −3 morale'), can: w => w.resources().food >= 15,
        apply: w => { w.food(-15); w.morale(-3); }, reply: { who: 'lia', text: L('Pão amassado com esperança. Nutritivo, dizem.', 'Bread kneaded with hope. Nutritious, they say.') } },
      { label: L('Esperar ele acordar', 'Wait for him to wake up'), cost: L('sem refeições por 90 s', 'no meals for 90 s'), apply: w => w.pause('food', 90000),
        reply: { who: 'davi', text: L('Jejum solidário. Só que ninguém concordou.', 'A solidarity fast. Except nobody agreed to it.') } },
    ],
    ignore: w => w.pause('food', 90000),
  },
  {
    id: 'vip', title: L('Cliente VIP', 'VIP Client'), who: 'rubelia', weight: 2, minNight: 2,
    text: L('Um conde de passagem viu seu melhor humano pela janela da carruagem. Paga em dobro. Agora. Sem perguntas.',
      'A passing count saw your best human through the carriage window. He pays double. Now. No questions.'),
    choices: [
      { label: L('Vender o melhor humano', 'Sell your best human'), cost: L(`+ Ouro alto · o humano deixa a fazenda · ${FANG}`, `+ lots of Gold · the human leaves the farm · ${FANG}`),
        apply: w => { const who = w.sellBest(); if (who) { w.gold(420); w.prestige(8); w.tension(4); w.soul(-5); w.flag('soldToCount'); w.toast(L(`${who} foi vendido ao conde. +420 Ouro.`, `${who} was sold to the count. +420 Gold.`), 'good'); } },
        reply: { who: 'rubelia', text: L('Negócio fechado. O conde já está pálido de alegria. Mais pálido.', 'Deal done. The count is already pale with joy. Paler.') } },
      { label: L('Recusar', 'Refuse'), cost: L(`+4 moral · ${HEART}`, `+4 morale · ${HEART}`), apply: w => { w.morale(4); w.soul(3); }, reply: { who: 'davi', text: L('Ficamos. Hoje, pelo menos.', 'We stay. Tonight, at least.') } },
    ],
    ignore: w => w.morale(2),
  },
  {
    id: 'panfleto', title: L('O Panfleto', 'The Pamphlet'), who: 'boris', weight: 2,
    text: L('Alguém anda distribuindo panfletos. O título é "Colheita justa para quem é colhido". A diagramação é surpreendentemente boa.',
      'Someone is handing out pamphlets. The title is "Fair harvest for the harvested". The layout is surprisingly good.'),
    choices: [
      { label: L('Negociar melhorias', 'Negotiate improvements'), cost: L('−100 Ouro · −15 tensão', '−100 Gold · −15 tension'), can: w => w.resources().gold >= 100,
        apply: w => { w.gold(-100); w.tension(-15); w.soul(2); }, reply: { who: 'davi', text: L('Diálogo. Que conceito revolucionário.', 'Dialogue. What a revolutionary concept.') } },
      { label: L('Investigar o autor', 'Investigate the author'), cost: L('−5 moral · −8 tensão', '−5 morale · −8 tension'), apply: w => { w.morale(-5); w.tension(-8); w.soul(-3); },
        reply: { who: 'boris', text: L('Suspeito principal: todo mundo. Registrado.', 'Prime suspect: everyone. Filed.') } },
      { label: L('Ignorar', 'Ignore'), cost: L('+12 tensão', '+12 tension'), apply: w => w.tension(12), reply: { who: 'lia', text: L('Eles estão fazendo uma segunda edição. Com mapa.', 'They\'re doing a second edition. With a map.') } },
    ],
    ignore: w => w.tension(12),
  },
  {
    id: 'mercador', title: L('Mercador de Sangue', 'Blood Merchant'), who: 'merchant', weight: 2,
    text: L('Compro Sangue por Ouro, preço de ocasião. A ocasião é que eu estou com pressa.', 'I buy Blood for Gold, bargain price. The bargain is that I\'m in a hurry.'),
    choices: [
      { label: L('Vender 50 Sangue', 'Sell 50 Blood'), cost: L('+150 Ouro', '+150 Gold'), can: w => w.resources().blood >= 50, apply: w => { w.blood(-50); w.gold(150); } },
      { label: L('Vender 100 Sangue', 'Sell 100 Blood'), cost: L('+320 Ouro', '+320 Gold'), can: w => w.resources().blood >= 100, apply: w => { w.blood(-100); w.gold(320); } },
      { label: L('Recusar', 'Refuse'), cost: L('guardar para a Sangria', 'save it for the Bloodletting'), apply: () => undefined },
    ],
    ignore: () => undefined,
  },
  {
    id: 'carruagem_errada', title: L('A Carruagem Errada', 'The Wrong Carriage'), who: 'vesper', weight: 1,
    text: L('Chegou um comprador que queria a fazenda vizinha. Ele já desceu, já reclamou do frio e já pediu o cardápio.',
      'A buyer who wanted the neighboring farm has arrived. He\'s already stepped out, complained about the cold and asked for the menu.'),
    choices: [
      { label: L('Redirecionar com cortesia', 'Redirect him politely'), cost: L('+5 Prestígio', '+5 Prestige'), apply: w => w.prestige(5), reply: { who: 'vesper', text: L('Boas maneiras são o melhor marketing da eternidade.', 'Good manners are eternity\'s best marketing.') } },
      { label: L('Cobrar taxa de estacionamento', 'Charge a parking fee'), cost: L('+120 Ouro · −3 Prestígio', '+120 Gold · −3 Prestige'), apply: w => { w.gold(120); w.prestige(-3); },
        reply: { who: 'boris', text: L('Emiti um recibo. Ele não entendeu. Pagou mesmo assim.', 'I issued a receipt. He didn\'t understand it. He paid anyway.') } },
    ],
    ignore: w => w.prestige(1),
  },
  {
    id: 'fiscal', title: L('Fiscal da Casa Rubra', 'Inspector of House Rubra'), who: 'inspector', weight: 2, minNight: 2,
    text: L('Inspeção de qualidade. Vou avaliar a moral do seu estoque e a limpeza das suas intenções.', 'Quality inspection. I will assess the morale of your stock and the cleanliness of your intentions.'),
    choices: [
      { label: L('Arrumar tudo às pressas', 'Tidy up in a hurry'), cost: L('−150 Ouro · +10 Prestígio', '−150 Gold · +10 Prestige'), can: w => w.resources().gold >= 150,
        apply: w => { w.gold(-150); w.prestige(10); } },
      { label: L('Deixar como está', 'Leave it as it is'), cost: L('depende da moral média', 'depends on average morale'),
        apply: w => { if (w.avgMorale() >= 55) { w.prestige(12); w.toast(L('Fiscal: Humanos satisfeitos. Raro. +12 Prestígio.', 'Inspector: Satisfied humans. Rare. +12 Prestige.'), 'good'); } else { w.prestige(-8); w.toast(L('Fiscal: Moral abaixo do padrão. −8 Prestígio.', 'Inspector: Morale below standard. −8 Prestige.'), 'bad'); } } },
      { label: L('Oferecer um "presente"', 'Offer a "gift"'), cost: L('−10 Prestígio · +80 Ouro de volta?', '−10 Prestige · +80 Gold back?'), apply: w => { w.prestige(-10); if (Math.random() < 0.5) w.gold(80); } },
    ],
    ignore: w => { if (w.avgMorale() < 55) w.prestige(-8); },
  },
  {
    id: 'greve', title: L('Ghoul em Greve', 'Ghoul on Strike'), who: 'boris', weight: 1,
    text: L('Um dos ghouls pede "condições pós-vida melhores". Ele fez uma placa. Com letras.', 'One of the ghouls is demanding "better afterlife conditions". He made a sign. With letters.'),
    choices: [
      { label: L('Dar equipamento novo', 'Give him new tools'), cost: L('−120 Ouro', '−120 Gold'), can: w => w.resources().gold >= 120, apply: w => w.gold(-120),
        reply: { who: 'boris', text: L('Ele recebeu uma pá. Chorou. Acho que de alegria.', 'He got a shovel. He cried. Of joy, I think.') } },
      { label: L('Aumento simbólico', 'Symbolic raise'), cost: L('−6 Prestígio', '−6 Prestige'), apply: w => w.prestige(-6) },
      { label: L('Ignorar', 'Ignore'), cost: L('obras 50% mais lentas por 3 min', 'construction 50% slower for 3 min'), apply: w => w.pause('build', 180000) },
    ],
    ignore: w => w.pause('build', 180000),
  },
  // ---- the mystery (GDD_ADENDO A9) ----
  {
    id: 'porao', title: L('O Porão Trancado', 'The Locked Cellar'), who: 'boris', weight: 3, story: true, once: true,
    text: L('Achei um porão trancado embaixo da casa da sua tia. A fechadura tem marcas de garras. Do lado de dentro.',
      'I found a locked cellar under your aunt\'s house. The lock has claw marks. On the inside.'),
    choices: [
      { label: L('Abrir', 'Open it'), cost: L(`+150 Ouro · ${HEART} · o mapa pode ser útil um dia`, `+150 Gold · ${HEART} · the map may come in handy one day`), apply: w => { w.gold(150); w.soul(2); w.flag('cellarOpened'); },
        reply: { who: 'boris', text: L('Economias dela, uma coleira arrebentada e um mapa das ilhas. Fico com a coleira. Para os arquivos.', 'Her savings, a snapped collar and a map of the islands. I\'ll keep the collar. For the archives.') } },
      { label: L('Avisar o Conde', 'Tell the Count'), cost: L(`+10 Prestígio · cota 10% menor para sempre · ${FANG} · algo se perde`, `+10 Prestige · quota 10% lower forever · ${FANG} · something is lost`),
        apply: w => { w.prestige(10); w.soul(-3); w.flag('cellarToldCount'); },
        reply: { who: 'vesper', text: L('Muito obediente. Mandarei queimar o que estiver lá dentro. A Casa lembrará da sua lealdade.', 'Very obedient. I\'ll have whatever is inside burned. The House will remember your loyalty.') } },
      { label: L('Deixar trancado', 'Leave it locked'), cost: L('nada acontece. Por enquanto.', 'nothing happens. For now.'), apply: () => undefined },
    ],
    ignore: () => undefined,
  },
  {
    id: 'carta', title: L('A Carta Sem Remetente', 'The Unsigned Letter'), who: 'lia', weight: 3, story: true, once: true, minNight: 2,
    text: L('Chegou uma carta sem remetente, pelo portão dos fundos: "Os pares que você escolhe viram famílias. Cuide deles." A letra é da sua tia.',
      'A letter with no sender came through the back gate: "The pairs you choose become families. Look after them." The handwriting is your aunt\'s.'),
    choices: [
      { label: L('Ler para todos na praça', 'Read it aloud in the square'), cost: L(`+8 moral · −6 tensão · ${HEART} · parentes chegam mais rápido`, `+8 morale · −6 tension · ${HEART} · relatives arrive faster`),
        apply: w => { w.morale(8); w.tension(-6); w.soul(3); w.flag('letterRead'); },
        reply: { who: 'lia', text: L('Ela lembrou da gente. Mesmo de longe.', 'She remembered us. Even from far away.') } },
      { label: L('Queimar', 'Burn it'), cost: L(`+4 Prestígio · ${FANG} · Lia vai lembrar`, `+4 Prestige · ${FANG} · Lia will remember`), apply: w => { w.prestige(4); w.soul(-2); w.flag('letterBurned'); },
        reply: { who: 'davi', text: L('Papel queima rápido. Lembrança, não.', 'Paper burns fast. Memories don\'t.') } },
    ],
    ignore: w => w.tension(4),
  },
  {
    id: 'uivo', title: L('O Uivo com Nome', 'The Howl with a Name'), who: 'davi', weight: 3, story: true, once: true, minNight: 3,
    text: L('Um uivo chamou o nome de um dos nossos. Ele diz que conhece a voz. Quer ir até a cerca. Agora.',
      'A howl called the name of one of our people. He says he knows the voice. He wants to go to the fence. Now.'),
    choices: [
      { label: L('Deixar ir', 'Let him go'), cost: L(`um humano comum parte · −10 tensão · ${HEART}`, `a common human leaves · −10 tension · ${HEART}`),
        apply: w => { const who = w.release(); w.tension(-10); w.soul(4); if (who) w.flag('wolfFreed'); if (who) w.toast(L(`${who} atravessou o portão e não olhou para trás.`, `${who} walked through the gate and didn't look back.`), 'good'); },
        reply: { who: 'davi', text: L('Ele sorriu. Faz tempo que não vejo alguém sorrir aqui.', 'He smiled. It\'s been a while since I saw anyone smile here.') } },
      { label: L('Trancar todos nas casas', 'Lock everyone indoors'), cost: L(`sem coleta por 60 s · +6 tensão · ${FANG}`, `no collection for 60 s · +6 tension · ${FANG}`),
        apply: w => { w.pause('collect', 60000); w.tension(6); w.soul(-3); w.flag('howlLocked'); }, reply: { who: 'aureliano', text: L('Portas trancadas. O uivo durou até o amanhecer. Parecia… ofendido.', 'Doors locked. The howl lasted until dawn. It sounded… offended.') } },
      { label: L('Mandar Aureliano à cerca', 'Send Aureliano to the fence'), cost: L('+4 Prestígio', '+4 Prestige'), apply: w => w.prestige(4),
        reply: { who: 'aureliano', text: L('Não havia ninguém. Só pegadas. De pés descalços, que viravam patas.', 'Nobody was there. Only tracks. Bare feet, turning into paws.') } },
    ],
    ignore: w => w.tension(8),
  },
  {
    id: 'caravana', title: L('A Caravana da Cripta', 'The Crypt Caravan'), who: 'vesper', weight: 2, story: true, minNight: 3,
    text: L('Uma caravana da Cripta pede 80 de Sangue extra, "pelos Anciãos". Quem paga agora ganha a gratidão da Casa. Quem não paga ganha a atenção dela.',
      'A caravan from the Crypt asks for 80 extra Blood, "for the Elders". Those who pay now earn the House\'s gratitude. Those who don\'t earn its attention.'),
    choices: [
      { label: L('Pagar', 'Pay'), cost: L(`−80 Sangue · +14 Prestígio · ${FANG} · os Anciãos despertam um pouco`, `−80 Blood · +14 Prestige · ${FANG} · the Elders stir a little`), can: w => w.resources().blood >= 80,
        apply: w => { w.blood(-80); w.prestige(14); w.soul(-3); w.flag('caravanPaid'); }, reply: { who: 'vesper', text: L('Os Anciãos agradecem. Eles se mexeram no sono. Um bom sinal. Para eles.', 'The Elders thank you. They stirred in their sleep. A good sign. For them.') } },
      { label: L('Recusar', 'Refuse'), cost: L(`−6 Prestígio · ${HEART} · os Anciãos passam fome`, `−6 Prestige · ${HEART} · the Elders go hungry`), apply: w => { w.prestige(-6); w.soul(2); w.flag('caravanRefused'); },
        reply: { who: 'vesper', text: L('Anotado. Com tinta vermelha.', 'Noted. In red ink.') } },
      { label: L('Diluir com água de beterraba', 'Dilute it with beet juice'), cost: L('−30 Sangue · sorte', '−30 Blood · luck'), can: w => w.resources().blood >= 30,
        apply: w => { w.blood(-30); if (Math.random() < 0.5) { w.prestige(8); w.toast(L('Os Anciãos não notaram. Aparentemente gostam de beterraba.', 'The Elders didn\'t notice. Apparently they like beets.'), 'good'); } else { w.prestige(-12); w.toast(L('O Hemático notou. E contou. −12 Prestígio.', 'Hematic noticed. And told. −12 Prestige.'), 'bad'); } },
        reply: { who: 'hematico', text: L('Eu vi isso. Eu não vi isso. Eu não estou aqui.', 'I saw that. I didn\'t see that. I\'m not here.') } },
    ],
    ignore: w => w.prestige(-4),
  },
];

// Short rebellion (GDD §11.3–11.4): demands built from what's actually wrong on the farm.
export const REBELLION = {
  title: L('Rebelião na praça', 'Rebellion in the square'),
  text: L('Temos exigências: comida melhor, menos coleta e o fim daquela música no refeitório.', 'We have demands: better food, less collection and an end to that music in the dining hall.'),
  lines: [
    L('Não queremos o impossível. Começamos por colchões.', 'We don\'t want the impossible. We\'ll start with mattresses.'),
    L('A pauta tem sete itens. O oitavo é não sumir misteriosamente.', 'The agenda has seven items. The eighth is not disappearing mysteriously.'),
    L('Defendam o estoque! Espera. Nós somos o estoque.', 'Defend the stock! Wait. We are the stock.'),
  ],
};

export const ARGUE_LINES = [
  L('Você pegou o meu lugar na fila!', 'You took my place in line!'), L('A fila é por ordem de palidez.', 'The line goes by paleness.'), L('Esse banco é meu desde terça.', 'That bench has been mine since Tuesday.'),
  L('Quem comeu o último pão?', 'Who ate the last bread?'), L('Eu tava aqui antes da lua nascer.', 'I was here before the moon rose.'),
];

// seen: story events already lived (once). soul tilts the odds: a kind administrator draws the Inspector,
// a hungry one draws buyers for the best humans.
export const pickEvent = (night: number, recent: string[], storyOk = true, seen: (id: string) => boolean = () => false, soul = 0) => {
  const pool = EVENTS.filter(e => (e.minNight ?? 1) <= night && !recent.includes(e.id) && (storyOk || !e.story) && !(e.once && seen(e.id)));
  const weight = (e: GameEventDef) => (e.weight ?? 1) * ((e.id === 'fiscal' && soul >= 25) || (e.id === 'vip' && soul <= -25) ? 2 : 1);
  const bag = pool.flatMap(e => Array(weight(e)).fill(e));
  return bag.length ? rand(bag) : rand(EVENTS.filter(e => !e.story));
};
