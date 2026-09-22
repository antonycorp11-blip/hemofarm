// Ambient speech-bubble lines by human state (GDD §6.3, §18.1, Anexo B). Data only, ready for localization.
export type BubbleState =
  | 'idle' | 'hungry' | 'well_fed' | 'queued_collection' | 'recovering'
  | 'high_morale' | 'low_morale' | 'sleepy'
  | 'carriage' | 'taken' | 'tithe_paid' | 'tithe_failed' | 'boarding';

export const LINES: Record<BubbleState, string[]> = {
  idle: [
    'O jantar estava bom. O plano de carreira continua preocupante.',
    'Alguém sabe se o castelo aceita devolução?',
    'Dia bonito. Quer dizer, noite. Sempre noite.',
    'Me disseram que aqui tinha plano de saúde. Era plano de sangue.',
  ],
  hungry: [
    'Alguém avisa a cozinha que o estoque também come?',
    'Minha fome está mais organizada que esta fazenda.',
    'Fome não é reclamação. É relatório.',
  ],
  well_fed: [
    'Comida quente, cama seca, futuro terrível. Dois de três.',
    'Se isso é engorda, admito: profissional.',
  ],
  queued_collection: [
    'De novo? Meu cartão fidelidade pelo menos dá brinde?',
    'Tenho certeza de que ontem eu tinha mais cor no rosto.',
    'Que bom. O vermelho chegou na linha. Posso sentar agora?',
  ],
  recovering: [
    'Estou vendo duas luas. Uma deve ser bônus.',
    'Se eu desmaiar, anotem como pausa para o café.',
  ],
  high_morale: [
    'Se sobrevivermos à semana, churrasco. Sem convidados vampiros.',
    'Não é liberdade, mas melhoraram o colchão. Vitória parcial.',
  ],
  low_morale: [
    "Toda vez que alguém fala 'eficiência', alguma coisa piora.",
    "A placa diz 'bem-estar'. Gosto de ficção.",
  ],
  carriage: [
    'Muita carruagem hoje. Nunca é um bom sinal.',
    'Olha o castelo mandando buscar o pedido.',
    'Alguém conferiu se a cota bateu? Pergunto por mim.',
  ],
  taken: [
    'Se perguntarem, sempre quis conhecer o castelo.',
    'Acho que fui promovido. Para fora da fazenda.',
    'Guardem meu lugar na fila. Brincadeira. Não guardem.',
  ],
  boarding: [
    'Fui escolhido. Ainda não sei se é elogio.',
    'Se perguntarem, sempre quis conhecer o castelo.',
    'Pátio de Embarque. O nome já diz tudo, e não diz nada de bom.',
  ],
  tithe_paid: [
    'Cota batida. Parabéns a nós, eu acho.',
    'A carruagem foi embora vazia de gente. Melhor noite da semana.',
  ],
  tithe_failed: [
    'Alguém faltou com a meta. E a meta não falta com ninguém.',
    'Menos um no café da manhã. O pão rende mais, pelo menos.',
  ],
  sleepy: [
    'Vou deitar. Se me coletarem dormindo, não quero saber.',
    'Turno encerrado. Não que alguém tenha perguntado.',
  ],
};
