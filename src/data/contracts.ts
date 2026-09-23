// Buyer contracts (GDD §10). A contract asks for N humans matching a profile; delivering them through the
// Boarding Yard sells them (they leave the farm) for Gold + Prestige.
import type { BloodType, Quality, Temper, Trait } from './humans';
import { SPEAKERS, type Speaker } from './tutorial';
import { L } from '../core/i18n';

export interface Requirement { blood?: BloodType; minQuality?: Quality; temper?: Temper; trait?: Trait; minMorale?: number }

export interface ContractDef {
  id: string;
  buyer: Speaker | 'merchant';
  title: string;
  count: number;
  req: Requirement;
  reward: { gold: number; prestige: number };
  nights: number;             // deadline, in nights after accepting
  intro: string;              // buyer's line when offered
  done: string;               // line on delivery
  tutorialOnly?: boolean;
}

export const BUYER_NAMES: Record<ContractDef['buyer'], string> = SPEAKERS;

export const CONTRACTS: ContractDef[] = [
  {
    id: 'rub_recepcao', buyer: 'rubelia', title: L('Uma pequena recepção', 'A small reception'), count: 2,
    req: { blood: 'rubra', minMorale: 50 }, reward: { gold: 250, prestige: 10 }, nights: 2, tutorialOnly: true,
    intro: L('Tenho uma pequena recepção. Apenas oitenta convidados. Preciso de dois Rubra, bem alimentados e com moral acima de 50.', 'I\'m hosting a small reception. Only eighty guests. I need two Rubra, well fed and with morale above 50.'),
    done: L('Perfeito. Qualidade premium. E sem aquele olhar de ressentimento — quase.', 'Perfect. Premium quality. And without that resentful look — almost.'),
  },
  {
    id: 'rub_intima', buyer: 'rubelia', title: L('Recepção íntima', 'An intimate reception'), count: 3,
    req: { blood: 'lunar', minMorale: 60, minQuality: 'especial' }, reward: { gold: 650, prestige: 22 }, nights: 3,
    intro: L('Uma festa de apenas cento e vinte convidados. Três Lunar, moral acima de 60 e, se não for pedir demais, capazes de usar talheres.', 'A party of only a hundred and twenty guests. Three Lunar, morale above 60 and, if it isn\'t too much to ask, able to use cutlery.'),
    done: L('Excelente. Pálidos, educados e moderadamente resignados.', 'Excellent. Pale, polite and moderately resigned.'),
  },
  {
    id: 'rub_escandalos', buyer: 'rubelia', title: L('Sem escândalos desta vez', 'No scandals this time'), count: 2,
    req: { temper: 'calmo' }, reward: { gold: 320, prestige: 12 }, nights: 2,
    intro: L('O último fornecedor me mandou convidados barulhentos. Dois humanos Calmos, por favor. Silêncio é elegância.', 'The last supplier sent me noisy guests. Two Calm humans, please. Silence is elegance.'),
    done: L('Nenhum grito, nenhuma queixa. Quase me emocionei.', 'No screams, no complaints. I was almost moved.'),
  },
  {
    id: 'hem_amostras', buyer: 'hematico', title: L('Amostras que piscam', 'Samples that twinkle'), count: 1,
    req: { trait: 'lunar' }, reward: { gold: 450, prestige: 15 }, nights: 3,
    intro: L('Preciso de um humano com Ressonância Lunar! Para a ciência. E para um frasco muito específico.', 'I need a human with Lunar Resonance! For science. And for a very specific flask.'),
    done: L('Brilha! Ele brilha! Isso reduz as possibilidades de desastre para sete.', 'It glows! He glows! That narrows the possible disasters down to seven.'),
  },
  {
    id: 'hem_especiado', buyer: 'hematico', title: L('Notas de canela', 'Notes of cinnamon'), count: 1,
    req: { trait: 'especiado' }, reward: { gold: 420, prestige: 14 }, nights: 3,
    intro: L('Dizem que existe sangue com notas de canela. Quero comprovar. Cientificamente. Com uma taça.', 'They say there\'s blood with notes of cinnamon. I want to verify it. Scientifically. With a glass.'),
    done: L('Canela, pimenta e um leve arrependimento. Fascinante.', 'Cinnamon, pepper and a hint of regret. Fascinating.'),
  },
  {
    id: 'mer_lote', buyer: 'merchant', title: L('Lote para a caravana', 'A lot for the caravan'), count: 3,
    req: {}, reward: { gold: 200, prestige: 4 }, nights: 2,
    intro: L('Três unidades quaisquer, sem perguntas. Pago pouco, mas pago rápido.', 'Any three units, no questions. I pay little, but I pay fast.'),
    done: L('Negócio fechado. A caravana parte antes do amanhecer.', 'Deal done. The caravan leaves before dawn.'),
  },
  {
    id: 'mer_ambar', buyer: 'merchant', title: L('Âmbar para exportação', 'Amber for export'), count: 2,
    req: { blood: 'ambar' }, reward: { gold: 300, prestige: 8 }, nights: 2,
    intro: L('Os barões do sul só bebem Âmbar. Dois, por favor, e bem embalados.', 'The southern barons only drink Amber. Two, please, well packed.'),
    done: L('Âmbar legítimo. Os barões ficarão insuportáveis de satisfeitos.', 'Genuine Amber. The barons will be unbearably pleased.'),
  },
  {
    id: 'vip_carmesim', buyer: 'vesper', title: L('Cliente VIP', 'VIP client'), count: 1,
    req: { blood: 'carmesim' }, reward: { gold: 1000, prestige: 35 }, nights: 3,
    intro: L('Um membro da casa superior deseja um Carmesim. Não pergunte qual. Não recuse.', 'A member of the upper house wants a Crimson. Don\'t ask which. Don\'t refuse.'),
    done: L('A casa superior está satisfeita. Isso é raro. Aproveite.', 'The upper house is satisfied. That\'s rare. Enjoy it.'),
  },
];

export const MAX_OFFERS = 3;
