// Ambient speech-bubble lines by human state (GDD §6.3, §18.1, Anexo B). Data only, [português, english] pairs.
import { L } from '../core/i18n';

export type BubbleState =
  | 'idle' | 'hungry' | 'well_fed' | 'queued_collection' | 'recovering'
  | 'high_morale' | 'low_morale' | 'sleepy'
  | 'carriage' | 'taken' | 'tithe_paid' | 'tithe_failed' | 'boarding' | 'bond' | 'arranged' | 'heir' | 'rebellion' | 'cheer' | 'custom';

const T = (pairs: [string, string][]) => pairs.map(([pt, en]) => L(pt, en));

export const LINES: Record<BubbleState, string[]> = {
  idle: T([
    ['O jantar estava bom. O plano de carreira continua preocupante.', 'Dinner was good. The career plan is still worrying.'],
    ['Alguém sabe se o castelo aceita devolução?', 'Does anyone know if the castle accepts returns?'],
    ['Dia bonito. Quer dizer, noite. Sempre noite.', 'Lovely day. I mean, night. Always night.'],
    ['Me disseram que aqui tinha plano de saúde. Era plano de sangue.', 'They told me there was a health plan here. It was a blood plan.'],
    ['A antiga administradora dava bom dia. Às vezes até bom sangue.', 'The old administrator used to say good morning. Sometimes even good blood.'],
  ]),
  hungry: T([
    ['Alguém avisa a cozinha que o estoque também come?', 'Can someone tell the kitchen the stock eats too?'],
    ['Minha fome está mais organizada que esta fazenda.', 'My hunger is better organized than this farm.'],
    ['Fome não é reclamação. É relatório.', 'Hunger isn\'t a complaint. It\'s a report.'],
  ]),
  well_fed: T([
    ['Comida quente, cama seca, futuro terrível. Dois de três.', 'Hot food, dry bed, terrible future. Two out of three.'],
    ['Se isso é engorda, admito: profissional.', 'If this is fattening, I admit it: professional.'],
  ]),
  queued_collection: T([
    ['De novo? Meu cartão fidelidade pelo menos dá brinde?', 'Again? Does my loyalty card at least get a freebie?'],
    ['Tenho certeza de que ontem eu tinha mais cor no rosto.', 'I\'m sure I had more color in my face yesterday.'],
    ['Que bom. O vermelho chegou na linha. Posso sentar agora?', 'Great. The red reached the line. Can I sit down now?'],
  ]),
  recovering: T([
    ['Estou vendo duas luas. Uma deve ser bônus.', 'I\'m seeing two moons. One must be a bonus.'],
    ['Se eu desmaiar, anotem como pausa para o café.', 'If I faint, log it as a coffee break.'],
  ]),
  high_morale: T([
    ['Se sobrevivermos à semana, churrasco. Sem convidados vampiros.', 'If we survive the week, barbecue. No vampire guests.'],
    ['Não é liberdade, mas melhoraram o colchão. Vitória parcial.', 'It\'s not freedom, but the mattress got better. Partial victory.'],
  ]),
  low_morale: T([
    ['Toda vez que alguém fala "eficiência", alguma coisa piora.', 'Every time someone says "efficiency", something gets worse.'],
    ['A placa diz "bem-estar". Gosto de ficção.', 'The sign says "wellness". I do enjoy fiction.'],
  ]),
  carriage: T([
    ['Muita carruagem hoje. Nunca é um bom sinal.', 'Lots of carriages today. Never a good sign.'],
    ['Olha o castelo mandando buscar o pedido.', 'Look, the castle sent for its order.'],
    ['Alguém conferiu se a cota bateu? Pergunto por mim.', 'Did anyone check if we made quota? Asking for myself.'],
    ['Por que ela vira para o sul? O castelo fica ao norte.', 'Why does it turn south? The castle is to the north.'],
  ]),
  taken: T([
    ['Se perguntarem, sempre quis conhecer o castelo.', 'If anyone asks, I always wanted to see the castle.'],
    ['Acho que fui promovido. Para fora da fazenda.', 'I think I got promoted. Off the farm.'],
    ['Guardem meu lugar na fila. Brincadeira. Não guardem.', 'Save my place in line. Kidding. Don\'t.'],
  ]),
  boarding: T([
    ['Fui escolhido. Ainda não sei se é elogio.', 'I was chosen. Not sure yet if it\'s a compliment.'],
    ['Se perguntarem, sempre quis conhecer o castelo.', 'If anyone asks, I always wanted to see the castle.'],
    ['Pátio de Embarque. O nome já diz tudo, e não diz nada de bom.', 'Boarding Yard. The name says it all, and none of it good.'],
  ]),
  bond: T([
    ['Acho que encontrei alguém. Ou alguém me encontrou na fila.', 'I think I found someone. Or someone found me in line.'],
    ['Não é o fim do mundo se for com você. Quer dizer, é, mas melhora.', 'It\'s not the end of the world if it\'s with you. I mean, it is, but it helps.'],
    ['Dividimos o colchão ruim. É praticamente um noivado.', 'We share the bad mattress. It\'s practically an engagement.'],
  ]),
  arranged: T([
    ['Fomos "registrados como parceria estratégica". Que romântico.', 'We\'ve been "registered as a strategic partnership". How romantic.'],
    ['Um vampiro escolheu meu par. Honestamente, gosto mais do que da minha tia escolhendo.', 'A vampire picked my partner. Honestly, better than my aunt picking.'],
  ]),
  heir: T([
    ['Cheguei. Me disseram que aqui tinha família. E contrato.', 'I\'m here. They told me there was family. And a contract.'],
    ['Oi, parentes! Por que todo mundo está pálido? Ah.', 'Hi, relatives! Why is everyone so pale? Oh.'],
    ['Recebi uma carta dizendo "venha, a comida é garantida". Tecnicamente não mentiram.', 'I got a letter saying "come, food is guaranteed". Technically they didn\'t lie.'],
  ]),
  rebellion: T([
    ['Não queremos o impossível. Começamos por colchões.', 'We don\'t want the impossible. We\'ll start with mattresses.'],
    ['A pauta tem sete itens. O oitavo é não sumir misteriosamente.', 'The agenda has seven items. The eighth is not disappearing mysteriously.'],
    ['Defendam o estoque! Espera. Nós somos o estoque.', 'Defend the stock! Wait. We are the stock.'],
    ['Colheita justa para quem é colhido!', 'Fair harvest for the harvested!'],
  ]),
  cheer: T([
    ['Hoje ninguém sumiu. Isso é festa.', 'Nobody disappeared today. That\'s a party.'],
    ['Se sobrevivermos à semana, churrasco. Sem convidados vampiros.', 'If we survive the week, barbecue. No vampire guests.'],
    ['Dia bom. Quer dizer, noite. Tanto faz, dia bom.', 'Good day. I mean, night. Whatever, good day.'],
  ]),
  custom: [],
  tithe_paid: T([
    ['Cota batida. Parabéns a nós, eu acho.', 'Quota met. Congratulations to us, I guess.'],
    ['A carruagem foi embora vazia de gente. Melhor noite da semana.', 'The carriage left with no people in it. Best night of the week.'],
  ]),
  tithe_failed: T([
    ['Alguém faltou com a meta. E a meta não falta com ninguém.', 'Someone missed the target. And the target never misses anyone.'],
    ['Menos um no café da manhã. O pão rende mais, pelo menos.', 'One fewer at breakfast. The bread goes further, at least.'],
  ]),
  sleepy: T([
    ['Vou deitar. Se me coletarem dormindo, não quero saber.', 'I\'m going to bed. If they collect me in my sleep, I don\'t want to know.'],
    ['Turno encerrado. Não que alguém tenha perguntado.', 'Shift over. Not that anyone asked.'],
  ]),
};
