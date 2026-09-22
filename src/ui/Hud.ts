// Top resource bar (GDD §15.1: compact, resources on top). Plain HTML; art skin comes with the HUD assets.
import { state, quotaFor, NIGHT_MS, MAX_STRIKES } from '../core/state';

const CSS = `
.hud{position:fixed;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);z-index:5;display:flex;gap:6px;padding:6px 8px;
  font:600 14px Georgia,serif;color:#f3e2c8;user-select:none;pointer-events:none;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 32px)}
.hud .r{display:flex;align-items:center;gap:6px;padding:5px 10px;background:#140a10d9;border:1px solid #5a1a24;border-radius:5px;
  box-shadow:0 2px 6px #0008;pointer-events:auto}
.hud .i{width:10px;height:10px;border-radius:50%}
.hud .blood .i{background:#e0142a;border-radius:50% 0 50% 50%;transform:rotate(-45deg)}
.hud .gold .i{background:#e8b54a}
.hud .prestige .i{background:#9b4dcc;border-radius:2px;transform:rotate(45deg)}
.hud .food .i{background:#9fd86b;border-radius:40% 40% 50% 50%}
.hud .pop .i{background:#d8c8a8}
.hud .morale .i{background:#6fbf73}
.hud .low{border-color:#d8122a;animation:pulse 1s infinite alternate}@keyframes pulse{to{box-shadow:0 0 10px #d8122a}}
.hud .ic{height:20px;width:auto;margin:-2px 0}
.hud .quest{order:11;flex-basis:100%;max-width:420px;justify-content:center;border-color:#e8b54a;color:#f6d9a0}
.hud .quest .qp{color:#e8b54a}
.hud .quest.new{animation:qnew .6s ease-out 2}@keyframes qnew{50%{box-shadow:0 0 14px #e8b54a}}
.hud .v{min-width:28px;text-align:right;font-variant-numeric:tabular-nums}
.hud .menu{pointer-events:auto;cursor:pointer;background:#140a10d9;border:1px solid #5a1a24;color:#f3e2c8;border-radius:5px;font:inherit;padding:5px 9px}
.hud .night{flex-direction:column;align-items:stretch;gap:3px;min-width:170px}
.hud .night .top{display:flex;justify-content:space-between;gap:10px}
.hud .night .bar{height:6px;background:#2a1016;border-radius:3px;overflow:hidden}
.hud .night .fill{height:100%;background:#d8122a;transition:width .25s}
.hud .night.behind .fill{background:#8a1a28}
.hud .night.done .fill{background:#e8b54a}
.hud .strikes{color:#ff5a6a;letter-spacing:2px}
.toasts{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none;width:calc(100vw - 32px);max-width:460px}
.toast{padding:8px 14px;background:#140a10f0;border:1px solid #5a1a24;border-radius:6px;color:#f3e2c8;font:600 14px Georgia,serif;text-align:center;
  box-shadow:0 3px 10px #000a;animation:tin .25s ease-out}
.toast{display:flex;align-items:center;gap:10px;text-align:left}.toast img{width:40px;height:40px;border-radius:4px;border:1px solid #6b1d2a;flex:none}
.toast.bad{border-color:#d8122a}.toast.good{border-color:#e8b54a}
@keyframes tin{from{opacity:0;transform:translateY(-6px)}}
@media (max-width:600px){
  .hud{font-size:12px;gap:4px;padding:4px;max-width:100vw;width:100vw;box-sizing:border-box}
  .hud .r{padding:3px 6px;gap:4px}
  .hud .ic{height:15px}
  .hud .quest{order:11;flex-basis:100%;max-width:420px;justify-content:center;border-color:#e8b54a;color:#f6d9a0}
.hud .quest .qp{color:#e8b54a}
.hud .quest.new{animation:qnew .6s ease-out 2}@keyframes qnew{50%{box-shadow:0 0 14px #e8b54a}}
.hud .v{min-width:18px}
  .hud .night{order:10;flex-basis:100%;min-width:0;max-width:340px}
  .hud .menu{padding:3px 7px;font-size:11px}
  .toast{font-size:13px;padding:7px 10px}
  .toast img{width:32px;height:32px}
}
`;

export interface HudSource { population: number; avgMorale: number }

export class Hud {
  private el: HTMLDivElement;
  private vals: Record<string, HTMLElement> = {};
  private night!: HTMLDivElement;
  private toasts!: HTMLDivElement;
  private quest!: HTMLDivElement;

  constructor(private src: HudSource, onNewGame: () => void) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'hud';
    // [key, label, icon file] — keys without an icon keep the CSS dot
    const items: [string, string, string?][] = [['blood', 'Sangue', 'icon_blood'], ['gold', 'Ouro', 'icon_gold'], ['prestige', 'Prestígio', 'icon_prestige'],
      ['food', 'Comida'], ['pop', 'População', 'icon_population'], ['morale', 'Moral', 'icon_morale']];
    for (const [k, label, icon] of items) {
      const r = document.createElement('div');
      r.className = `r ${k}`;
      r.title = label;
      r.innerHTML = `${icon ? `<img class="ic" src="assets/${icon}.webp" alt="">` : '<span class="i"></span>'}<span class="v">0</span>`;
      this.vals[k] = r.querySelector('.v')!;
      this.el.appendChild(r);
    }
    const night = document.createElement('div');
    night.className = 'r night';
    night.title = 'Dízimo: Sangue que o castelo cobra ao fim de cada noite';
    night.innerHTML = '<div class="top"><span class="n"></span><span class="t"></span></div><div class="bar"><div class="fill"></div></div>' +
      '<div class="top"><span class="q"></span><span class="strikes"></span></div>';
    this.night = night;
    this.el.appendChild(night);
    const quest = document.createElement('div');
    quest.className = 'r quest';
    quest.innerHTML = '<img class="ic" src="assets/icon_quest.webp" alt=""><span class="qt"></span><span class="qp"></span>';
    quest.style.display = 'none';
    this.quest = quest;
    this.el.appendChild(quest);
    const menu = document.createElement('button');
    menu.className = 'menu';
    menu.textContent = 'Novo jogo';
    menu.onclick = () => { if (confirm('Apagar o progresso e começar de novo?')) onNewGame(); };
    this.el.appendChild(menu);
    document.body.appendChild(this.el);
    this.toasts = document.createElement('div');
    this.toasts.className = 'toasts';
    document.body.appendChild(this.toasts);
    setInterval(() => this.refresh(), 250);
    this.refresh();
  }

  private refresh() {
    const r = state.resources;
    this.vals.blood.textContent = String(Math.floor(r.blood));
    this.vals.gold.textContent = String(Math.floor(r.gold));
    this.vals.prestige.textContent = String(Math.floor(r.prestige));
    this.vals.food.textContent = String(Math.floor(r.food));
    this.vals.food.parentElement!.classList.toggle('low', r.food < 10);
    this.vals.pop.textContent = String(this.src.population);
    this.vals.morale.textContent = String(Math.round(this.src.avgMorale));

    const n = state.night, quota = quotaFor(n.night);
    const left = Math.max(0, NIGHT_MS - n.elapsed), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    const q = (sel: string) => this.night.querySelector(sel)!;
    q('.n').textContent = `Noite ${n.night}`;
    q('.t').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    q('.q').textContent = `Dízimo ${Math.floor(Math.min(r.blood, quota))}/${quota}`;
    q('.strikes').textContent = '✕'.repeat(n.strikes) + '·'.repeat(MAX_STRIKES - n.strikes);
    (q('.fill') as HTMLElement).style.width = `${Math.min(100, (r.blood / quota) * 100)}%`;
    const pace = n.elapsed / NIGHT_MS;
    this.night.classList.toggle('done', r.blood >= quota);
    this.night.classList.toggle('behind', r.blood < quota && r.blood / quota < pace - 0.15);
  }

  // Current tutorial/quest objective, always visible while active.
  objective(text: string | null, progress?: string) {
    this.quest.style.display = text ? 'flex' : 'none';
    if (!text) return;
    this.quest.querySelector('.qt')!.textContent = text;
    this.quest.querySelector('.qp')!.textContent = progress ?? '';
    this.quest.classList.remove('new'); void this.quest.offsetWidth; this.quest.classList.add('new');
  }

  toast(msg: string, kind: 'good' | 'bad' | '' = '', ms = 5000) {
    this.toasts.style.top = `${this.el.getBoundingClientRect().bottom + 8}px`; // just below the HUD, however it wrapped
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    // A character speaking ("Bóris: ...") gets their portrait next to the line.
    const who = msg.match(/(Bóris|Vesper|Rubélia|Hemático|Aureliano|Davi|Lia):/)?.[1];
    const key = who && { 'Bóris': 'boris', Vesper: 'vesper', 'Rubélia': 'rubelia', 'Hemático': 'hematico', Aureliano: 'aureliano', Davi: 'davi', Lia: 'lia' }[who];
    if (key) {
      const img = document.createElement('img');
      img.src = `assets/portrait_${key}.webp`;
      img.alt = who!;
      t.appendChild(img);
    }
    t.appendChild(document.createTextNode(msg));
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
}
