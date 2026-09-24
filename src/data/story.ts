// Story (GDD_ADENDO A8 + A9 "The Inheritance"): one chapter per region. Each chapter is won by conquering the region:
// production, a vampire Regent to rule it in your place, and its werewolf pack defeated. A conquered region becomes a
// Domain of the House. Underneath runs the mystery of Aunt Leonor, told through night hooks, boss last words and her diary.
import type { Line } from './tutorial';
import type { RegionId } from './regions';
import type { WolfId } from './battle';
import { L } from '../core/i18n';

export interface Chapter {
  title: string;
  rate: number;                                   // Blood per minute the region must reach
  boss: { name: string; wolf: WolfId; taunt: string };
  intro: Line[];
  nights: Line[][];                               // hooks at the start of nights 2, 3, 4… of the chapter (after the tutorial)
  regent: Line[];                                 // after the transformation
  cleared: Line[];                                // after the boss falls: their last human words
  ready: Line[];                                  // all three pillars done
  look: { fog: number; motes: number; night: number; nightAlpha: number }; // region atmosphere
}

export const CHAPTERS: Record<RegionId, Chapter> = {
  bosque: {
    title: L('Capítulo I · O Bosque Cinzento', 'Chapter I · The Grey Woods'), rate: 45,
    boss: { name: L('Ulf Quebra-Cerca', 'Ulf Fencebreaker'), wolf: 'alpha', taunt: L('Ulf: Então é você o novo vizinho. Tem o cheiro dela.', 'Ulf: So you\'re the new neighbor. You smell like her.') },
    intro: [
      { who: 'vesper', text: L('Você sobreviveu à primeira semana. Na casa superior já apostam em quanto tempo mais.', 'You survived the first week. Up at the manor they\'re already betting on how much longer.') },
      { who: 'vesper', text: L('Para este bosque ser seu de verdade, três coisas. Primeiro, produção: quero 45 de Sangue por minuto saindo daqueles tanques.', 'For these woods to truly be yours, three things. First, production: I want 45 Blood per minute coming out of those tanks.') },
      { who: 'vesper', text: L('Segundo, alguém de confiança para cuidar daqui quando você partir. Um humano raro, transformado. Um Regente.', 'Second, someone trustworthy to run this place when you leave. A rare human, transformed. A Regent.') },
      { who: 'aureliano', text: L('E terceiro: a matilha de Ulf fora da trilha. Vença duas defesas sem perder ninguém e ele vai aparecer. Aí o derrubamos.', 'And third: Ulf\'s pack off the trail. Win two defenses without losing anyone and he\'ll show himself. Then we bring him down.') },
      { who: 'boris', text: L('Anotei tudo num quadro. O quadro se chama Domínio. Fica na coroa, lá em cima.', 'I wrote it all on a board. The board is called Domain. It lives in the crown, up top.') },
    ],
    nights: [
      [
        { who: 'boris', text: L('Achei mais uma página do caderno da sua tia. Estava dentro do forno. Não pergunte por que eu abri o forno.', 'I found another page of your aunt\'s notebook. It was inside the oven. Don\'t ask why I opened the oven.') },
        { who: 'davi', text: L('Ela escondia coisas em todo lugar. Menos onde o Conde procurava.', 'She hid things everywhere. Except where the Count looked.') },
      ],
      [
        { who: 'lia', text: L('Tem pegadas perto da cerca. Grandes. Mas andam em duas pernas até o portão… e em quatro depois.', 'There are footprints by the fence. Big ones. They walk on two legs up to the gate… and on four after.') },
        { who: 'aureliano', text: L('Lobos imitando humanos. Um truque velho.', 'Wolves imitating humans. An old trick.') },
        { who: 'lia', text: L('Ou humanos esquecendo como é ser humano.', 'Or humans forgetting how to be human.') },
      ],
      [
        { who: 'hematico', text: L('Curioso! A carruagem da Sangria saiu pela estrada sul. O castelo fica ao norte.', 'Curious! The Bloodletting carriage left by the south road. The castle is to the north.') },
        { who: 'vesper', text: L('O cocheiro é novo. Vai aprender o caminho.', 'The coachman is new. He\'ll learn the way.') },
      ],
      [
        { who: 'davi', text: L('Ontem à noite um lobo parou do outro lado da cerca e disse um nome. "Leonor."', 'Last night a wolf stopped on the other side of the fence and said a name. "Leonor."') },
        { who: 'davi', text: L('Lobos não falam. Então me diz: o que era aquilo?', 'Wolves don\'t talk. So tell me: what was that?') },
      ],
    ],
    regent: [{ who: 'vesper', text: L('Levante-se, Regente. Você agora serve à noite. E a mim, principalmente.', 'Rise, Regent. You serve the night now. And me, mostly.') }],
    cleared: [
      { who: 'ulf', text: L('Eu quebrei a cerca por ela… ela abriu o portão pra mim. Diga à Leonor que eu cumpri a promessa.', 'I broke the fence for her… she opened the gate for me. Tell Leonor I kept my promise.') },
      { who: 'aureliano', text: L('Ulf fugiu mancando para o norte. A trilha é nossa. Nenhum ataque mais nesta região.', 'Ulf limped off to the north. The trail is ours. No more attacks in this region.') },
      { who: 'davi', text: L('Ele sabia o nome da sua tia. Você ouviu, não ouviu?', 'He knew your aunt\'s name. You heard it, didn\'t you?') },
    ],
    ready: [{ who: 'vesper', text: L('Produção, Regente e trilha limpa. Toque na coroa e faça do Bosque Cinzento um Domínio da Casa.', 'Production, a Regent and a clean trail. Tap the crown and make the Grey Woods a Domain of the House.') }],
    look: { fog: 0x8ea6d8, motes: 0xd8ff8a, night: 0x050918, nightAlpha: 0.5 },
  },
  pantano: {
    title: L('Capítulo II · O Pântano Carmesim', 'Chapter II · The Crimson Marsh'), rate: 60,
    boss: { name: L('Grenda, a Afogada', 'Grenda the Drowned'), wolf: 'alpha', taunt: L('Grenda: A água lembra de todos que afundaram. Vai lembrar de vocês também.', 'Grenda: The water remembers everyone who sank. It will remember you too.') },
    intro: [
      { who: 'rubelia', text: L('Bem-vindo ao meu pântano favorito. O ar é úmido, o sangue é doce e os mosquitos têm padrões.', 'Welcome to my favorite marsh. The air is damp, the blood is sweet and the mosquitoes have standards.') },
      { who: 'hematico', text: L('A umidade deixa os humanos mais vigorosos! E mais famintos. Plante o dobro, eu imploro.', 'The damp makes humans more vigorous! And hungrier. Plant double, I beg you.') },
      { who: 'aureliano', text: L('Quem manda aqui é Grenda, a Afogada. A matilha dela avança pelas raias alagadas, onde a água atrasa todo mundo.', 'Grenda the Drowned rules here. Her pack pushes through the flooded lanes, where the water slows everyone.') },
      { who: 'vesper', text: L('Mesmas regras de conquista: 60 de Sangue por minuto, um Regente e Grenda no fundo do lodo.', 'Same conquest rules: 60 Blood per minute, a Regent and Grenda at the bottom of the mud.') },
    ],
    nights: [
      [
        { who: 'lia', text: L('Os mais velhos daqui contam que uma carruagem da Sangria virou no pântano, anos atrás. Ninguém achou os passageiros.', 'The elders here say a Bloodletting carriage overturned in the marsh, years ago. Nobody found the passengers.') },
        { who: 'boris', text: L('O registro diz "entrega extraviada". Com carimbo.', 'The record says "delivery misplaced". Stamped.') },
      ],
      [
        { who: 'rubelia', text: L('Querido, uma dica de amiga: não leia o que a sua tia escreveu. Conhecimento dá rugas.', 'Darling, a friendly tip: don\'t read what your aunt wrote. Knowledge causes wrinkles.') },
        { who: 'davi', text: L('Engraçado. Ninguém tinha falado pra ela do diário.', 'Funny. Nobody told her about the diary.') },
      ],
      [
        { who: 'hematico', text: L('Minhas amostras mostram um pico de "Vigília" toda vez que a carruagem parte. Algo em algum lugar… acorda um pouquinho.', 'My samples show a spike of "Vigil" every time the carriage leaves. Something somewhere… wakes up a little.') },
        { who: 'hematico', text: L('Não é da minha conta. É só fascinante. E aterrorizante. Mas principalmente fascinante.', 'It\'s none of my business. It\'s just fascinating. And terrifying. But mostly fascinating.') },
      ],
      [
        { who: 'aureliano', text: L('Grenda uivou a noite toda. Não era ameaça. Parecia… um nome sendo chamado.', 'Grenda howled all night. It wasn\'t a threat. It sounded like… a name being called.') },
      ],
    ],
    regent: [{ who: 'rubelia', text: L('Um Regente no pântano! Vou mandar flores. Carnívoras, naturalmente.', 'A Regent in the marsh! I\'ll send flowers. Carnivorous, naturally.') }],
    cleared: [
      { who: 'aureliano', text: L('Antes de afundar, ela disse: "Eu estava na carruagem. A água foi mais gentil que o destino."', 'Before she sank, she said: "I was in the carriage. The water was kinder than where it was going."') },
      { who: 'aureliano', text: L('Grenda voltou para a água, e desta vez não sobe mais. O pântano está quieto.', 'Grenda went back to the water, and this time she won\'t rise. The marsh is quiet.') },
    ],
    ready: [{ who: 'vesper', text: L('O Pântano Carmesim está pronto para ser nosso. A coroa espera.', 'The Crimson Marsh is ready to be ours. The crown awaits.') }],
    look: { fog: 0xc86a7a, motes: 0xff8a6a, night: 0x12060c, nightAlpha: 0.52 },
  },
  fronteira: {
    title: L('Capítulo III · A Fronteira da Lua Rasgada', 'Chapter III · The Torn Moon Frontier'), rate: 70,
    boss: { name: L('Korvus, o Rasgado', 'Korvus the Torn'), wolf: 'alpha', taunt: L('Korvus: Aureliano. Você ainda tem um olho. Vim resolver isso.', 'Korvus: Aureliano. You still have one eye. I came to fix that.') },
    intro: [
      { who: 'aureliano', text: L('Meu antigo posto. Aqui a lua cheia vem a cada três noites, e os lobos não pedem licença.', 'My old post. Here the full moon comes every three nights, and the wolves don\'t knock.') },
      { who: 'boris', text: L('Defensores custam menos nesta região. O jurídico chama de incentivo fiscal para a guerra.', 'Defenders cost less in this region. Legal calls it a tax incentive for war.') },
      { who: 'aureliano', text: L('Korvus, o Rasgado, comanda esta fronteira. Já me custou um olho. O outro eu pretendo manter.', 'Korvus the Torn commands this frontier. He already cost me an eye. I intend to keep the other.') },
      { who: 'vesper', text: L('70 de Sangue por minuto, um Regente e Korvus derrotado. Não se apegue à paisagem.', '70 Blood per minute, a Regent and Korvus defeated. Don\'t get attached to the scenery.') },
    ],
    nights: [
      [
        { who: 'aureliano', text: L('Eu tinha um escudeiro aqui. Um garoto humano. A Casa o transferiu para a linha de frente numa noite sem lua.', 'I had a squire here. A human boy. The House transferred him to the front line on a moonless night.') },
        { who: 'aureliano', text: L('Sem armas. Ordem assinada pelo Conde.', 'Unarmed. Order signed by the Count.') },
      ],
      [
        { who: 'davi', text: L('Aureliano tá diferente. Ontem ele me perguntou se eu dormia bem. Ninguém nunca me perguntou isso.', 'Aureliano\'s different. Yesterday he asked if I slept well. Nobody\'s ever asked me that.') },
      ],
      [
        { who: 'vesper', text: L('Soube que anda lendo papéis velhos. A Casa valoriza a curiosidade. Em doses pequenas. Muito pequenas.', 'I hear you\'ve been reading old papers. The House values curiosity. In small doses. Very small.') },
        { who: 'boris', text: L('Traduzindo: esconda melhor.', 'Translation: hide it better.') },
      ],
      [
        { who: 'aureliano', text: L('Korvus luta como eu ensinei. Esquerda baixa, depois o salto. Eu ensinei isso a uma única pessoa.', 'Korvus fights the way I taught. Low left, then the leap. I only ever taught that to one person.') },
      ],
    ],
    regent: [{ who: 'aureliano', text: L('Um Regente na fronteira. Ensine os humanos a trancar a porta. Duas vezes.', 'A Regent on the frontier. Teach the humans to lock the door. Twice.') }],
    cleared: [
      { who: 'aureliano', text: L('Ele caiu dizendo "mestre". Korvus era o meu escudeiro. A Casa o mandou morrer, e a floresta o recebeu.', 'He fell saying "master". Korvus was my squire. The House sent him to die, and the forest took him in.') },
      { who: 'aureliano', text: L('Pela primeira vez em cem anos, a fronteira dorme. Eu não.', 'For the first time in a hundred years, the frontier sleeps. I don\'t.') },
    ],
    ready: [{ who: 'vesper', text: L('A Fronteira é nossa. Aureliano está quieto demais. É perturbador.', 'The Frontier is ours. Aureliano is far too quiet. It\'s unsettling.') }],
    look: { fog: 0x9aa8ff, motes: 0xffb060, night: 0x060818, nightAlpha: 0.55 },
  },
  vale: {
    title: L('Capítulo IV · O Vale do Sol Fraco', 'Chapter IV · The Valley of the Weak Sun'), rate: 80,
    boss: { name: L('Sóror Branca', 'Sister White'), wolf: 'alpha', taunt: L('Sóror Branca: Paciência, crianças. A noite é longa e eu sou velha.', 'Sister White: Patience, children. The night is long and I am old.') },
    intro: [
      { who: 'vesper', text: L('O sol aqui nunca aquece de verdade. Os humanos nascem melhores, mas trabalham devagar.', 'The sun here never truly warms. Humans are born better, but work slowly.') },
      { who: 'lia', text: L('As famílias do vale são grandes. Se formarmos bons pares, os parentes chegam raros.', 'The valley families are big. If we make good pairs, the relatives arrive rare.') },
      { who: 'boris', text: L('O Fiscal da Casa Rubra visita o vale com frequência. Sugiro sorrir. De boca fechada.', 'The Inspector of House Rubra visits the valley often. I suggest smiling. With your mouth closed.') },
      { who: 'aureliano', text: L('A Sóror Branca guarda este vale. Uma loba velha e paciente. As piores.', 'Sister White guards this valley. An old, patient she-wolf. The worst kind.') },
      { who: 'vesper', text: L('80 de Sangue por minuto, um Regente e a Sóror. Sem pressa. Mas depressa.', '80 Blood per minute, a Regent and the Sister. No rush. But hurry.') },
    ],
    nights: [
      [
        { who: 'lia', text: L('A Sóror deixou flores brancas no portão. E um bilhete: "Ela aprendeu rápido. Você também vai."', 'The Sister left white flowers at the gate. And a note: "She learned fast. So will you."') },
      ],
      [
        { who: 'hematico', text: L('A Vigília subiu de novo. Calculo que, no ritmo das cotas, "algo" acorda por completo em… hmm. Prefiro não calcular.', 'The Vigil rose again. I estimate that, at the pace of the quotas, "something" fully wakes in… hmm. I\'d rather not estimate.') },
      ],
      [
        { who: 'davi', text: L('Se os lobos eram gente… quantos de nós viraram lobo? Quantos dos que "a carruagem levou"?', 'If the wolves were people… how many of us turned? How many of the ones "the carriage took"?') },
        { who: 'lia', text: L('Talvez seja melhor que o outro destino.', 'Maybe it\'s better than the other destination.') },
      ],
      [
        { who: 'vesper', text: L('Uma pergunta, administrador. Se tivesse que escolher entre a Casa e… sentimentalismos, o que escolheria?', 'A question, administrator. If you had to choose between the House and… sentimentality, which would you choose?') },
        { who: 'vesper', text: L('Não responda. Eu vou saber.', 'Don\'t answer. I\'ll know.') },
      ],
    ],
    regent: [{ who: 'lia', text: L('Ele era o mais gentil do vale. Agora é o mais gentil do vale, com presas.', 'He was the kindest in the valley. Now he\'s the kindest in the valley, with fangs.') }],
    cleared: [
      { who: 'aureliano', text: L('A Sóror não lutou até o fim. Ela sorriu e disse: "A mordida não é maldição. É a única porta que a Casa não tranca."', 'The Sister didn\'t fight to the end. She smiled and said: "The bite isn\'t a curse. It\'s the only door the House can\'t lock."') },
      { who: 'aureliano', text: L('A Sóror Branca se foi com a neblina. O vale finalmente respira.', 'Sister White left with the fog. The valley finally breathes.') },
    ],
    ready: [{ who: 'vesper', text: L('O Vale do Sol Fraco se curva. A coroa, por favor.', 'The Valley of the Weak Sun bows. The crown, please.') }],
    look: { fog: 0xe8e0c0, motes: 0xfff0a0, night: 0x0c0c14, nightAlpha: 0.4 },
  },
  costa: {
    title: L('Capítulo V · A Costa do Nevoeiro', 'Chapter V · The Fog Coast'), rate: 95,
    boss: { name: L('Capitão Presa-de-Sal', 'Captain Saltfang'), wolf: 'alpha', taunt: L('Capitão Presa-de-Sal: A maré trouxe vocês. A maré leva de volta.', 'Captain Saltfang: The tide brought you. The tide takes you back.') },
    intro: [
      { who: 'merchant', text: L('Ah, cliente! Na costa tudo se compra: humanos, silêncio, navios inteiros.', 'Ah, customer! On the coast everything is for sale: humans, silence, whole ships.') },
      { who: 'vesper', text: L('Contratos pagam melhor aqui. O castelo, naturalmente, cobra mais Sangria. Equilíbrio.', 'Contracts pay better here. The castle, naturally, charges more Bloodletting. Balance.') },
      { who: 'aureliano', text: L('O Capitão Presa-de-Sal chega com a maré e sai com a nossa gente. Não desta vez.', 'Captain Saltfang arrives with the tide and leaves with our people. Not this time.') },
      { who: 'vesper', text: L('95 de Sangue por minuto, um Regente e o capitão afundado.', '95 Blood per minute, a Regent and the captain sunk.') },
    ],
    nights: [
      [
        { who: 'merchant', text: L('Psiu. O Capitão não rouba humanos, cliente. Ele leva quem quer ir. Para ilhas onde nenhuma Casa manda.', 'Psst. The Captain doesn\'t steal humans, customer. He takes those who want to go. To islands no House rules.') },
        { who: 'merchant', text: L('Sua tia comprava passagens. Muitas. Pagava em frascos.', 'Your aunt bought passages. Many. Paid in vials.') },
      ],
      [
        { who: 'boris', text: L('Recebemos um pedido oficial da Cripta: dobrar a Sangria "em caráter de urgência". Assinado por alguém chamado "Ancião".', 'We got an official request from the Crypt: double the Bloodletting "as a matter of urgency". Signed by someone called "Elder".') },
        { who: 'boris', text: L('Nunca vi o Conde tremer ao ler um papel. Hoje vi.', 'I\'ve never seen the Count tremble reading a paper. Today I did.') },
      ],
      [
        { who: 'davi', text: L('Eu li o diário todo que você deixou na mesa. Desculpa. Não desculpa.', 'I read all the diary you left on the table. Sorry. Not sorry.') },
        { who: 'davi', text: L('Quando chegar a hora, eu sei de que lado eu fico. E você?', 'When the time comes, I know which side I\'m on. Do you?') },
      ],
    ],
    regent: [{ who: 'merchant', text: L('Um Regente na costa! Negócios, negócios. Aceita encomendas?', 'A Regent on the coast! Business, business. Taking orders?') }],
    cleared: [
      { who: 'aureliano', text: L('O Capitão afundou rindo: "O último barco já partiu. Com eles a bordo. A Casa nunca vai achá-los."', 'The Captain sank laughing: "The last boat already left. With them aboard. The House will never find them."') },
      { who: 'aureliano', text: L('A costa é só nevoeiro agora. E, pela primeira vez, eu torço por um barco que não vejo.', 'The coast is only fog now. And for the first time, I\'m rooting for a boat I can\'t see.') },
    ],
    ready: [{ who: 'vesper', text: L('A Costa do Nevoeiro é da Casa. Falta pouco para o fim da história. Ou o começo.', 'The Fog Coast belongs to the House. The end of the story is near. Or the beginning.') }],
    look: { fog: 0xa0c8e8, motes: 0xc8e8ff, night: 0x04101a, nightAlpha: 0.5 },
  },
  cripta: {
    title: L('Capítulo VI · A Cripta de Vesper', 'Chapter VI · Vesper\'s Crypt'), rate: 110,
    boss: { name: L('A Mãe da Matilha', 'The Pack Mother'), wolf: 'mother', taunt: L('A floresta inteira uivou. Ela veio pessoalmente.', 'The whole forest howled. She came in person.') },
    intro: [
      { who: 'vesper', text: L('Minha família dorme aqui embaixo. Não os acorde. Sério.', 'My family sleeps down here. Don\'t wake them. I mean it.') },
      { who: 'hematico', text: L('As pesquisas andam 40% mais rápido aqui! É o ambiente. Ou os fantasmas ajudando.', 'Research runs 40% faster here! It\'s the atmosphere. Or the ghosts helping.') },
      { who: 'aureliano', text: L('Tudo o que a floresta tem de pior veio atrás de nós. A Mãe da Matilha em pessoa.', 'Everything the forest has at its worst came after us. The Pack Mother herself.') },
      { who: 'vesper', text: L('110 de Sangue por minuto, um Regente e o fim da matilha. Depois disso, a Casa é eterna.', '110 Blood per minute, a Regent and the end of the pack. After that, the House is eternal.') },
    ],
    nights: [
      [
        { who: 'hematico', text: L('Os tubos! Todos os tanques de todas as fazendas descem para cá. Para os caixões. A Vigília está em 97%.', 'The pipes! Every tank from every farm runs down here. Into the coffins. The Vigil is at 97%.') },
        { who: 'vesper', text: L('Doutor. Silêncio.', 'Doctor. Silence.') },
      ],
      [
        { who: 'vesper', text: L('Sim, eles vão acordar. Quando acordarem, a Casa não vai mais precisar de fazendas. Vai precisar de cidades.', 'Yes, they will wake. When they do, the House won\'t need farms anymore. It will need cities.') },
        { who: 'vesper', text: L('E quem estiver ao meu lado nesse dia será nobre para sempre. Pense nisso.', 'And whoever stands by my side that day will be noble forever. Think about it.') },
      ],
      [
        { who: 'lia', text: L('Hoje um lobo grande e grisalho ficou olhando a Casa das Famílias. Não atacou. Só olhou. Como quem sente saudade.', 'Today a big grey wolf stood watching the Family House. It didn\'t attack. It just looked. Like someone missing home.') },
      ],
      [
        { who: 'davi', text: L('Ela está vindo. Todo mundo sente. Os humanos, os lobos, até o Bóris.', 'She\'s coming. Everyone feels it. The humans, the wolves, even Boris.') },
        { who: 'boris', text: L('Eu não sinto nada. Por contrato.', 'I feel nothing. By contract.') },
      ],
    ],
    regent: [{ who: 'vesper', text: L('Um Regente para a cripta da minha família. Não mexa nos retratos.', 'A Regent for my family\'s crypt. Don\'t touch the portraits.') }],
    cleared: [
      { who: 'aureliano', text: L('A Mãe da Matilha caiu. Nenhuma outra loba vai uivar para esta Casa.', 'The Pack Mother has fallen. No other she-wolf will howl at this House.') },
    ],
    ready: [{ who: 'vesper', text: L('A última região. Conquiste-a e a Casa Rubra inteira terá que nos ouvir.', 'The last region. Conquer it and all of House Rubra will have to listen to us.') }],
    look: { fog: 0x9a6ac8, motes: 0xc88aff, night: 0x0a0414, nightAlpha: 0.55 },
  },
};

export const REGENT_COST = { prestige: 40, blood: 200 };
export const CLEAN_WINS = 2;          // defenses without losses before the region's alpha shows up
export const DOMAIN_LEGACY_H = 8;     // Legacy per hour from each Domain (also offline, up to 24 h)
