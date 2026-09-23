// Story (GDD_ADENDO A8): one chapter per region. Each chapter is won by conquering the region: production, a vampire
// Regent to rule it in your place, and its werewolf pack defeated. A conquered region becomes a Domain of the House.
import type { Line } from './tutorial';
import type { RegionId } from './regions';
import type { WolfId } from './battle';

export interface Chapter {
  title: string;
  rate: number;                                   // Blood per minute the region must reach
  boss: { name: string; wolf: WolfId; taunt: string };
  intro: Line[];
  regent: Line[];                                 // after the transformation
  cleared: Line[];                                // after the boss falls
  ready: Line[];                                  // all three pillars done
  look: { fog: number; motes: number; night: number; nightAlpha: number }; // region atmosphere
}

export const CHAPTERS: Record<RegionId, Chapter> = {
  bosque: {
    title: 'Capítulo I · O Bosque Cinzento', rate: 45,
    boss: { name: 'Ulf Quebra-Cerca', wolf: 'alpha', taunt: 'Ulf: Então é você o novo vizinho. Vamos ver quanto tempo dura a cerca.' },
    intro: [
      { who: 'vesper', text: 'Você sobreviveu à primeira semana. Na casa superior já apostam em quanto tempo mais.' },
      { who: 'vesper', text: 'Para este bosque ser seu de verdade, três coisas. Primeiro, produção: quero 45 de Sangue por minuto saindo daqueles tanques.' },
      { who: 'vesper', text: 'Segundo, alguém de confiança para cuidar daqui quando você partir. Um humano raro, transformado. Um Regente.' },
      { who: 'aureliano', text: 'E terceiro: a matilha de Ulf fora da trilha. Vença duas defesas sem perder ninguém e ele vai aparecer. Aí o derrubamos.' },
      { who: 'boris', text: 'Anotei tudo num quadro. O quadro se chama Domínio. Fica na coroa, lá em cima.' },
    ],
    regent: [{ who: 'vesper', text: 'Levante-se, Regente. Você agora serve à noite. E a mim, principalmente.' }],
    cleared: [{ who: 'aureliano', text: 'Ulf fugiu mancando para o norte. A trilha é nossa. Nenhum ataque mais nesta região.' }],
    ready: [{ who: 'vesper', text: 'Produção, Regente e trilha limpa. Toque na coroa e faça do Bosque Cinzento um Domínio da Casa.' }],
    look: { fog: 0x8ea6d8, motes: 0xd8ff8a, night: 0x050918, nightAlpha: 0.5 },
  },
  pantano: {
    title: 'Capítulo II · O Pântano Carmesim', rate: 60,
    boss: { name: 'Grenda, a Afogada', wolf: 'alpha', taunt: 'Grenda: A água lembra de todos que afundaram. Vai lembrar de vocês também.' },
    intro: [
      { who: 'rubelia', text: 'Bem-vindo ao meu pântano favorito. O ar é úmido, o sangue é doce e os mosquitos têm padrões.' },
      { who: 'hematico', text: 'A umidade deixa os humanos mais vigorosos! E mais famintos. Plante o dobro, eu imploro.' },
      { who: 'aureliano', text: 'Quem manda aqui é Grenda, a Afogada. A matilha dela avança pelas raias alagadas, onde a água atrasa todo mundo.' },
      { who: 'vesper', text: 'Mesmas regras de conquista: 60 de Sangue por minuto, um Regente e Grenda no fundo do lodo.' },
    ],
    regent: [{ who: 'rubelia', text: 'Um Regente no pântano! Vou mandar flores. Carnívoras, naturalmente.' }],
    cleared: [{ who: 'aureliano', text: 'Grenda voltou para a água, e desta vez não sobe mais. O pântano está quieto.' }],
    ready: [{ who: 'vesper', text: 'O Pântano Carmesim está pronto para ser nosso. A coroa espera.' }],
    look: { fog: 0xc86a7a, motes: 0xff8a6a, night: 0x12060c, nightAlpha: 0.52 },
  },
  fronteira: {
    title: 'Capítulo III · A Fronteira da Lua Rasgada', rate: 70,
    boss: { name: 'Korvus, o Rasgado', wolf: 'alpha', taunt: 'Korvus: Aureliano. Você ainda tem um olho. Vim resolver isso.' },
    intro: [
      { who: 'aureliano', text: 'Meu antigo posto. Aqui a lua cheia vem a cada três noites, e os lobos não pedem licença.' },
      { who: 'boris', text: 'Defensores custam menos nesta região. O jurídico chama de incentivo fiscal para a guerra.' },
      { who: 'aureliano', text: 'Korvus, o Rasgado, comanda esta fronteira. Já me custou um olho. O outro eu pretendo manter.' },
      { who: 'vesper', text: '70 de Sangue por minuto, um Regente e Korvus derrotado. Não se apegue à paisagem.' },
    ],
    regent: [{ who: 'aureliano', text: 'Um Regente na fronteira. Ensine os humanos a trancar a porta. Duas vezes.' }],
    cleared: [{ who: 'aureliano', text: 'Korvus caiu. Pela primeira vez em cem anos, a fronteira dorme.' }],
    ready: [{ who: 'vesper', text: 'A Fronteira é nossa. Aureliano está quase sorrindo. É perturbador.' }],
    look: { fog: 0x9aa8ff, motes: 0xffb060, night: 0x060818, nightAlpha: 0.55 },
  },
  vale: {
    title: 'Capítulo IV · O Vale do Sol Fraco', rate: 80,
    boss: { name: 'Sóror Branca', wolf: 'alpha', taunt: 'Sóror Branca: Paciência, crianças. A noite é longa e eu sou velha.' },
    intro: [
      { who: 'vesper', text: 'O sol aqui nunca aquece de verdade. Os humanos nascem melhores, mas trabalham devagar.' },
      { who: 'lia', text: 'As famílias do vale são grandes. Se formarmos bons pares, os parentes chegam raros.' },
      { who: 'boris', text: 'O Fiscal da Casa Rubra visita o vale com frequência. Sugiro sorrir. De boca fechada.' },
      { who: 'aureliano', text: 'A Sóror Branca guarda este vale. Uma loba velha e paciente. As piores.' },
      { who: 'vesper', text: '80 de Sangue por minuto, um Regente e a Sóror. Sem pressa. Mas depressa.' },
    ],
    regent: [{ who: 'lia', text: 'Ele era o mais gentil do vale. Agora é o mais gentil do vale, com presas.' }],
    cleared: [{ who: 'aureliano', text: 'A Sóror Branca se foi com a neblina. O vale finalmente respira.' }],
    ready: [{ who: 'vesper', text: 'O Vale do Sol Fraco se curva. A coroa, por favor.' }],
    look: { fog: 0xe8e0c0, motes: 0xfff0a0, night: 0x0c0c14, nightAlpha: 0.4 },
  },
  costa: {
    title: 'Capítulo V · A Costa do Nevoeiro', rate: 95,
    boss: { name: 'Capitão Presa-de-Sal', wolf: 'alpha', taunt: 'Capitão Presa-de-Sal: A maré trouxe vocês. A maré leva de volta.' },
    intro: [
      { who: 'merchant', text: 'Ah, cliente! Na costa tudo se compra: humanos, silêncio, navios inteiros.' },
      { who: 'vesper', text: 'Contratos pagam melhor aqui. O castelo, naturalmente, cobra mais Sangria. Equilíbrio.' },
      { who: 'aureliano', text: 'O Capitão Presa-de-Sal chega com a maré e sai com a nossa gente. Não desta vez.' },
      { who: 'vesper', text: '95 de Sangue por minuto, um Regente e o capitão afundado.' },
    ],
    regent: [{ who: 'merchant', text: 'Um Regente na costa! Negócios, negócios. Aceita encomendas?' }],
    cleared: [{ who: 'aureliano', text: 'O Capitão afundou com o próprio navio. A costa é só nevoeiro agora.' }],
    ready: [{ who: 'vesper', text: 'A Costa do Nevoeiro é da Casa. Falta pouco para o fim da história. Ou o começo.' }],
    look: { fog: 0xa0c8e8, motes: 0xc8e8ff, night: 0x04101a, nightAlpha: 0.5 },
  },
  cripta: {
    title: 'Capítulo VI · A Cripta de Vesper', rate: 110,
    boss: { name: 'A Mãe da Matilha', wolf: 'mother', taunt: 'A floresta inteira uivou. Ela veio pessoalmente.' },
    intro: [
      { who: 'vesper', text: 'Minha família dorme aqui embaixo. Não os acorde. Sério.' },
      { who: 'hematico', text: 'As pesquisas andam 40% mais rápido aqui! É o ambiente. Ou os fantasmas ajudando.' },
      { who: 'aureliano', text: 'Tudo o que a floresta tem de pior veio atrás de nós. A Mãe da Matilha em pessoa.' },
      { who: 'vesper', text: '110 de Sangue por minuto, um Regente e o fim da matilha. Depois disso, a Casa é eterna.' },
    ],
    regent: [{ who: 'vesper', text: 'Um Regente para a cripta da minha família. Não mexa nos retratos.' }],
    cleared: [{ who: 'aureliano', text: 'A Mãe da Matilha caiu. Nenhuma outra loba vai uivar para esta Casa.' }],
    ready: [{ who: 'vesper', text: 'A última região. Conquiste-a e a Casa Rubra inteira terá que nos ouvir.' }],
    look: { fog: 0x9a6ac8, motes: 0xc88aff, night: 0x0a0414, nightAlpha: 0.55 },
  },
};

export const REGENT_COST = { prestige: 40, blood: 200 };
export const CLEAN_WINS = 2;          // defenses without losses before the region's alpha shows up
export const DOMAIN_LEGACY_H = 8;     // Legacy per hour from each Domain (also offline, up to 24 h)
