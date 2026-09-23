# Hemofazenda — Adendo ao GDD v0.1 (22/09/2026)

Decisões tomadas após o protótipo do mapa. Prevalecem sobre o GDD v0.1 onde houver conflito.

## A1. Tempo em noites + Dízimo vampírico
- O tempo do jogo é medido em **noites** de ~5 min reais.
- Toda noite chega a carruagem do castelo cobrando uma **cota de Sangue**, que cresce a cada noite.
- **Cota batida:** Prestígio + bônus ocasional.
- **Cota falhada:** vampiros levam **humanos aleatórios** como pagamento. A cena acontece no mapa: a carruagem chega, os escolhidos embarcam e os outros reagem em balões.

## A2. Vínculos e genética (novos humanos)
- Mantém a regra do GDD: **sem crianças**; todo humano novo é adulto.
- Humanos formam **vínculos** sozinhos ao conviver (refeições, bancos, moral). O jogador incentiva com a **Casa das Famílias**.
- Após algumas noites, o casal recebe um **parente adulto** que chega à fazenda e herda perfil sanguíneo e traços dos dois.
- Pais de qualidade alta aumentam a chance de raros. Perfis combinados podem gerar perfis novos (ex.: Rubra + Lunar → chance de Carmesim). Traços raros são herdáveis.
- Dilema central reforçado: vender os raros ou mantê-los para gerar mais raros.

## A3. Agricultura básica
- Os cercados de terra viram **hortas**: plantar → crescer (estágios) → colher.
- Novo recurso **Comida**, consumido pelas áreas de alimentação. Sem comida, a fome sobe e a moral cai.
- Humanos alocados na horta não entram na fila de coleta (troca comida × sangue).

## A4. Árvore de pesquisa (Dr. Hemático)
Galhos: **Coleta**, **Bem-estar**, **Agricultura**, **Genética**, **Defesa**, **Logística**. Cada nó tem impacto visível no mapa sempre que possível.

## A5. Runs incrementais — Mandatos
- Cada fazenda é um **mandato**. Termina com vitória (meta regional cumprida → Ascensão) ou derrota (**3 cotas falhadas** → Vesper confisca a propriedade).
- Nos dois casos o jogador recebe **Legado de Sangue** proporcional ao progresso.
- O Legado compra melhorias permanentes na **árvore da Casa Vampírica** (mais Ouro inicial, humanos iniciais melhores, cota mais branda, novas regiões).

## A6. Defesa — "Vampiros vs. Lobisomens" (substitui o GDD §12)
- Estilo Plants vs. Zombies em **tela de batalha separada**: grid isométrico de **5 raias × 9 casas**. Floresta de um lado, paliçada do outro, e os **humanos reais da fazenda** atrás da cerca (são eles que podem ser levados).
- Quem defende são os vampiros e seus servos, nunca os humanos.
- **Sangue é o "sol":** invocar defensores custa Sangue. Durante a batalha a fazenda segue coletando e o Sangue entra no campo. O Cálice de Sangue gera um extra.
- **Defensores:** Sentinela (tiro), Ghoul Muralha (bloqueio), Gárgula (abate e vira pedra), Alquimista (lentidão/área), Nuvem de Morcegos (uso único), Cálice (gerador), Sir Aureliano (herói).
- **Invasores:** Batedor (rápido), Caçador (se chega à cerca, leva um humano aleatório), Bruto (tanque), Saltador (pula o 1º defensor), Uivador (acelera aliados), Ulf (chefe da lua cheia).
- **Ritmo:** ataques pequenos a cada poucas noites e um grande na lua cheia (a cada 4 noites), com aviso de uivo.
- **Consequência:** humano comum levado é perdido; humano raro ou nomeado vira missão de resgate.
- **Progressão:** novas unidades e melhorias vêm do galho Defesa da pesquisa e da árvore permanente entre runs.

## A7 — Expansão do Tower Defense "Vampiros vs. Lobisomens" (proposta 23/09/2026)

**Pilar:** a batalha é um dos pontos altos do jogo. Ela ganha modo próprio de campanha, mais cartas, clima e arenas.

### Já no jogo
- Arrastar carta com prévia.
- 3 magias vampíricas: Chuva Rubra, Névoa Hipnótica, Beijo Sombrio.
- Estrelas → marcas → níveis de unidade (Arsenal).
- Lua de Sangue (infinita).
- Partículas, clarões e tremor de câmera.

### Novas cartas de vampiro (8)
| Carta | Custo | Efeito |
|---|---|---|
| Criada de Sangue | 20 | Gerador barato e lento |
| Besteira de Prata | 75 | Dano dobrado em lobos feridos |
| Lanceiro Carmesim | 90 | Ataque perfurante em 2 casas |
| Bruxa da Névoa | 80 | Área lenta permanente em 3 casas |
| Caixão-Armadilha | 50 | Mina de uso único |
| Lanterna de Sangue | 60 | Aura +25% de dano nos vizinhos |
| Morcego Vigia | 70 | Anti-saltador e anti-voador |
| Conde Valério | herói, 1 por batalha | Tanque com habilidade ativa |

### Novos lobisomens (7)
| Lobisomem | Comportamento |
|---|---|
| Escavador | Passa por baixo e surge atrás da 1ª defesa |
| Xamã | Cura aliados próximos |
| Couraçado | Ignora 8 de dano por golpe |
| Filhotes | Trio rápido e frágil |
| Corvo de Ulf | Voa por cima das Muralhas |
| Uivador da Tempestade | Chama raios |
| Chefe: Mãe da Matilha | Invoca filhotes; 3 fases |

### Clima (sorteado por batalha, mostrado na preparação)
| Clima | Efeito |
|---|---|
| Chuva | Cálices +25%, Sentinelas −20% de cadência |
| Névoa | Lobos só aparecem nas últimas 5 casas |
| Lua Cheia | Lobos +25% de vida e velocidade; recompensa ×2 |
| Tempestade | Raios aleatórios em casas |
| Neve | Todos 20% mais lentos |
| Eclipse | Vampiros +30% de dano |

### Arenas (ligadas às regiões)
| Arena | Particularidade |
|---|---|
| Portão da Fazenda | Arena atual |
| Pântano Carmesim | Raias de água deixam lento; casas alagadas não aceitam unidades |
| Cemitério | Lápides bloqueiam casas |
| Ponte do Rio | 3 raias |
| Floresta em Chamas | O fogo se espalha |
| Muralhas do Castelo | 7 raias |

### Caçada (run roguelite grande)
- **Formato:** mapa de 12–15 nós: batalha, elite, evento, mercador, descanso, chefe.
- **Deck próprio:** começa com 4 cartas. Após cada vitória, escolhe 1 entre 3 cartas ou uma melhoria.
- **Durante a run:** relíquias de caçada; vidas = humanos voluntários.
- **Recompensas:** Marcas, Essência e desbloqueio de cartas para as defesas da fazenda.

## A8 — Conquista de regiões, história e tensão (23/09/2026)

### Conquista de região
Uma região vira **Domínio** com 3 pilares, acompanhados no painel da coroa (👑):
1. **Produção:** meta de Sangue/min do capítulo, medida só por coletas e orbes. Metas: Bosque 45, Pântano 60, Fronteira 70, Vale 80, Costa 95, Cripta 110.
2. **Regente:** um humano Raro+ com moral 60+ é transformado em vampiro. Custa 40 Prestígio + 200 Sangue e aparece no mapa com nome.
3. **Matilha:** vencer 2 defesas sem perdas faz o alfa da região aparecer. Derrotá-lo encerra os ataques na região.

### Domínios
- Cada Domínio rende 8 Legado/hora, também offline, até 24 h.
- Dá +5% de Sangue em todos os mandatos.
- As regiões abrem por número de Domínios. Regiões conquistadas só podem ser rejogadas depois de conquistar todas.

### História
- Um capítulo por região, com falas, chefe nomeado e atmosfera próprios (cor da noite, névoa, partículas, terreno em volta da fazenda).
- Veteranos pulam o tutorial.
- O próximo passo do capítulo fica sempre no cartão de objetivo.

### Tensão
- Painel no ícone de tensão: fatores ao vivo em "/min" e ações (Banquete, Folga, Discurso, Presentes).
- A rebelião traz 3 exigências concretas; atender 1 encerra.
- Reprimir gera ressentimento por 3 noites.
- Ignorar a rebelião gera vandalismo a cada minuto.

### Tower defense mais justo
- Sangue próprio da batalha, separado da Sangria.
- Uma tocha de emergência por raia, no estilo dos cortadores de grama do PvZ.
- Prévia da horda com aviso dos lobos que passam de propósito (Saltador, Escavador, Corvo).
- Lobos 15% mais lentos; Sentinela e Muralha mais fortes.
