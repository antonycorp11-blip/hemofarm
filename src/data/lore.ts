// "The Inheritance" (GDD_ADENDO A9): Aunt Leonor's letter, her diary, the final meeting and the three endings.
import { L } from '../core/i18n';
import type { Line } from './tutorial';

export const LETTER = {
  title: L('Uma carta na mesa', 'A letter on the desk'),
  body: [
    L('Se você está lendo isto, eu não voltei.', 'If you\'re reading this, I didn\'t come back.'),
    L('A fazenda é sua agora. Os humanos também. Trate-os melhor do que me obrigaram a tratar.', 'The farm is yours now. The humans too. Treat them better than I was made to.'),
    L('Pague as cotas. Sorria para o Conde. E nunca, nunca desça à Cripta.', 'Pay the quotas. Smile at the Count. And never, ever go down to the Crypt.'),
    L('Escondi páginas do meu diário pela propriedade. A noite vai entregá-las a você, uma de cada vez.', 'I hid pages of my diary around the property. The night will hand them to you, one at a time.'),
    L('Quando a floresta chamar o seu nome, não tenha medo.', 'When the forest calls your name, don\'t be afraid.'),
  ],
  sign: L('— Tia Leonor', '— Aunt Leonor'),
};

export interface DiaryPage { id: string; title: string; text: string }

// In story order. Story.ts decides when each one is found.
export const DIARY: DiaryPage[] = [
  { id: 'first_blood', title: L('O primeiro frasco', 'The first vial'),
    text: L('Hoje enchi o primeiro frasco. O Conde sorriu como quem aprova um vinho. Eu sorri de volta. Treinei esse sorriso a semana inteira no espelho.',
      'Today I filled the first vial. The Count smiled like someone approving a wine. I smiled back. I practiced that smile all week in the mirror.') },
  { id: 'first_tithe', title: L('As cotas', 'The quotas'),
    text: L('A cota sobe toda noite. Fiz as contas: o castelo inteiro não bebe tanto. Então para onde vai todo esse sangue?',
      'The quota rises every night. I did the math: the whole castle doesn\'t drink that much. So where does all this blood go?') },
  { id: 'first_sale', title: L('Vendidos', 'Sold'),
    text: L('Rubélia pagou bem pelo primeiro par. Eles acenaram da carruagem, como se fossem a uma festa. Não dormi aquela noite. Nem a seguinte.',
      'Rubelia paid well for the first pair. They waved from the carriage, as if going to a party. I didn\'t sleep that night. Or the next.') },
  { id: 'first_bond', title: L('Famílias', 'Families'),
    text: L('Lia chegou aqui como parente de dois Rubra. Ela nunca soube que fui eu que escolhi os pares. Me perdoe, Lia. Você é a melhor coisa que eu já planejei.',
      'Lia came here as the relative of two Rubra. She never knew I was the one who chose the pairs. Forgive me, Lia. You\'re the best thing I ever planned.') },
  { id: 'first_raid', title: L('Os lobos', 'The wolves'),
    text: L('Os lobos não atacam a esmo. Vêm na lua cheia e só levam quem está perto da cerca. Quase como se viessem buscar alguém. Quase como se fossem convidados.',
      'The wolves don\'t attack at random. They come at the full moon and only take whoever is near the fence. Almost as if they came to fetch someone. Almost as if they were invited.') },
  { id: 'first_research', title: L('A Vigília', 'The Vigil'),
    text: L('O Doutor mediu no sangue algo que chama de "Vigília". Diz que é o que mantém certas coisas acordadas. Perguntei que coisas. Ele riu alto demais.',
      'The Doctor measured something in the blood he calls "Vigil". He says it\'s what keeps certain things awake. I asked what things. He laughed too loudly.') },
  { id: 'first_taken', title: L('A estrada sul', 'The south road'),
    text: L('Segui a carruagem de quem não pagamos. Ela não vai para o castelo. Desce a estrada sul, até a Cripta. Os humanos entram. Ninguém sai.',
      'I followed the carriage of those we couldn\'t pay for. It doesn\'t go to the castle. It goes down the south road, to the Crypt. The humans go in. Nobody comes out.') },
  { id: 'rebellion', title: L('Davi', 'Davi'),
    text: L('Davi pergunta demais. Eu gostava disso. Se ele ainda estiver aí, confie nele. Mas não conte tudo de uma vez: ele é corajoso, não é paciente.',
      'Davi asks too many questions. I liked that. If he\'s still there, trust him. But don\'t tell him everything at once: he\'s brave, not patient.') },
  { id: 'regent', title: L('Presas', 'Fangs'),
    text: L('Me ofereceram a Regência. Presas, título, eternidade. Tudo o que eu precisava fazer era parar de fazer perguntas. Eu recusei. Foi a primeira vez que o Conde não sorriu.',
      'They offered me the Regency. Fangs, a title, eternity. All I had to do was stop asking questions. I refused. It was the first time the Count didn\'t smile.') },
  { id: 'ulf', title: L('Ulf', 'Ulf'),
    text: L('Ulf era meu primeiro ajudante. Na noite em que a carruagem veio buscá-lo, ele quebrou a cerca com as próprias mãos. Eu abri o portão para ele. Foi assim que tudo começou.',
      'Ulf was my first farmhand. The night the carriage came for him, he broke the fence with his bare hands. I opened the gate for him. That\'s how it all began.') },
  { id: 'grenda', title: L('Grenda', 'Grenda'),
    text: L('A carruagem de inverno virou no pântano. Grenda estava nela. Voltou semanas depois, de quatro patas, e me trouxe os outros sobreviventes. Todos lobos. Todos vivos.',
      'The winter carriage overturned in the marsh. Grenda was in it. She came back weeks later, on four legs, and brought me the other survivors. All wolves. All alive.') },
  { id: 'korvus', title: L('Korvus', 'Korvus'),
    text: L('Korvus era escudeiro de Aureliano. A Casa o mandou desarmado para a fronteira porque ele viu os tubos da Cripta. Aureliano nunca soube. Talvez devesse.',
      'Korvus was Aureliano\'s squire. The House sent him unarmed to the frontier because he saw the Crypt\'s pipes. Aureliano never knew. Maybe he should.') },
  { id: 'soror', title: L('A Sóror', 'The Sister'),
    text: L('A Sóror Branca me mordeu numa noite de neve. Doeu menos do que pagar a primeira cota. "A Matilha não é maldição", ela disse. "É a porta que a Casa não tranca."',
      'Sister White bit me on a snowy night. It hurt less than paying the first quota. "The Pack isn\'t a curse," she said. "It\'s the door the House can\'t lock."') },
  { id: 'captain', title: L('A maré', 'The tide'),
    text: L('O Capitão leva humanos para ilhas sem Casa. Paguei cada passagem em frascos roubados da cota. Se você está lendo isto, alguns deles estão livres. Por sua causa também.',
      'The Captain takes humans to islands with no House. I paid every passage in vials stolen from the quota. If you\'re reading this, some of them are free. Because of you too.') },
  { id: 'crypt', title: L('A Cripta', 'The Crypt'),
    text: L('Desci. Os Anciãos dormem em caixões ligados por tubos. Todo o sangue de todas as fazendas desce para eles. Quando acordarem, não vão precisar de fazendas. Vão precisar de cidades.',
      'I went down. The Elders sleep in coffins joined by pipes. All the blood from every farm flows down to them. When they wake, they won\'t need farms. They\'ll need cities.') },
  { id: 'mother', title: L('Leonor', 'Leonor'),
    text: L('Se a Mãe da Matilha vier até você, sou eu. Não tenha medo. Eu não quero a fazenda de volta. Só quero que você escolha, sabendo de tudo. Eu não tive essa chance.',
      'If the Pack Mother comes to you, it\'s me. Don\'t be afraid. I don\'t want the farm back. I only want you to choose, knowing everything. I never had that chance.') },
];

export const PACT_PAGES = 12;   // diary pages needed for the Pact ending
export const REVOLT_HEART = 25; // Heart needed for the Revolt ending
export const ELDER_FANG = 50;   // Fang needed for the secret ending
export const TRAGIC_PAGES = 6;  // fewer pages than this and you never recognize her

// After the Pack Mother falls in the Crypt: she stands up, and she is human again.
export const REVEAL: Line[] = [
  { who: 'leonor', text: L('Você cresceu. Não, não abaixe as armas ainda. Me escute primeiro.', 'You\'ve grown. No, don\'t lower your weapons yet. Listen to me first.') },
  { who: 'leonor', text: L('Vinte anos administrando esta fazenda. Cada cota que eu pagava acordava um pouco mais os Anciãos.', 'Twenty years running this farm. Every quota I paid woke the Elders a little more.') },
  { who: 'leonor', text: L('Quando descobri, fugi para a floresta. A Sóror me mordeu. E eu comecei a abrir portões.', 'When I found out, I fled to the forest. The Sister bit me. And I started opening gates.') },
  { who: 'vesper', text: L('Ela é uma ladra de estoque. Entregue-a, e a Casa lhe dará a eternidade.', 'She\'s a stock thief. Hand her over, and the House will give you eternity.') },
  { who: 'davi', text: L('Ou abre o portão. De uma vez. Pra todo mundo.', 'Or open the gate. Once and for all. For everyone.') },
  { who: 'leonor', text: L('Ou fica comigo. Sem cotas, sem carruagens. Sangue só de quem quiser dar.', 'Or stay with me. No quotas, no carriages. Blood only from those who choose to give it.') },
  { who: 'leonor', text: L('A escolha é sua, meu bem. Sempre foi. Por isso eu deixei a fazenda para você.', 'The choice is yours, dear. It always was. That\'s why I left the farm to you.') },
];

export type EndingId = 'house' | 'revolt' | 'pact' | 'elder' | 'tragic';
export interface Ending { id: EndingId; title: string; choice: string; need: string; lines: Line[]; epilogue: string[] }

export const ENDINGS = {
  house: {
    id: 'house', title: L('Casa Eterna', 'Eternal House'),
    choice: L('Entregar Leonor ao Conde', 'Hand Leonor to the Count'), need: L('Sempre disponível', 'Always available'),
    lines: [
      { who: 'vesper', text: L('Sábia escolha. A eternidade gosta de gente prática.', 'A wise choice. Eternity likes practical people.') },
      { who: 'leonor', text: L('Eu entendo. Eu também tive medo.', 'I understand. I was afraid too.') },
      { who: 'davi', text: L('…', '…') },
    ],
    epilogue: [
      L('Leonor foi acorrentada na Cripta. Na noite seguinte, os Anciãos acordaram: saciados, gratos e famintos por mais.', 'Leonor was chained in the Crypt. The next night, the Elders woke: sated, grateful and hungry for more.'),
      L('Você recebeu presas, um título e uma fazenda do tamanho de um reino. As cotas agora são cobradas de cidades inteiras.', 'You received fangs, a title and a farm the size of a kingdom. The quotas are now collected from whole cities.'),
      L('Davi nunca mais fez uma piada. Bóris arquivou tudo sob "sucesso".', 'Davi never made another joke. Boris filed it all under "success".'),
      L('Às vezes, na lua cheia, um uivo chama o seu nome. Você não responde.', 'Sometimes, at the full moon, a howl calls your name. You don\'t answer.'),
    ],
  },
  revolt: {
    id: 'revolt', title: L('Revolta', 'Revolt'),
    choice: L('Abrir os portões com Davi', 'Open the gates with Davi'), need: L(`Coração ${REVOLT_HEART}+`, `Heart ${REVOLT_HEART}+`),
    lines: [
      { who: 'davi', text: L('Eu sabia. Eu SABIA. Todo mundo, pro portão!', 'I knew it. I KNEW it. Everyone, to the gate!') },
      { who: 'aureliano', text: L('Por Korvus. Eu seguro a Cripta. Vão.', 'For Korvus. I\'ll hold the Crypt. Go.') },
      { who: 'vesper', text: L('Vocês não fazem ideia do que acabaram de fazer.', 'You have no idea what you\'ve just done.') },
      { who: 'leonor', text: L('Fazemos, sim. Pela primeira vez, fazemos.', 'We do. For the first time, we do.') },
    ],
    epilogue: [
      L('Humanos e lobos desceram juntos à Cripta e arrancaram os tubos. Os Anciãos continuam dormindo, com fome, para sempre.', 'Humans and wolves went down into the Crypt together and tore out the pipes. The Elders sleep on, hungry, forever.'),
      L('O Conde Vesper fugiu para o castelo e trancou as portas. Dizem que ainda confere as cotas, sozinho, toda noite.', 'Count Vesper fled to the castle and locked the doors. They say he still checks the quotas, alone, every night.'),
      L('A fazenda virou a Vila Leonor. Davi é o chefe da guarda. Lia cuida das famílias. Bóris é o prefeito, "por contrato".', 'The farm became Leonor Village. Davi is captain of the guard. Lia looks after the families. Boris is mayor, "by contract".'),
      L('Não há mais carruagens. Só portões abertos.', 'There are no more carriages. Only open gates.'),
    ],
  },
  pact: {
    id: 'pact', title: L('Pacto', 'Pact'),
    choice: L('Aceitar a mordida de Leonor', 'Accept Leonor\'s bite'), need: L(`${PACT_PAGES}+ páginas do diário`, `${PACT_PAGES}+ diary pages`),
    lines: [
      { who: 'leonor', text: L('Vai doer menos que a primeira cota. Eu prometo.', 'It\'ll hurt less than the first quota. I promise.') },
      { who: 'hematico', text: L('Fascinante! Um administrador meio lobo! Posso tirar uma amostra? Uma pequenina?', 'Fascinating! A half-wolf administrator! May I take a sample? A tiny one?') },
      { who: 'vesper', text: L('A Casa não negocia com cães.', 'The House doesn\'t negotiate with dogs.') },
      { who: 'boris', text: L('A Casa acabou de assinar. Eu tenho o papel.', 'The House just signed. I have the paper.') },
    ],
    epilogue: [
      L('Com a mordida, você passou a ouvir a floresta. E a floresta passou a ouvir você.', 'With the bite, you began to hear the forest. And the forest began to hear you.'),
      L('A fazenda virou terra neutra entre a Casa e a Matilha. O sangue ainda corre, mas só de quem escolhe doar, em troca de proteção.', 'The farm became neutral ground between the House and the Pack. Blood still flows, but only from those who choose to give it, in exchange for protection.'),
      L('Os Anciãos dormem com pouca fome. Vesper assinou o tratado com luvas, para não tocar no papel.', 'The Elders sleep with little hunger. Vesper signed the treaty wearing gloves, so as not to touch the paper.'),
      L('Na lua cheia, Leonor janta com você na varanda. Aureliano monta guarda para os dois lados.', 'At the full moon, Leonor dines with you on the porch. Aureliano stands guard for both sides.'),
    ],
  },
} as Record<EndingId, Ending>; // elder and tragic are added below

// The secret ending (Fang) and the tragic one (you never read enough to know who she was). GDD_ADENDO A10.
Object.assign(ENDINGS, {
  elder: {
    id: 'elder', title: L('O Novo Ancião', 'The New Elder'),
    choice: L('Descer aos caixões e beber dos Anciãos', 'Go down to the coffins and drink from the Elders'), need: L(`Presa ${ELDER_FANG}+ · final secreto`, `Fang ${ELDER_FANG}+ · secret ending`),
    lines: [
      { who: 'vesper', text: L('O que você está fazendo? Esses tubos são sagrados. Afaste-se dos caixões!', 'What are you doing? Those pipes are sacred. Step away from the coffins!') },
      { who: 'leonor', text: L('Não. Não era isso. Eu te deixei a fazenda para você escolher, não para você virar eles.', 'No. Not this. I left you the farm so you could choose, not so you could become them.') },
      { who: 'hematico', text: L('A Vigília… está toda indo para uma pessoa só. Fascinante. Aterrorizante. Principalmente aterrorizante.', 'The Vigil… it\'s all flowing into one person. Fascinating. Terrifying. Mostly terrifying.') },
    ],
    epilogue: [
      L('Você bebeu até os caixões ficarem secos. Os Anciãos nunca acordaram. Nem vão.', 'You drank until the coffins ran dry. The Elders never woke. They never will.'),
      L('Vesper se ajoelhou antes que alguém mandasse. A Casa Rubra agora tem um só nome: o seu.', 'Vesper knelt before anyone told him to. House Rubra now has a single name: yours.'),
      L('Leonor voltou para a floresta. A Matilha uiva mais baixo desde então, como quem tem medo.', 'Leonor went back to the forest. The Pack howls more quietly since then, like something afraid.'),
      L('As cotas nunca foram tão altas. Ninguém ousa atrasar.', 'The quotas have never been higher. No one dares to be late.'),
    ],
  },
  tragic: {
    id: 'tragic', title: L('A Página que Faltou', 'The Missing Page'),
    choice: '', need: L(`menos de ${TRAGIC_PAGES} páginas do diário`, `fewer than ${TRAGIC_PAGES} diary pages`),
    lines: [
      { who: 'aureliano', text: L('Ela caiu. Espere… está dizendo alguma coisa.', 'She\'s down. Wait… she\'s saying something.') },
      { who: 'leonor', text: L('Você… não leu… as páginas… Eu escondi tantas…', 'You… didn\'t read… the pages… I hid so many…') },
      { who: 'vesper', text: L('Uma loba a menos. Excelente trabalho, administrador.', 'One less she-wolf. Excellent work, administrator.') },
    ],
    epilogue: [
      L('Só dias depois, arrumando o sótão, você encontrou o resto do diário.', 'Only days later, tidying the attic, did you find the rest of the diary.'),
      L('A última página dizia: "Se a Mãe da Matilha vier até você, sou eu. Não tenha medo."', 'The last page said: "If the Pack Mother comes to you, it\'s me. Don\'t be afraid."'),
      L('Os Anciãos acordaram na lua seguinte. A fazenda continuou pagando. Sempre paga.', 'The Elders woke at the next moon. The farm kept paying. It always pays.'),
    ],
  },
} satisfies Partial<Record<EndingId, Ending>>);

// "What became of them": one line per character, built from the choices you made. `f` reads a story flag.
export function fates(ending: EndingId, f: (k: string) => number, soul: number): string[] {
  const out: string[] = [];
  if (f('daviGone')) out.push(L('Davi: foi embora na segunda repressão. Dizem que lidera uma aldeia livre nas montanhas, e que não fala o seu nome.', 'Davi: left after the second crackdown. They say he leads a free village in the mountains, and never says your name.'));
  else out.push({
    revolt: L('Davi: chefe da guarda da Vila Leonor. Ainda reclama dos colchões. Por esporte.', 'Davi: captain of the guard of Leonor Village. Still complains about the mattresses. For sport.'),
    pact: L('Davi: aprendeu a conversar com lobos. Diz que eles escutam melhor que vampiros.', 'Davi: learned to talk to wolves. Says they listen better than vampires.'),
    house: L('Davi: nunca mais fez uma piada.', 'Davi: never made another joke.'),
    elder: L('Davi: fugiu na primeira noite do seu reinado, levando metade da fila de coleta.', 'Davi: fled on the first night of your reign, taking half the collection line with him.'),
    tragic: L('Davi: foi o único que chorou pela loba grisalha. Ninguém entendeu por quê.', 'Davi: was the only one who wept for the grey she-wolf. Nobody understood why.'),
  }[ending]);
  out.push(f('letterBurned') ? L('Lia: nunca soube que a tia escreveu para ela. A carta queimou antes.', 'Lia: never knew her aunt wrote to her. The letter burned first.')
    : f('letterRead') ? L('Lia: guarda a carta da Leonor debaixo do travesseiro e a lê para cada família nova.', 'Lia: keeps Leonor\'s letter under her pillow and reads it to every new family.')
    : L('Lia: continua cuidando das famílias, uma cama de cada vez.', 'Lia: keeps looking after the families, one bed at a time.'));
  out.push(soul >= 25 ? L('Aureliano: deixou a Casa e hoje monta guarda para os humanos. Por Korvus.', 'Aureliano: left the House and now stands guard for the humans. For Korvus.')
    : L('Aureliano: continua servindo à Casa. Um olho aberto, o outro fechado.', 'Aureliano: still serves the House. One eye open, the other shut.'));
  if (f('wolfFreed')) out.push(L('O humano que você deixou ir corre com a Matilha. Nas noites de lua, uiva o seu nome, e soa como gratidão.', 'The human you let go runs with the Pack. On moonlit nights he howls your name, and it sounds like gratitude.'));
  if (f('howlLocked')) out.push(L('O uivo que você trancou do lado de fora nunca mais chamou ninguém da fazenda.', 'The howl you locked out never called anyone from the farm again.'));
  if (f('cellarToldCount')) out.push(L('Vesper guardou o mapa das ilhas que você entregou. Os barcos do Capitão pararam de voltar.', 'Vesper kept the island map you handed over. The Captain\'s boats stopped coming back.'));
  else if (f('cellarOpened')) out.push(L('O mapa das ilhas passou de mão em mão entre os humanos. Mais barcos partiram.', 'The island map passed from hand to hand among the humans. More boats set sail.'));
  if (f('caravanPaid') >= 2) out.push(L(`Os Anciãos lembram de cada uma das ${f('caravanPaid')} caravanas que você pagou.`, `The Elders remember each of the ${f('caravanPaid')} caravans you paid.`));
  if (f('soldToCount')) out.push(L(`${f('soldToCount')} humano${f('soldToCount') > 1 ? 's' : ''} vendido${f('soldToCount') > 1 ? 's' : ''} ao conde de passagem nunca foram vistos de novo.`, `${f('soldToCount')} human${f('soldToCount') > 1 ? 's' : ''} sold to the passing count ${f('soldToCount') > 1 ? 'were' : 'was'} never seen again.`));
  return out;
}

// How the cast reacts to who you've become (Heart × Fang), now and then at the start of a night.
export const REACTIONS: Record<'heart' | 'mid' | 'fang', Line[]> = {
  heart: [
    { who: 'davi', text: L('Não confio em vampiro. Mas em você… talvez.', 'I don\'t trust vampires. But you… maybe.') },
    { who: 'lia', text: L('Os vizinhos perguntaram se aqui é seguro. Eu disse que sim. Não me faça mentir.', 'The neighbors asked if it\'s safe here. I said yes. Don\'t make me a liar.') },
    { who: 'vesper', text: L('Você anda generoso demais com o estoque. Mandei o Fiscal dar uma olhada. Por carinho.', 'You\'ve been far too generous with the stock. I sent the Inspector to take a look. Out of affection.') },
    { who: 'boris', text: L('Registrei um sorriso na fila de coleta. Precisei criar um formulário novo.', 'I logged a smile in the collection line. I had to create a new form.') },
    { who: 'aureliano', text: L('A Leonor tratava eles assim. Eu achava fraqueza. Estou revendo.', 'Leonor treated them like this. I thought it was weakness. I\'m reconsidering.') },
  ],
  mid: [
    { who: 'boris', text: L('Relatório: a fazenda está exatamente no meio. Como uma cerca.', 'Report: the farm sits exactly in the middle. Like a fence.') },
    { who: 'hematico', text: L('A Vigília oscila conforme suas decisões. Você é meu experimento favorito.', 'The Vigil wavers with your decisions. You are my favorite experiment.') },
    { who: 'davi', text: L('Ainda estou tentando decidir se você é como ela ou como eles.', 'I\'m still trying to decide if you\'re like her or like them.') },
  ],
  fang: [
    { who: 'vesper', text: L('Finalmente um administrador com apetite. A casa superior comenta. Os compradores também.', 'At last, an administrator with appetite. The upper house talks. So do the buyers.') },
    { who: 'davi', text: L('A Leonor também começou assim. Depois mudou. Você vai mudar?', 'Leonor started like this too. Then she changed. Will you?') },
    { who: 'aureliano', text: L('Eu sigo ordens. Mas não gosto de todas.', 'I follow orders. But I don\'t like all of them.') },
    { who: 'rubelia', text: L('Adoro sua nova política de estoque. Tão… decidida. Mande mais.', 'I adore your new stock policy. So… decisive. Send more.') },
  ],
};

export const CREDITS = {
  title: L('Fim', 'The End'),
  thanks: L('Obrigado por jogar Hemofazenda.', 'Thank you for playing Hemofarm.'),
  more: L('Existem cinco finais, um deles secreto. A Cripta pode ser jogada de novo depois de conquistar todas as regiões.', 'There are five endings, one of them secret. The Crypt can be replayed after conquering every region.'),
};
