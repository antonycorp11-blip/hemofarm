// HUD (GDD §15.1: map first, compact UI). One slim resource bar + a tithe strip, a floating objective card,
// a ☰ menu and toasts. Plain HTML so it stays crisp on phones.
import { state, quotaFor, NIGHT_MS, MAX_STRIKES } from '../core/state';

const CSS = `
.hud{position:fixed;top:0;left:0;right:0;z-index:5;pointer-events:none;user-select:none;
  padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px));
  font:600 14px Georgia,serif;color:#f3e2c8;display:flex;flex-direction:column;align-items:center;gap:5px}
.hud .bar{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:4px 6px;background:#120a10e8;border:1px solid #4a1620;
  border-radius:10px;box-shadow:0 3px 10px #000a;max-width:100%;box-sizing:border-box}
.hud .res{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:6px}
.hud .res img{height:18px;width:auto}
.hud .res .v{font-variant-numeric:tabular-nums;min-width:14px}
.hud .res.low{background:#5a0f1a;animation:pulse 1s infinite alternate}@keyframes pulse{to{background:#8a1424}}
.hud .res.food .dot{width:12px;height:12px;border-radius:40% 40% 50% 50%;background:#9fd86b}
.hud .menu{pointer-events:auto;background:none;border:0;color:#e0c8a8;font-size:20px;line-height:1;padding:2px 8px;cursor:pointer}
.hud .tithe{pointer-events:auto;position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;padding:3px 12px;
  background:#120a10e8;border:1px solid #4a1620;border-radius:8px;font-size:12px;box-shadow:0 3px 10px #000a}
.hud .tithe .fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#5a0f1a,#8a1424);transition:width .3s;z-index:0}
.hud .tithe.done .fill{background:linear-gradient(90deg,#6a5010,#a07818)}
.hud .tithe.behind{border-color:#d8122a}
.hud .tithe span{position:relative;z-index:1;white-space:nowrap}
.hud .tithe .t{font-variant-numeric:tabular-nums;color:#f6d9a0}
.hud .tithe .x{color:#ff6a78;letter-spacing:2px}
.quest{position:fixed;left:max(10px,env(safe-area-inset-left,0px));top:var(--hud-bottom,90px);z-index:5;display:none;align-items:center;gap:8px;
  max-width:min(300px,calc(100vw - 20px));padding:7px 8px 7px 10px;background:#140c0ef0;border:1px solid #a07818;border-radius:10px;
  box-shadow:0 4px 12px #000b;color:#f6d9a0;font:600 13px Georgia,serif}
.quest.on{display:flex}.quest.new{animation:qnew .7s ease-out 2}@keyframes qnew{50%{box-shadow:0 0 16px #e8b54a}}
.quest img{width:22px;height:22px;flex:none}
.quest .qt{flex:1;line-height:1.25}.quest .qp{color:#e8b54a;margin-left:4px}
.quest button{flex:none;background:#8a1424;border:1px solid #2a0a10;color:#fff3e0;border-radius:6px;font:600 12px Georgia,serif;padding:6px 9px;cursor:pointer}
.toasts{position:fixed;left:50%;transform:translateX(-50%);top:var(--hud-bottom,90px);z-index:6;display:flex;flex-direction:column;gap:6px;
  align-items:center;pointer-events:none;width:calc(100vw - 24px);max-width:440px}
.quest.on ~ .toasts{top:calc(var(--hud-bottom,90px) + 52px)}
.toast{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#140a10f2;border:1px solid #5a1a24;border-radius:8px;color:#f3e2c8;
  font:600 13px Georgia,serif;box-shadow:0 3px 10px #000a;animation:tin .25s ease-out}
.toast img{width:34px;height:34px;border-radius:5px;border:1px solid #6b1d2a;flex:none}
.toast.bad{border-color:#d8122a}.toast.good{border-color:#e8b54a}
@keyframes tin{from{opacity:0;transform:translateY(-6px)}}
.hmenu{position:fixed;inset:0;z-index:30;display:none;background:#000a;align-items:flex-start;justify-content:center}
.hmenu.on{display:flex}
.hmenu .box{margin-top:calc(env(safe-area-inset-top,0px) + 60px);width:min(300px,calc(100vw - 32px));background:#140a10;border:1px solid #6b1d2a;
  border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;font:15px Georgia,serif;color:#f3e2c8}
.hmenu button{min-height:44px;border-radius:7px;border:1px solid #4a1620;background:#241218;color:#f3e2c8;font:inherit;cursor:pointer}
.hmenu button.danger{border-color:#8a1424;color:#ff9aa4}
@media (max-width:520px){
  .hud{font-size:13px}.hud .res{padding:2px 5px;gap:3px}.hud .res img{height:16px}
  .hud .res.prestige{display:none}  /* least urgent number on small screens: shown in the menu instead */
}
`;

export interface HudSource { population: number; avgMorale: number }
export interface HudActions { onNewGame(): void; onSkipTutorial(): void; tutorialActive(): boolean; onWhere(): void }

export class Hud {
  private root: HTMLDivElement;
  private vals: Record<string, HTMLElement> = {};
  private res: Record<string, HTMLElement> = {};
  private tithe: HTMLDivElement;
  private quest: HTMLDivElement;
  private toasts: HTMLDivElement;
  private menu: HTMLDivElement;

  constructor(private src: HudSource, private actions: HudActions) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'hud';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu';
    menuBtn.setAttribute('aria-label', 'Menu');
    menuBtn.textContent = '☰';
    menuBtn.onclick = () => this.openMenu();
    bar.appendChild(menuBtn);
    // [key, label, icon] — no icon means a CSS shape
    const items: [string, string, string?][] = [['blood', 'Sangue', 'icon_blood'], ['gold', 'Ouro', 'icon_gold'], ['food', 'Comida'],
      ['pop', 'População', 'icon_population'], ['morale', 'Moral', 'icon_morale'], ['prestige', 'Prestígio', 'icon_prestige']];
    for (const [k, label, icon] of items) {
      const r = document.createElement('div');
      r.className = `res ${k}`;
      r.title = label;
      r.innerHTML = `${icon ? `<img src="assets/${icon}.webp" alt="${label}">` : '<span class="dot"></span>'}<span class="v">0</span>`;
      this.vals[k] = r.querySelector('.v')!;
      this.res[k] = r;
      bar.appendChild(r);
    }
    this.root.appendChild(bar);

    this.tithe = document.createElement('div');
    this.tithe.className = 'tithe';
    this.tithe.title = 'Dízimo: Sangue que o castelo cobra ao fim de cada noite';
    this.tithe.innerHTML = '<div class="fill"></div><span class="n"></span><span class="q"></span><span class="t"></span><span class="x"></span>';
    this.tithe.onclick = () => this.toast(`Vesper: Ao fim da noite, ${quotaFor(state.night.night)} de Sangue. Se faltar, levamos humanos. Três faltas e a propriedade é minha.`, '', 6000);
    this.root.appendChild(this.tithe);
    document.body.appendChild(this.root);

    this.quest = document.createElement('div');
    this.quest.className = 'quest';
    this.quest.innerHTML = '<img src="assets/icon_quest.webp" alt=""><span class="qt"></span><span class="qp"></span><button>Onde?</button>';
    this.quest.querySelector('button')!.onclick = () => actions.onWhere();
    document.body.appendChild(this.quest);

    this.toasts = document.createElement('div');
    this.toasts.className = 'toasts';
    document.body.appendChild(this.toasts);

    this.menu = document.createElement('div');
    this.menu.className = 'hmenu';
    this.menu.onclick = e => { if (e.target === this.menu) this.menu.classList.remove('on'); };
    document.body.appendChild(this.menu);

    setInterval(() => this.refresh(), 250);
    this.refresh();
  }

  private refresh() {
    const r = state.resources;
    this.vals.blood.textContent = String(Math.floor(r.blood));
    this.vals.gold.textContent = String(Math.floor(r.gold));
    this.vals.prestige.textContent = String(Math.floor(r.prestige));
    this.vals.food.textContent = String(Math.floor(r.food));
    this.vals.pop.textContent = String(this.src.population);
    this.vals.morale.textContent = String(Math.round(this.src.avgMorale));
    this.res.food.classList.toggle('low', r.food < 10);

    const n = state.night, quota = quotaFor(n.night);
    const left = Math.max(0, NIGHT_MS - n.elapsed), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    const q = (sel: string) => this.tithe.querySelector<HTMLElement>(sel)!;
    q('.n').textContent = `Noite ${n.night}`;
    q('.q').textContent = `Dízimo ${Math.floor(Math.min(r.blood, quota))}/${quota}`;
    q('.t').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    q('.x').textContent = '✕'.repeat(n.strikes) + '·'.repeat(MAX_STRIKES - n.strikes);
    q('.fill').style.width = `${Math.min(100, (r.blood / quota) * 100)}%`;
    this.tithe.classList.toggle('done', r.blood >= quota);
    this.tithe.classList.toggle('behind', r.blood < quota && r.blood / quota < n.elapsed / NIGHT_MS - 0.15);
    // Floating elements sit just below the HUD, however tall it is on this screen.
    document.documentElement.style.setProperty('--hud-bottom', `${this.root.getBoundingClientRect().bottom + 8}px`);
  }

  // Objective card: always visible while a mission is active, with a "where?" shortcut.
  objective(text: string | null, progress?: string) {
    this.quest.classList.toggle('on', !!text);
    if (!text) return;
    this.quest.querySelector('.qt')!.textContent = text;
    this.quest.querySelector('.qp')!.textContent = progress ?? '';
    this.quest.classList.remove('new'); void this.quest.offsetWidth; this.quest.classList.add('new');
  }

  private openMenu() {
    const r = state.resources;
    this.menu.innerHTML = `<div class="box"><div style="text-align:center;color:#c9a98a;font-size:13px">Prestígio ${Math.floor(r.prestige)} · Noite ${state.night.night}</div></div>`;
    const box = this.menu.querySelector('.box')!;
    const add = (label: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.textContent = label; b.className = cls;
      b.onclick = () => { this.menu.classList.remove('on'); fn(); };
      box.appendChild(b);
    };
    add('Continuar', () => undefined);
    if (this.actions.tutorialActive()) add('Pular tutorial', () => { if (confirm('Pular o tutorial?')) this.actions.onSkipTutorial(); });
    add('Novo jogo', () => { if (confirm('Apagar o progresso e começar de novo?')) this.actions.onNewGame(); }, 'danger');
    this.menu.classList.add('on');
  }

  toast(msg: string, kind: 'good' | 'bad' | '' = '', ms = 5000) {
    while (this.toasts.children.length >= 3) this.toasts.firstElementChild!.remove(); // never bury the map in messages
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
