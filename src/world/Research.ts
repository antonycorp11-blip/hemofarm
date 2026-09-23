// Research runner + tree panel (GDD §8 T7, GDD_ADENDO A4). One project at a time, paid in Blood and Prestige.
import { bus } from '../core/events';
import { state } from '../core/state';
import { BRANCHES, Branch, NODES, Node, TIER_COST, has } from '../data/research';
import type { BuildPanel } from '../ui/BuildPanel';
import type { Hud } from '../ui/Hud';

export class Research {
  constructor(private panel: BuildPanel, private hud: Hud, private labBuilt: () => boolean) {}

  update(dt: number) {
    const cur = state.research.current;
    if (!cur) return;
    cur.left -= dt;
    if (cur.left > 0) return;
    state.research.current = undefined;
    state.research.done.push(cur.id);
    const n = NODES.find(x => x.id === cur.id)!;
    bus.emit('RESEARCH_DONE', { nodeId: n.id });
    this.hud.toast(`Hemático: Funcionou! ${n.name} concluída. Isso reduz as possibilidades de desastre para sete.`, 'good', 7000);
  }

  private available(n: Node) {
    if (n.locked || has(n.id)) return false;
    const prev = NODES.find(x => x.branch === n.branch && x.tier === n.tier - 1);
    return !prev || has(prev.id);
  }

  open() {
    if (!this.labBuilt()) {
      this.hud.toast('Hemático: Preciso de um Laboratório! O lote a leste, perto dos tanques. Por favor. Pela ciência.');
      return;
    }
    const cur = state.research.current;
    const r = state.resources;
    const node = (n: Node) => {
      const c = TIER_COST[n.tier];
      const done = has(n.id), running = cur?.id === n.id;
      let status: string;
      if (done) status = '<span style="color:#9fd86b">✓ Concluída</span>';
      else if (running) status = `<span style="color:#e8b54a">Em pesquisa · ${Math.ceil(cur!.left / 1000)} s</span>`;
      else if (n.locked) status = `<span class="muted">${n.locked}</span>`;
      else if (!this.available(n)) status = '<span class="muted">Requer a anterior</span>';
      else {
        const afford = r.blood >= c.blood && r.prestige >= c.prestige && !cur;
        status = `<button class="go" data-node="${n.id}"${afford ? '' : ' disabled'}>${c.blood} Sangue · ${c.prestige} Prestígio · ${c.ms / 1000} s</button>`;
      }
      return `<div class="card" style="${done ? 'opacity:.75' : ''}"><h4>${n.name}</h4><div class="muted">${n.desc}</div><div style="margin-top:4px">${status}</div></div>`;
    };
    const branch = (b: Branch) => `<div style="display:flex;align-items:center;gap:6px;margin:10px 0 4px"><img src="assets/${BRANCHES[b].icon}.webp" style="height:20px" alt="">` +
      `<b>${BRANCHES[b].name}</b></div>` + NODES.filter(n => n.branch === b).map(node).join('');
    this.panel.open({
      title: 'Pesquisas do Dr. Hemático',
      subtitle: cur ? 'Uma pesquisa por vez · o Sangue gasto não vai para o Dízimo' : 'Escolha uma pesquisa · o Sangue gasto não vai para o Dízimo',
      desc: '',
      stats: [],
      html: (Object.keys(BRANCHES) as Branch[]).map(branch).join(''),
      bind: root => root.querySelectorAll<HTMLButtonElement>('[data-node]').forEach(b => b.addEventListener('click', () => this.start(b.dataset.node!))),
    });
  }

  private start(id: string) {
    const n = NODES.find(x => x.id === id)!;
    const c = TIER_COST[n.tier];
    const r = state.resources;
    if (state.research.current || r.blood < c.blood || r.prestige < c.prestige) return;
    r.blood -= c.blood;
    r.prestige -= c.prestige;
    state.research.current = { id, left: c.ms * state.mods.researchTime };
    bus.emit('RESEARCH_STARTED', { nodeId: id });
    this.hud.toast(`Hemático: ${n.name}! Vou precisar de frascos. Muitos frascos.`);
    this.open();
  }
}
