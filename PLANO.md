# Hemofazenda — Plano de desenvolvimento

## Stack
- **Phaser 3 + TypeScript + Vite**: roda no navegador, 2D maduro, câmera/tweens/input prontos, build estático.
- **UI em HTML/CSS sobre o canvas** (diálogos, painéis, ficha): texto nítido, localizável e fácil de estilizar.
- **Estado do jogo em TS puro + event bus semântico** (BUILDING_BUILT etc.), sem depender do Phaser. Tutorial e quests escutam os mesmos eventos.
- **Save** em localStorage (IndexedDB se crescer).
- **Mapa = cenário construído de verdade**: tilemap **isométrico 2:1** montado em código (tiles de chão + decalques para esconder emendas), cercas por segmento, árvores/pedras/props como objetos com ordenação por profundidade, construções em slots, iluminação noturna em tempo real (escurecimento + luzes das lanternas/tochas), névoa e partículas. Só o céu distante (lua/montanhas/castelo) é imagem de fundo com parallax. Layout em `map_bosque.json` (grade de tiles, objetos, slots, grafo de navegação, rotas de ataque, luzes) editável pelo editor de debug.
- **Pipeline de assets** (feito por mim): `assets_raw/` → script (recorte, remoção de magenta, pixel-snap, redimensionamento nearest-neighbor, atlas) → `public/assets/`.

## Roadmap (ordem de execução — revisado 22/09/2026 com o GDD_ADENDO.md)
| # | Fase | Entrega |
|---|------|---------|
| 0 | Setup + pipeline | ✅ Projeto Vite/Phaser/TS, script de assets |
| 1 | Mapa | ✅ Tilemap isométrico, câmera, luzes, ambiente, editor F2 |
| 2 | Humanos vivos | 🟡 Rotina, fila de coleta, balões (faltam marcadores e variantes — blocos 6/10) |
| 3 | Núcleo | 🟡 Recursos, economia por eventos, save, HUD provisório |
| 4 | Noites + Dízimo | 🟡 Relógio de noites (5 min), cota crescente, carruagem do castelo, humanos aleatórios levados se falhar, strikes (3 = confisco). Feito: `src/world/Tithe.ts`, HUD da noite, avisos. Falta: vampiro descendo da carruagem (bloco 6) e o confisco real (Fase 12) |
| 5 | Construção + Hortas | 🟡 Feito: `src/world/Buildings.ts` (lotes, obra com prévia e barra, upgrade, capacidade das casas), `src/world/Farms.ts` (3 culturas, plantar→crescer→colher por humanos, recurso Comida), painel `src/ui/BuildPanel.ts`, Dízimo pago rende Ouro. Falta: arte das plantas (bloco 19) e canteiro de obras (bloco 9). Original: Lotes vazios, construir/melhorar com Ouro e nível visual; recurso Comida, hortas plantar→crescer→colher, humanos alocados (bloco 19 de assets) |
| 6 | Missões / diálogo / tutorial | 🟡 Feito: `src/core/tutorial.ts` + `src/data/tutorial.ts` (T0–T5: herança, teto, comida, horta, coleta, Dízimo), diálogo com retratos, objetivo no HUD, dicas 12/25/45 s (fala, anel, seta + câmera), pular tutorial. Falta: missões de personagens além do tutorial. Original: Motor orientado a dados + tutorial reescrito para o loop novo (retratos bloco 8) |
| 7 | Humanos como produto | 🟡 Feito: atributos (`src/data/humans.ts`), ficha ao tocar no humano, 8 contratos (`src/data/contracts.ts`, `src/world/Contracts.ts`), Pátio de Embarque, venda, tutorial T5–T8 da Rubélia. Falta: mercado de compra de humanos, eventos de comprador. Original: Ficha, perfis sanguíneos, qualidade, traços, classificação, contratos/mercado |
| 8 | Vínculos + genética | 🟡 Feito: afinidade ao socializar → casais, pares arranjados na ficha com chances de herança, Casa das Famílias (2 níveis), parentes adultos pelo portão herdando perfil/qualidade/traço (`src/sim/genetics.ts`), limite por camas, tutorial T10. Falta: arte própria da Casa das Famílias (usa casa tingida). Original: Vínculos espontâneos, Casa das Famílias, parente adulto herdando perfil/traços |
| 9 | Pesquisa | 🟡 Feito: Laboratório (arte bld_lab), 15 pesquisas ativas em 5 galhos + 3 de Defesa bloqueadas até a batalha (`src/data/research.ts`, `src/world/Research.ts`), custo em Sangue+Prestígio, tutorial T11–T12. Original: Árvore do Dr. Hemático: Coleta, Bem-estar, Agricultura, Genética, Defesa, Logística |
| 10 | Mundo vivo | 🟡 Feito: Tensão (aparece no HUD a partir de 25), 8 eventos de decisão do GDD a cada 4–7 min com aviso não-bloqueante (`src/data/events.ts`, `src/world/LivingWorld.ts`), microeventos (discussões/comemoração), rebelião com exigências e 4 saídas. Original: Moral/Tensão, microeventos, eventos de decisão, rebelião curta |
| 11 | Batalha | 🟡 Feito: cena `src/scenes/BattleScene.ts` (5×9, 6 defensores, 6 lobisomens com habilidades, ondas, Cálice com orbes, humanos reais atrás da cerca), ataques agendados (`src/world/Raids.ts`: lua cheia a cada 4 noites + chance de ataque pequeno), alerta, resolução automática se ignorar, recompensas/perdas, tutorial T13, pesquisas de Defesa liberam Gárgula/Alquimista/Morcegos. Original: Vampiros vs. Lobisomens: cena separada 5×9, Sangue como "sol", humanos reais atrás da cerca (blocos 6/7/18) |
| 12 | Mandatos + meta | 🟡 Feito: meta de Prestígio por mandato → coroa de Ascensão, confisco com 3 faltas, Legado de Sangue, Casa Vampírica com 7 melhorias permanentes (`src/core/meta.ts`), mapa regional com 6 regiões de regras próprias liberadas por mandatos (`src/data/regions.ts`, `src/ui/Mandate.ts`). Original: Fim de run (vitória/confisco), Legado de Sangue, árvore da Casa Vampírica, mapa regional |
| 13 | Fecho | 🟡 Feito: efeitos sonoros sintetizados (`src/core/sfx.ts`, liga/desliga no menu), resumo offline de até 2 h, PWA com atualização forçada. Falta: balanceamento com jogo real, música. Original: Áudio, progresso offline, polimento, balanceamento |

## Assets (pedidos em blocos de 10, prompts no chat de 22/09/2026)
- Bloco 1 — terreno: tile_grass_a, tile_grass_b, tile_forest_floor, tile_cobble_a, tile_cobble_b, tile_dirt_road, tile_soil, tile_water, decals_ground, tile_cliff_edge
- Bloco 2 — cercas/limites: fence_palisade_ne, fence_palisade_nw, fence_palisade_post, gate_main, rail_fence_ne, rail_fence_nw, rail_fence_post, stone_wall_ne, stone_wall_nw, lamp_post
- Bloco 3 — natureza: pine_a/b/c, dead_tree_a/b, bush_a/b, rock_a/b/c
- Bloco 4 — construções: bld_housing_1/2, bld_food_1/2, bld_collect_1/2, bld_boarding, bld_watchtower, castle_cliff, backdrop_sky (opaco)
- Bloco 5 — personagem/props: human_walk_front, human_walk_back, human_actions, torch_stand, banner_bat, crates, barrel, bench, carriage, well
Arquivos em `assets_raw/`. Fundo transparente ou magenta #FF00FF.

## Status (22/09/2026)
- Fase 0 ✅ projeto Vite/Phaser/TS; `npm run assets` processa `assets_raw/` → `public/assets/`.
- Fase 1 🟡 mapa isométrico montado em código (`src/map/bosque.ts`), câmera (arrastar/roda/pinça), luzes, névoa, vaga-lumes, céu+castelo em parallax, 12 humanos passeando nas ruas. Luzes compactas (brilho na chama + poça elíptica no chão). Editor F2 feito (arrastar, Shift+clique esconde, Copiar JSON → `src/map/overrides.json`). Pendente: asset novo `gate_main` orientado topo-esquerda→baixo-direita.

## Assets futuros (blocos 6–17, prompts no chat de 22/09/2026)
- 6/7 personagens do mapa (folha 4x4 cada): human_b, human_c, davi, lia, boris, ghoul_worker, ghoul_guard, vampire_buyer, rubelia, hematico · aureliano, vesper, wolf_scout, wolf_hunter, wolf_brute, wolf_alpha, sentinel_vampire, gargoyle, alchemist_unit, human_actions_2
- 8 retratos: portrait_vesper, _boris, _rubelia, _hematico, _aureliano, _davi, _lia, _ulf, _inspector, _merchant
- 9 construções II: bld_housing_3, bld_lab, bld_market, bld_shelter, bld_bell, gate_reinforced, bld_guard_post, bld_sentinel_tower, bld_site_small, bld_site_large
- 10 props/marcadores: mattress_pile, props_misc, hand_cart, fire_pit, palisade_broken_ne, palisade_broken_nw, rubble, plot_marker, markers_sheet, crate_vials
- 11 efeitos (4 quadros): fx_dust, fx_hit, fx_smoke, fx_sparkle, fx_blood_drop, fx_bolt, fx_bomb, fx_bell_wave, fx_fear, fx_coins
- 12–15 ícones HUD: recursos/status, ações, perfis/qualidade, temperamentos/traços
- 16 molduras 9-slice · 17 telas (logo, título, mapa regional, pinos, morcego de loading, cursores)
- Fase 2 🟡 rotina dos humanos (`src/world/Humans.ts`): fome/energia/moral/vitalidade → dormir em casa, comer, socializar (poço, bancos, praça), fila de coleta que anda (7 vagas no Posto de Coleta), recuperação mais lenta; A* com preferência pelas ruas (`src/sim/pathfind.ts`); balões ambientais (`src/world/Bubbles.ts`, falas em `src/data/lines.ts`); event bus (`src/core/events.ts`) já emite HUMAN_CREATED, HUMAN_ATE, BLOOD_COLLECTED. Falta: marcadores sobre a cabeça (aguardando `markers_sheet`) e variantes human_b/human_c.
- Fase 3 🟡 `src/core/state.ts` (Sangue/Ouro/Prestígio, economia via event bus, save automático a cada 10 s e ao fechar), HUD provisório em HTML (`src/ui/Hud.ts`, botão Novo jogo), texto flutuante "+10 Sangue" no Posto de Coleta. Falta: skin do HUD (blocos 12–16), níveis de construção no save (entra com a Fase 5).
- 18 batalha: wolf_leaper, wolf_howler, ghoul_wall, blood_chalice, blood_orb, fx_bat_swarm, fx_vampire_poof, fx_flask, card_unit, wave_flag
- 19 hortas: crop_potato_1/2/3, crop_cabbage_1/2/3, crop_turnip_1/2/3, harvest_basket

## Assets recebidos (22/09/2026, 2ª leva)
- ✅ Blocos 6, 7, 8, 9, 10, 11 (zip), 13 completos; bloco 12 e 14 vieram como folhas únicas (fatiadas por grade 5×2).
- Em uso: variações human_b/human_c, Davi 17-B e Lia 04-A na fazenda, marcadores sobre a cabeça, ícones no HUD, canteiro de obras + ghoul trabalhando, casa nível 3, vampiro cobrador no Dízimo, efeitos (fumaça de obra, brilho ao concluir, gota na coleta, moedas no pagamento), retratos nos avisos, fogueira/caixas/colchões/carrinho de decoração.
- Guardados para as próximas fases: retratos (diálogos, Fase 6), lobisomens/defensores (Fase 11), laboratório/mercado/abrigo/sino/torres/portão reforçado, props diversos.
- Não identificados (em `assets_raw/_unused`): imagens das 17:25, 17:32 e 17:34.
- Faltam: blocos 15, 16, 17, 18, 19.

## Deploy
- GitHub: https://github.com/antonycorp11-blip/hemofarm (branch main). Vercel: importar o repo; `vercel.json` já define build e saída.
- Assets publicados em WebP (4,8 MB); a fazenda carrega só o que usa.

## Assets recebidos (22/09/2026, 3ª leva)
- ✅ Bloco 15 (temperamentos, traços, ícones raid/offline), 16 (molduras 9-slice, botões, barras), 17 (logo, fundo de título, mapa regional, pinos, morcego, cursores, página do codex), 19 (plantas: 3 culturas × 3 estágios + cesto).
- ✅ Bloco 18 completo (18 + 18B). Todos os assets pedidos até agora foram entregues.
- Em uso: pele da interface (`src/ui/skin.ts`), tela de título com botão Jogar, morcego no carregamento, cursor no desktop, plantas reais na horta.

## Fase 14 — Expansão do tower defense (GDD A7) · 🟡
- **8 cartas novas:** criada, besteira, lanceiro, bruxa, caixão, lanterna, morcego vigia, Conde.
- **7 lobisomens novos:** escavador, xamã, couraçado, filhotes, corvo, tempestade, Mãe da Matilha em 3 fases.
- **7 climas e 6 arenas por região:** pântano com água, cemitério com lápides, ponte de 3 raias, fogo, muralhas de 7 raias.
- **Caçada:** 12 etapas, deck, draft, mercador, eventos, fogueira, relíquias e chefe. As cartas conquistadas passam a valer na fazenda.
- **Arte:** provisória, com tinta. Os blocos 20–22 entram automaticamente pelo `process_assets.py`, com os nomes já mapeados.

## Fase 15 — História "A Herança" (GDD A9) · 🟡
- **Carta da Tia Leonor** na primeira abertura, antes da primeira fala do tutorial.
- **Diário de Leonor:** 16 páginas encontradas em marcos do jogo; botão no HUD com contador de páginas novas, item no menu e tecla J. Fica salvo entre mandatos (`src/world/Story.ts`, `src/data/lore.ts`).
- **Ganchos de noite:** de 3 a 4 por capítulo, em `CHAPTERS[...].nights` (`src/data/story.ts`), disparados pelo `Conquest`.
- **Chefes com passado:** falas finais de Ulf, Grenda, Korvus, Sóror e Capitão.
- **Eventos novos:** Porão Trancado, Carta Sem Remetente, Uivo com Nome e Caravana da Cripta. Só aparecem depois do tutorial.
- **Coração × Presa:** `meta.soul`, alterado por eventos, vendas, rebeliões, Banquete, Folga, Presentes e Hora extra.
- **Finale na Cripta:** revelação da Leonor, escolha entre Casa Eterna, Revolta (Coração 25+) e Pacto (12+ páginas), epílogo e créditos.
- **Falta:** arte `portrait_leonor` (hoje é uma silhueta) e `title_logo_en`.

## Fase 16 — Inglês + PC · ✅
- **Idiomas:** todo texto está em `L('pt', 'en')` (`src/core/i18n.ts`). Padrão é o idioma do navegador. A troca fica em Ajustes e na tela de título e recarrega o jogo (o save é mantido).
- **Ajustes:** idioma, som, música, tamanho da interface (Auto/100/125/150%), tela cheia e lista de atalhos.
- **PC:**
  - A interface cresce em telas grandes (`src/ui/display.ts`).
  - Fazenda: WASD/setas movem a câmera, +/− dão zoom, 1–3 mudam a velocidade, Espaço pausa, C/R/O/K/T/J/M/F abrem painéis e Esc abre o menu.
  - Batalha: 1–9 escolhem cartas, Q/W/E magias, a mira segue o mouse, botão direito ou Esc cancelam e Espaço começa a luta.
  - Enter/Espaço avançam diálogos.
  - O áudio silencia com a aba em segundo plano.
- **Correções:**
  - Clicar num botão de janela não "clica" mais no lote do mapa embaixo.
  - `npm run assets` voltou a funcionar: `exists()` era usada antes de ser definida.

## Auditoria (24/09/2026)
Robôs no Playwright:
- 16 noites aceleradas em PT e EN, com tudo construído e com o mínimo;
- batalhas de todos os modos jogadas até o fim;
- início de mandato nas 6 regiões.

Nenhum erro de código em nenhum cenário. Correções feitas:
- **Vazamentos de animação:** plantas maduras, anel de seleção e dica do tutorial deixavam animações rodando sobre objetos destruídos (+100 por noite). Agora ficam estáveis em ~70.
- **Chão desenhado:** só o que está na tela (~1.100 em vez de ~5.000 objetos).
- **Tensão proporcional ao tamanho da fazenda:** acima de 12 humanos, fome e coletas pesam proporcionalmente. Fazendas grandes tinham rebelião quase toda noite.
- **Alfa dos ataques comuns:** virou "Alfa da Matilha"; o nome do chefe (Ulf, Grenda…) só aparece na luta do chefe. Antes, "Ulf" aparecia em todas as regiões, mesmo depois de derrotado.
- **Estrelas:** mostram a nota real; a Lua Cheia dobra as marcas, não as estrelas. A luta do chefe termina com "X caiu!".
- **Falas por modo:** "Humano: …" só em ataques à fazenda; Caçada e Lua de Sangue têm falas próprias. "Humano:" agora é traduzido.
- **Caçada:** a Mãe da Matilha recua em vez de "cair" (ela só cai na história).
- **História:**
  - a página "estrada sul" só abre pela Sangria;
  - o contrato do tutorial não conta Presa;
  - o texto da Lia foi corrigido;
  - o Pacto e o final trágico contam páginas lidas;
  - libertar alguém no uivo só vale se alguém saiu.
- **"Onde?" do tutorial:** sempre responde; em passos sem lugar no mapa, destaca o botão do HUD.
- **Atalhos de teclado:** não disparam com janelas abertas.
