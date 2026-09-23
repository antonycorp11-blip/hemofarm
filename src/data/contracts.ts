// Buyer contracts (GDD §10). A contract asks for N humans matching a profile; delivering them through the
// Boarding Yard sells them (they leave the farm) for Gold + Prestige.
import type { BloodType, Quality, Temper, Trait } from './humans';
import type { Speaker } from './tutorial';

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

export const BUYER_NAMES: Record<ContractDef['buyer'], string> = {
  rubelia: 'Lady Rubélia', hematico: 'Dr. Hemático', vesper: 'Conde Vesper', boris: 'Bóris', davi: 'Davi', lia: 'Lia',
  aureliano: 'Sir Aureliano', merchant: 'Mercador de Sangue', inspector: 'Fiscal da Casa Rubra',
};

export const CONTRACTS: ContractDef[] = [
  {
    id: 'rub_recepcao', buyer: 'rubelia', title: 'Uma pequena recepção', count: 2,
    req: { blood: 'rubra', minMorale: 50 }, reward: { gold: 250, prestige: 10 }, nights: 2, tutorialOnly: true,
    intro: 'Tenho uma pequena recepção. Apenas oitenta convidados. Preciso de dois Rubra, bem alimentados e com moral acima de 50.',
    done: 'Perfeito. Qualidade premium. E sem aquele olhar de ressentimento — quase.',
  },
  {
    id: 'rub_intima', buyer: 'rubelia', title: 'Recepção íntima', count: 3,
    req: { blood: 'lunar', minMorale: 60, minQuality: 'especial' }, reward: { gold: 650, prestige: 22 }, nights: 3,
    intro: 'Uma festa de apenas cento e vinte convidados. Três Lunar, moral acima de 60 e, se não for pedir demais, capazes de usar talheres.',
    done: 'Excelente. Pálidos, educados e moderadamente resignados.',
  },
  {
    id: 'rub_escandalos', buyer: 'rubelia', title: 'Sem escândalos desta vez', count: 2,
    req: { temper: 'calmo' }, reward: { gold: 320, prestige: 12 }, nights: 2,
    intro: 'O último fornecedor me mandou convidados barulhentos. Dois humanos Calmos, por favor. Silêncio é elegância.',
    done: 'Nenhum grito, nenhuma queixa. Quase me emocionei.',
  },
  {
    id: 'hem_amostras', buyer: 'hematico', title: 'Amostras que piscam', count: 1,
    req: { trait: 'lunar' }, reward: { gold: 450, prestige: 15 }, nights: 3,
    intro: 'Preciso de um humano com Ressonância Lunar! Para a ciência. E para um frasco muito específico.',
    done: 'Brilha! Ele brilha! Isso reduz as possibilidades de desastre para sete.',
  },
  {
    id: 'hem_especiado', buyer: 'hematico', title: 'Notas de canela', count: 1,
    req: { trait: 'especiado' }, reward: { gold: 420, prestige: 14 }, nights: 3,
    intro: 'Dizem que existe sangue com notas de canela. Quero comprovar. Cientificamente. Com uma taça.',
    done: 'Canela, pimenta e um leve arrependimento. Fascinante.',
  },
  {
    id: 'mer_lote', buyer: 'merchant', title: 'Lote para a caravana', count: 3,
    req: {}, reward: { gold: 200, prestige: 4 }, nights: 2,
    intro: 'Três unidades quaisquer, sem perguntas. Pago pouco, mas pago rápido.',
    done: 'Negócio fechado. A caravana parte antes do amanhecer.',
  },
  {
    id: 'mer_ambar', buyer: 'merchant', title: 'Âmbar para exportação', count: 2,
    req: { blood: 'ambar' }, reward: { gold: 300, prestige: 8 }, nights: 2,
    intro: 'Os barões do sul só bebem Âmbar. Dois, por favor, e bem embalados.',
    done: 'Âmbar legítimo. Os barões ficarão insuportáveis de satisfeitos.',
  },
  {
    id: 'vip_carmesim', buyer: 'vesper', title: 'Cliente VIP', count: 1,
    req: { blood: 'carmesim' }, reward: { gold: 1000, prestige: 35 }, nights: 3,
    intro: 'Um membro da casa superior deseja um Carmesim. Não pergunte qual. Não recuse.',
    done: 'A casa superior está satisfeita. Isso é raro. Aproveite.',
  },
];

export const MAX_OFFERS = 3;
