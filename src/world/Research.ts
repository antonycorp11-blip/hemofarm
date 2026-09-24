// Research tree v2 (GDD_ADENDO A4): a pannable tree screen, instant purchases paid in Essência.
// The Laboratory distils Essência from every collection, so research never competes with the tithe for Blood.
import { bus } from '../core/events';
import { state } from '../core/state';
import { invalidate, less, more, ratePreview } from '../core/bonus';
import { sfx } from '../core/sfx';
import { BRANCHES, NODES, Node, lvl, node } from '../data/research';
import type { Hud } from '../ui/Hud';
import { L } from '../core/i18n';

export const ESSENCE_RATE = 0.3; // Essência per point of Blood collected, before bonuses

const CSS = `
.rtree{position:fixed;inset:0;z-index:30;display:none;background:linear-gradient(#08040dcc,#08040dcc),url(assets/research_codex_bg.jpg) center/cover fixed,radial-gradient(ellipse at center,#1a0c1c 0%,#070409 75%);color:#f3e2c8;font:13px Georgia,serif;
  touch-action:none;user-select:none;overflow:hidden}
.rtree.on{display:block}
.rtree .head{position:absolute;left:0;right:0;top:0;z-index:3;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;
  background:linear-gradient(180deg,#070409f0 60%,#07040900);pointer-events:none}
.rtree .head h2{margin:0;font-size:18px;color:#f6d9a0;flex:1}.rtree .head .progress{font-size:11px;color:#c9b8a8;white-space:nowrap}
.rtree .ess{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:14px;background:#241218;border:1px solid #6b3a8a;font-size:15px}
.rtree .ess img{height:20px}.rtree .ess small{color:#b89ad8;font-size:11px}
.rtree .close{pointer-events:auto;background:none;border:0;color:#e0c8a8;font-size:28px;cursor:pointer;padding:0 6px}
.rtree .vp{position:absolute;inset:0}
.rtree .world{position:absolute;left:0;top:0;width:1200px;height:800px;transform-origin:0 0}
.rtree svg{position:absolute;inset:0;overflow:visible}
.rtree .nd{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;padding:0;cursor:pointer;background:#140a10;
  border:3px solid #3a2a30;box-shadow:0 3px 10px #000c;display:flex;align-items:center;justify-content:center}
.rtree .nd img{height:34px;filter:grayscale(1) brightness(.5)}
.rtree .nd .lv{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);padding:0 5px;border-radius:8px;background:#0b0709;border:1px solid #4a2a30;
  font:700 10px/14px system-ui;color:#c9b8a8;white-space:nowrap}
.rtree .nd .nm{position:absolute;top:70px;left:50%;transform:translateX(-50%);width:110px;text-align:center;font-size:11px;line-height:1.15;color:#8a7a78;pointer-events:none}
.rtree .nd.key{width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:14px;transform:rotate(45deg)}
.rtree .nd.key img,.rtree .nd.key .lv{transform:rotate(-45deg)}.rtree .nd.key .lv{bottom:auto;top:30px;left:auto;right:-14px}
.rtree .nd.key .nm{transform:rotate(-45deg);top:74px;left:-30px}
.rtree .nd.root{width:88px;height:88px;margin:-44px 0 0 -44px}.rtree .nd.root img{height:50px}
.rtree .nd.avail{border-color:var(--c);animation:ndp 1.1s ease-in-out infinite alternate}.rtree .nd.avail img{filter:grayscale(.3)}
.rtree .nd.avail .nm,.rtree .nd.own .nm{color:#f3e2c8}
@keyframes ndp{to{box-shadow:0 0 16px var(--c)}}
.rtree .nd.own{border-color:var(--c);background:radial-gradient(circle,#2a1420,#140a10);box-shadow:0 0 12px var(--c)}.rtree .nd.own img{filter:none}
.rtree .nd.max{background:radial-gradient(circle,#4a2a14,#1a0c08);border-color:#f6d9a0}.rtree .nd.max .lv{color:#f6d9a0;border-color:#a07818}
.rtree .nd.excl{opacity:.35}.rtree .nd.sel{outline:3px solid #fff;outline-offset:4px}
.rtree .nd.afford .lv{background:#8a1424;color:#fff;border-color:#ff6a78}
.rtree .leg{position:absolute;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:3;display:flex;gap:8px;flex-wrap:wrap;max-width:min(620px,calc(100vw - 24px));font-size:11px;color:#c9b8a8;pointer-events:none}
.rtree .leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
.rtree .sheet{position:absolute;z-index:4;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);transform:translateX(-50%);width:min(380px,calc(100vw - 24px));
  box-sizing:border-box;padding:10px 14px 12px;border:10px solid transparent;border-image:url(assets/frame_panel.webp) 22 fill / 10px stretch;display:none}
.rtree .sheet.on{display:block}
.rtree .sheet h3{margin:0;font-size:16px;color:#f6d9a0}.rtree .sheet .br{font-size:11px;margin-bottom:4px}
.rtree .sheet p{margin:4px 0 6px;line-height:1.3}.rtree .sheet .st{font-size:12px;color:#c9b8a8}
.rtree .sheet button{width:100%;min-height:42px;margin-top:6px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;
  background:none;color:#fff;font:700 14px Georgia,serif;cursor:pointer}.rtree .sheet button:disabled{filter:grayscale(1) brightness(.6);cursor:default}
.rtree .sheet .sx{position:absolute;top:-4px;right:0;width:auto;min-height:0;margin:0;border:0;font-size:20px;color:#c9a98a;padding:2px 6px}
@media (orientation:landscape) and (max-height:520px){
  .rtree .sheet{left:auto;right:max(10px,env(safe-area-inset-right,0px));transform:none;top:56px;bottom:auto;width:min(300px,42vw)}
  .rtree .head{padding-top:calc(env(safe-area-inset-top,0px) + 4px)}.rtree .head h2{font-size:15px}
}
`;

export class Research {
  private el: HTMLDivElement;
  private world!: HTMLDivElement;
  private sel?: string;
  private view = { x: 0, y: 0, z: 1 };
  private gains: { t: number; v: number }[] = [];

  constructor(private hud: Hud, private labBuilt: () => boolean) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'rtree';
    document.body.appendChild(this.el);
    // The Lab distils Essência from every collection.
    bus.on('BLOOD_COLLECTED', ({ amount }) => {
      if (!this.labBuilt()) return;
      const v = amount * ESSENCE_RATE * more('essence');
      state.resources.essence += v;
      this.gains.push({ t: performance.now(), v });
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    invalidate();
  }

  // Essência per minute over the last minute (shown in the tree header).
  get rate() {
    const now = performance.now();
    this.gains = this.gains.filter(g => now - g.t < 60000);
    return Math.round(this.gains.reduce((a, g) => a + g.v, 0));
  }

  update(_dt: number) {
    // The bench comes with the building: the root node is free once the Lab stands.
    if (this.labBuilt() && !lvl('lab')) { state.research.lv.lab = 1; invalidate(); }
  }

  // ---------- rules ----------
  cost(n: Node) { return Math.round(n.base * Math.pow(1.7, lvl(n.id)) * less('researchCost', 0.5)); }
  private excluded(n: Node) { return !!n.excl && NODES.some(o => o.excl === n.excl && o.id !== n.id && lvl(o.id) > 0); }
  private open_(n: Node) { return n.req.every(r => lvl(r) > 0) && !this.excluded(n); }
  /** Anything buyable right now? (HUD badge) */
  get affordable() { return this.labBuilt() && NODES.some(n => lvl(n.id) < n.max && this.open_(n) && state.resources.essence >= this.cost(n)); }

  private buy(id: string) {
    const n = node(id);
    const c = this.cost(n);
    if (lvl(id) >= n.max || !this.open_(n) || state.resources.essence < c) return;
    state.resources.essence -= c;
    state.research.lv[id] = lvl(id) + 1;
    invalidate();
    sfx.chime();
    bus.emit('RESEARCH_STARTED', { nodeId: id });
    bus.emit('RESEARCH_DONE', { nodeId: id });
    if (n.unlock) this.hud.toast(L(`Hemático: ${n.name}! Aureliano vai adorar. Ou temer. As duas coisas.`, `Hematic: ${n.name}! Aureliano will love it. Or fear it. Both.`), 'good', 6000);
    this.render();
  }

  // ---------- screen ----------
  open() {
    if (!this.labBuilt()) {
      this.hud.toast(L('Hemático: Preciso de um Laboratório! O lote a leste, perto dos tanques. Por favor. Pela ciência.', 'Hematic: I need a Laboratory! The lot to the east, near the tanks. Please. For science.'));
      return;
    }
    this.el.classList.add('on');
    sfx.page();
    this.render();
    this.fit();
  }

  close() { this.el.classList.remove('on'); this.sel = undefined; }

  private fit() {
    const W = window.innerWidth, H = window.innerHeight;
    const z = Math.min(1.1, Math.max(0.42, Math.min(W / 1240, (H - 60) / 860)));
    this.view = { z, x: (W - 1200 * z) / 2, y: 50 + (H - 50 - 800 * z) / 2 };
    this.apply();
  }

  private apply() { if (this.world) this.world.style.transform = `translate(${this.view.x}px,${this.view.y}px) scale(${this.view.z})`; }

  private render() {
    const r = state.resources;
    const lines = NODES.flatMap(n => n.req.map(p => {
      const a = node(p), lit = lvl(p) > 0 && lvl(n.id) > 0, open = lvl(p) > 0;
      const c = BRANCHES[n.branch].color;
      return `<line x1="${a.x}" y1="${a.y}" x2="${n.x}" y2="${n.y}" stroke="${lit ? c : open ? '#6a5a60' : '#2a1e24'}" stroke-width="${lit ? 5 : 3}"` +
        `${lit ? '' : ' stroke-dasharray="8 7"'} stroke-linecap="round" opacity="${lit ? 0.95 : 0.8}"/>`;
    })).join('');
    const nodes = NODES.map(n => {
      const l = lvl(n.id), open = this.open_(n), excl = this.excluded(n);
      const cls = ['nd', n.excl ? 'key' : '', n.branch === 'root' ? 'root' : '', l >= n.max ? 'max' : l > 0 ? 'own' : '', open && l < n.max ? 'avail' : '',
        excl ? 'excl' : '', open && l < n.max && r.essence >= this.cost(n) ? 'afford' : '', this.sel === n.id ? 'sel' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-n="${n.id}" style="left:${n.x}px;top:${n.y}px;--c:${BRANCHES[n.branch].color}">` +
        `<img src="assets/${n.icon}.webp" alt=""><span class="lv">${n.max > 1 ? `${l}/${n.max}` : l ? '✓' : excl ? '✕' : '•'}</span><span class="nm">${n.name}</span></button>`;
    }).join('');
    const legend = (['sangue', 'rebanho', 'defesa', 'castelo', 'caçada', 'dominio'] as const).map(b => `<span><i style="background:${BRANCHES[b].color}"></i>${BRANCHES[b].name}</span>`).join('');
    const bought = NODES.reduce((sum, n) => sum + Math.min(lvl(n.id), n.max), 0);
    const total = NODES.reduce((sum, n) => sum + n.max, 0);
    const branches = Object.keys(BRANCHES).filter(k => k !== 'root').filter(k => NODES.some(n => n.branch === k && lvl(n.id) > 0)).length;
    const keep = this.world ? this.view : undefined;
    this.el.innerHTML = `<div class="vp"><div class="world"><svg width="1200" height="800">${lines}</svg>${nodes}</div></div>
      <div class="head"><h2>${L('Pesquisas do Dr. Hemático', 'Dr. Hematic\'s Research')}</h2><span class="progress">${bought}/${total} ${L('níveis', 'levels')} · ${branches}/6 ${L('caminhos', 'paths')}</span><div class="ess"><img src="assets/icon_research.webp" alt=""><b>${Math.floor(r.essence)}</b> ${L('Essência', 'Essence')} <small>+${this.rate}/min</small></div>
      <button class="close" aria-label="${L('Fechar', 'Close')}">×</button></div><div class="leg">${legend}</div><div class="sheet"></div>`;
    this.world = this.el.querySelector('.world')!;
    if (keep) this.view = keep;
    this.apply();
    this.el.querySelector<HTMLButtonElement>('.close')!.onclick = () => this.close();
    this.el.querySelectorAll<HTMLButtonElement>('.nd').forEach(b => b.addEventListener('click', e => {
      if (this.dragged) return;
      e.stopPropagation();
      this.sel = b.dataset.n;
      this.render();
    }));
    this.bindPan();
    this.sheet();
  }

  private sheet() {
    const el = this.el.querySelector<HTMLElement>('.sheet')!;
    if (!this.sel) return;
    const n = node(this.sel), l = lvl(n.id), c = this.cost(n);
    const open = this.open_(n), excl = this.excluded(n);
    const effect = (lv: number) => n.fx ? n.fx.map(([k, v]) => fmtFx(k, v * lv)).join(' · ') : '';
    const bl = n.fx?.find(([k]) => k === 'blood');
    const prev = bl && l < n.max ? ratePreview(bl[1]) : '';
    let btn: string;
    if (l >= n.max) btn = `<button disabled>${L('Completo', 'Complete')}</button>`;
    else if (excl) btn = `<button disabled>${L('Você escolheu o outro caminho', 'You chose the other path')}</button>`;
    else if (!open) btn = `<button disabled>${L('Requer', 'Requires')}: ${n.req.filter(p => !lvl(p)).map(p => node(p).name).join(L(' e ', ' and '))}</button>`;
    else btn = `<button data-buy${state.resources.essence >= c ? '' : ' disabled'}>${l ? L('Melhorar', 'Upgrade') : L('Pesquisar', 'Research')} · ${c} ${L('Essência', 'Essence')}</button>`;
    el.innerHTML = `<button class="sx" aria-label="${L('Fechar', 'Close')}">×</button><h3>${n.name}</h3>
      <div class="br" style="color:${BRANCHES[n.branch].color}">${BRANCHES[n.branch].name}${n.max > 1 ? ` · ${L('nível', 'level')} ${l}/${n.max}` : ''}</div>
      <p>${n.desc}</p>${n.fx && n.max > 1 ? `<div class="st">${l ? `${L('Agora', 'Now')}: ${effect(l)}` : ''}${l < n.max ? `${l ? '<br>' : ''}${L('Próximo', 'Next')}: ${effect(l + 1)}` : ''}</div>` : ''}${prev ? `<div class="st" style="color:#ff8a98">${prev}</div>` : ''}${btn}`;
    el.classList.add('on');
    el.querySelector<HTMLButtonElement>('[data-buy]')?.addEventListener('click', () => this.buy(n.id));
    el.querySelector<HTMLButtonElement>('.sx')!.onclick = () => { this.sel = undefined; this.render(); };
  }

  // Drag to pan, wheel / pinch to zoom.
  private dragged = false;
  private bindPan() {
    const vp = this.el.querySelector<HTMLElement>('.vp')!;
    const pts = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 }, pinch = 0;
    vp.onpointerdown = e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { x: e.clientX, y: e.clientY }; this.dragged = false; pinch = 0; };
    vp.onpointermove = e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) this.dragged = true;
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomAt(this.view.z * d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d;
        return;
      }
      this.view.x += dx; this.view.y += dy;
      this.apply();
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; setTimeout(() => { if (!pts.size) this.dragged = false; }, 0); };
    vp.onpointerup = up; vp.onpointercancel = up; vp.onpointerleave = up;
    vp.onwheel = e => { e.preventDefault(); this.zoomAt(this.view.z * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY); };
  }

  private zoomAt(z: number, sx: number, sy: number) {
    z = Math.min(1.6, Math.max(0.35, z));
    const k = z / this.view.z;
    this.view.x = sx - (sx - this.view.x) * k;
    this.view.y = sy - (sy - this.view.y) * k;
    this.view.z = z;
    this.apply();
  }
}

const FX_TEXT: Record<string, (v: number) => string> = {
  vitCost: v => `${v >= 0 ? '−' : '+'}${Math.abs(v)} ${L('de cansaço por coleta', 'fatigue per collection')}`,
  moraleUp: v => `+${v} ${L('de moral ao acordar', 'morale on waking')}`,
  offers: v => `+${v} ${L('oferta', 'offer')}`,
  collectMorale: v => `+${v} ${L('de moral por coleta', 'morale per collection')}`,
  unitCost: v => `−${Math.round(v * 100)}% ${L('de custo das unidades', 'unit cost')}`,
  researchCost: v => `−${Math.round(v * 100)}% ${L('de custo de pesquisa', 'research cost')}`,
  raidSize: v => `−${Math.round(v * 100)}% ${L('de tamanho da horda', 'horde size')}`,
  quota: v => `−${Math.round(v * 100)}% ${L('de cota', 'quota')}`,
};
const FX_NAME: Record<string, string> = {
  blood: L('Sangue', 'Blood'), collectSpeed: L('velocidade de coleta', 'collection speed'), regen: L('recuperação', 'recovery'), sleep: L('sono mais curto', 'shorter sleep'),
  grow: L('crescimento', 'growth'), harvest: L('Comida', 'Food'), kin: L('parentes', 'relatives'), heirQ: L('qualidade de parentes', 'relative quality'),
  bond: L('vínculos', 'bonds'), titheGold: L('Ouro da Sangria', 'Bloodletting Gold'), contractGold: L('Ouro de contratos', 'contract Gold'), quota: L('cota menor', 'lower quota'),
  unitDmg: L('dano', 'damage'), unitHp: L('vida', 'health'), chalice: L('Cálices', 'Chalices'), unitCost: L('custo menor', 'lower cost'), essence: L('Essência', 'Essence'),
  orb: L('valor dos orbes', 'orb value'), orbRate: L('orbes', 'orbs'), defense: L('recompensa de defesa', 'defense reward'), raidSize: L('lobos a menos', 'fewer wolves'),
  researchCost: L('custo de pesquisa', 'research cost'), moraleBlood: L('Sangue com moral alta', 'Blood at high morale'), food: L('Comida', 'Food'), vigil: '',
};
export function fmtFx(k: string, v: number) {
  if (FX_TEXT[k]) return FX_TEXT[k](Math.round(v * 100) / 100);
  return `+${Math.round(v * 100)}% ${FX_NAME[k] ?? k}`;
}
