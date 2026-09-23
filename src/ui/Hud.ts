// HUD (GDD §15.1: map first, compact UI). One slim resource bar + a tithe strip, a floating objective card,
// a ☰ menu and toasts. Plain HTML so it stays crisp on phones.
import { state, quotaFor, NIGHT_MS, MAX_STRIKES } from '../core/state';
import { voice, sfx } from '../core/sfx';

const CSS = `
.hud{position:fixed;top:0;left:0;right:0;z-index:5;pointer-events:none;user-select:none;
  padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px));
  font:600 14px Georgia,serif;color:#f3e2c8;display:flex;flex-direction:column;align-items:center;gap:5px}
.hud .bar{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:4px 6px;background:#120a10e8;border:1px solid #4a1620;
  border-radius:10px;box-shadow:0 3px 10px #000a;max-width:100%;box-sizing:border-box}
.hud .res{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:6px}
.hud .res img{height:18px;width:auto}
.hud .res .v{font-variant-numeric:tabular-nums;min-width:14px}
.hud .res .rate{font:600 10px system-ui;color:#ff8a98;margin-left:1px}
.hud .res.low{background:#5a0f1a;animation:pulse 1s infinite alternate}@keyframes pulse{to{background:#8a1424}}
.hud .res.food .dot{width:12px;height:12px;border-radius:40% 40% 50% 50%;background:#9fd86b}
.hud .deals{pointer-events:auto;position:relative;background:none;border:0;padding:0 4px 0 6px;cursor:pointer}.hud .deals img{height:22px;display:block}
.hud .deals .badge{position:absolute;top:-6px;right:-4px;min-width:15px;height:15px;border-radius:8px;background:#d8122a;color:#fff;font:700 10px/15px system-ui;text-align:center;padding:0 3px}
.hud .crown img{filter:drop-shadow(0 0 6px #e8b54a);animation:qnew 1s ease-in-out infinite alternate}
.hud .menu{pointer-events:auto;background:none;border:0;color:#e0c8a8;font-size:20px;line-height:1;padding:2px 8px;cursor:pointer}
.hud .tithe{pointer-events:auto;position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;padding:3px 12px;
  background:#120a10e8;border:1px solid #4a1620;border-radius:8px;font-size:12px;box-shadow:0 3px 10px #000a}
.hud .tithe .fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#5a0f1a,#8a1424);transition:width .3s;z-index:0}
.hud .tithe.done .fill{background:linear-gradient(90deg,#6a5010,#a07818)}
.hud .tithe.behind{border-color:#d8122a}
.hud .tithe span{position:relative;z-index:1;white-space:nowrap;font-variant-numeric:tabular-nums}
.hud .tithe .q{min-width:8.6em}.hud .tithe .t{min-width:2.6em}.hud .tithe .x{min-width:5.4em}
.hud .tithe .t{font-variant-numeric:tabular-nums;color:#f6d9a0}
.hud .row2{display:flex;gap:6px;align-items:center;pointer-events:none}
.hud .speed{pointer-events:auto;min-width:40px;height:30px;border-radius:8px;border:1px solid #4a1620;background:#120a10e8;color:#f3e2c8;font:700 13px Georgia,serif;cursor:pointer}
.hud .speed.fast{color:#f6d9a0;box-shadow:0 0 8px #a07818}
.hud .tithe .pay{position:absolute;right:6px;top:50%;transform:translateY(-50%);z-index:2;visibility:hidden;white-space:nowrap;padding:2px 8px;border-radius:5px;border:1px solid #2a0a10;background:#a07818;color:#1a0a0e;font:700 11px Georgia,serif;cursor:pointer;animation:qnew 1s ease-in-out infinite alternate}
.hud .tithe .x{color:#ff6a78;letter-spacing:2px}
.quest{position:fixed;left:max(10px,env(safe-area-inset-left,0px));top:var(--hud-bottom,90px);z-index:5;display:none;align-items:center;gap:8px;
  max-width:min(300px,calc(100vw - 20px));padding:7px 8px 7px 10px;background:#140c0ef0;border:1px solid #a07818;border-radius:10px;
  box-shadow:0 4px 12px #000b;color:#f6d9a0;font:600 13px Georgia,serif}
.quest.on{display:flex}.quest.new{animation:qnew .7s ease-out 2}@keyframes qnew{50%{box-shadow:0 0 16px #e8b54a}}
.quest img{width:22px;height:22px;flex:none}
.quest .qt{flex:1;line-height:1.25}.quest .qp{color:#e8b54a;margin-left:4px}
.quest button{flex:none;background:#8a1424;border:1px solid #2a0a10;color:#fff3e0;border-radius:6px;font:600 12px Georgia,serif;padding:6px 9px;cursor:pointer}
.toasts{position:fixed;left:max(8px,env(safe-area-inset-left,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:4;display:flex;flex-direction:column;
  gap:4px;align-items:flex-start;pointer-events:none;width:min(330px,calc(100vw - 16px))}
.toast{display:flex;align-items:center;gap:7px;padding:4px 9px 4px 5px;background:#0d070acc;border-left:3px solid #8a6a60;border-radius:0 8px 8px 0;color:#eadbc4;
  font:600 12px/1.25 Georgia,serif;box-shadow:0 2px 6px #0008;animation:tin .25s ease-out;transition:opacity .5s}
.toast.out{opacity:0}
.toast img{width:24px;height:24px;border-radius:4px;flex:none}
.toast.bad{border-left-color:#e0283c}.toast.good{border-left-color:#e8b54a}
body.dlg-open .toasts{display:none}
.hlog{max-height:60vh;overflow:auto;display:flex;flex-direction:column;gap:4px;font-size:12px;text-align:left}
.hlog div{padding:4px 8px;border-left:3px solid #5a4a48;background:#1a0f14;border-radius:0 6px 6px 0}.hlog .good{border-left-color:#e8b54a}.hlog .bad{border-left-color:#e0283c}
@keyframes tin{from{opacity:0;transform:translateX(-10px)}}
.evt{position:fixed;right:max(10px,env(safe-area-inset-right,0px));top:var(--hud-bottom,90px);z-index:6;display:none;align-items:center;gap:6px;
  max-width:min(220px,45vw);padding:8px 10px;border:8px solid transparent;border-image:url(assets/frame_tooltip.webp) 18 fill / 8px stretch;background:none;
  color:#f6d9a0;font:600 13px Georgia,serif;text-align:left;cursor:pointer;animation:evtp 1.2s ease-in-out infinite alternate}
.evt.on{display:flex}.evt img{height:22px}.evt.urgent{color:#ffb0b8}
@keyframes evtp{to{filter:drop-shadow(0 0 8px #e8b54a)}}.evt.urgent{animation-name:evtu}@keyframes evtu{to{filter:drop-shadow(0 0 10px #d8122a)}}
.evt.raid{top:calc(var(--hud-bottom,90px) + 52px)}
body.in-battle .hud,body.in-battle .toasts,body.in-battle .quest,body.in-battle .evt,body.in-battle .dlg,body.in-battle .bpanel,body.in-battle .hud .tithe,body.in-battle .hud .speed{display:none!important}
@media (orientation:landscape) and (max-height:520px){
  .hud{flex-direction:row;justify-content:center;gap:6px;padding-top:calc(env(safe-area-inset-top,0px) + 4px);font-size:13px}
  .hud .bar{padding:2px 4px}.hud .res{padding:1px 5px}.hud .res img{height:16px}
  .hud .tithe{padding:2px 8px;gap:6px;font-size:11px}.hud .speed{height:28px;min-width:34px}
  .hud .res{padding:1px 3px;gap:2px}.hud .res.prestige{display:none}.hud .deals{padding:0 2px}.hud .deals img{height:19px}.hud .menu{padding:2px 4px}
  .quest{max-width:260px;padding:4px 6px 4px 8px;font-size:12px}
  .evt{max-width:200px;font-size:12px;padding:6px 8px}
}
.hmenu{position:fixed;inset:0;z-index:30;display:none;background:#000a;align-items:flex-start;justify-content:center}
.hmenu.on{display:flex}
.hmenu .box{max-height:calc(100dvh - 80px);overflow:auto}
@media (orientation:landscape) and (max-height:520px){.hmenu .box{margin-top:calc(env(safe-area-inset-top,0px) + 10px);width:min(520px,calc(100vw - 32px));
  display:grid!important;grid-template-columns:1fr 1fr;max-height:calc(100dvh - 20px)}.hmenu .box>div,.hmenu .box>b,.hmenu .hlog{grid-column:1/-1}.hmenu button{min-height:36px}}
.hmenu .box{margin-top:calc(env(safe-area-inset-top,0px) + 60px);width:min(300px,calc(100vw - 32px));background:#140a10;border:1px solid #6b1d2a;
  border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;font:15px Georgia,serif;color:#f3e2c8}
.hmenu button{min-height:44px;border-radius:7px;border:1px solid #4a1620;background:#241218;color:#f3e2c8;font:inherit;cursor:pointer}
.hmenu button.danger{border-color:#8a1424;color:#ff9aa4}
@media (max-width:520px){
  .hud{font-size:13px}.hud .res{padding:2px 5px;gap:3px}.hud .res img{height:16px}
  .hud .res.prestige{display:none}  /* least urgent number on small screens: shown in the menu instead */
}
`;

export interface HudSource { population: number; avgMorale: number; ordersReady: number; treeReady: boolean; hasLab: boolean }
export interface HudActions { onNewGame(): void; onSkipTutorial(): void; tutorialActive(): boolean; onWhere(): void; onContracts(): void;
  onSpeed(): void; onPayTithe(): void; onMap(): void; onAscend(): void; onSound(): void;
  onOrders(): void; onTree(): void; onRelics(): void; onAlbum(): void; onArsenal(): void; onBloodMoon(): void; onHunt(): void;
  onMusic(): void; info(): { goal: number; region: string; mute: boolean; music: boolean } }

export class Hud {
  private root: HTMLDivElement;
  private vals: Record<string, HTMLElement> = {};
  private res: Record<string, HTMLElement> = {};
  private tithe: HTMLDivElement;
  private quest: HTMLDivElement;
  private toasts: HTMLDivElement;
  private menu: HTMLDivElement;
  private deals!: HTMLButtonElement;
  private ordersBtn!: HTMLButtonElement;
  private treeBtn!: HTMLButtonElement;
  private samples: number[] = [];
  private sampleAt = 0;
  private evt!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private crown!: HTMLButtonElement;
  private evtClick?: () => void;
  private raid!: HTMLButtonElement;
  private raidClick?: () => void;

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
    menuBtn.onclick = () => { sfx.open(); this.openMenu(); };
    bar.appendChild(menuBtn);
    // [key, label, icon] — no icon means a CSS shape
    const items: [string, string, string?][] = [['blood', 'Sangue', 'icon_blood'], ['gold', 'Ouro', 'icon_gold'], ['essence', 'Essência', 'icon_research'], ['food', 'Comida'],
      ['pop', 'População', 'icon_population'], ['morale', 'Moral', 'icon_morale'], ['tension', 'Tensão', 'icon_tension'], ['prestige', 'Prestígio', 'icon_prestige']];
    for (const [k, label, icon] of items) {
      const r = document.createElement('div');
      r.className = `res ${k}`;
      r.title = label;
      r.innerHTML = `${icon ? `<img src="assets/${icon}.webp" alt="${label}">` : '<span class="dot"></span>'}<span class="v">0</span>`;
      if (k === 'blood') r.insertAdjacentHTML('beforeend', '<small class="rate"></small>');
      this.vals[k] = r.querySelector('.v')!;
      this.res[k] = r;
      bar.appendChild(r);
    }
    const deals = document.createElement('button');
    deals.className = 'deals';
    deals.setAttribute('aria-label', 'Contratos');
    deals.innerHTML = '<img src="assets/icon_contracts.webp" alt=""><span class="badge"></span>';
    deals.onclick = () => actions.onContracts();
    const crown = document.createElement('button');
    crown.className = 'deals crown';
    crown.setAttribute('aria-label', 'Encerrar mandato');
    crown.innerHTML = '<img src="assets/icon_prestige.webp" alt="">';
    crown.onclick = () => actions.onAscend();
    crown.style.display = 'none';
    this.crown = crown;
    this.deals = deals;
    bar.appendChild(deals);
    const mk = (cls: string, icon: string, label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = `deals ${cls}`;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = `<img src="assets/${icon}.webp" alt=""><span class="badge"></span>`;
      b.onclick = fn;
      bar.appendChild(b);
      return b;
    };
    this.ordersBtn = mk('orders', 'icon_quest', 'Encomendas do Castelo', () => actions.onOrders());
    this.treeBtn = mk('tree', 'icon_research', 'Árvore de pesquisas', () => actions.onTree());
    bar.appendChild(crown);
    this.root.appendChild(bar);

    this.tithe = document.createElement('div');
    this.tithe.className = 'tithe';
    this.tithe.title = 'Sangria: Sangue que o castelo cobra ao fim de cada noite';
    this.tithe.innerHTML = '<div class="fill"></div><span class="n"></span><span class="q"></span><span class="t"></span><span class="x"></span><button class="pay">Pagar agora ▸</button>';
    this.tithe.onclick = e => {
      if ((e.target as HTMLElement).classList.contains('pay')) { actions.onPayTithe(); return; }
      this.toast(`Vesper: Ao fim da noite, ${quotaFor(state.night.night)} de Sangue. Se faltar, levamos humanos. Três faltas e a propriedade é minha.`, '', 6000);
    };
    const speed = document.createElement('button');
    speed.className = 'speed';
    speed.textContent = '1×';
    speed.setAttribute('aria-label', 'Velocidade do jogo');
    speed.onclick = () => actions.onSpeed();
    this.speedBtn = speed;
    const row = document.createElement('div');
    row.className = 'row2';
    row.append(this.tithe, speed);
    this.root.appendChild(row);
    document.body.appendChild(this.root);

    this.quest = document.createElement('div');
    this.quest.className = 'quest';
    this.quest.innerHTML = '<img src="assets/icon_quest.webp" alt=""><span class="qt"></span><span class="qp"></span><button>Onde?</button>';
    this.quest.querySelector('button')!.onclick = () => actions.onWhere();
    document.body.appendChild(this.quest);

    this.raid = document.createElement('button');
    this.raid.className = 'evt urgent raid';
    this.raid.onclick = () => this.raidClick?.();
    document.body.appendChild(this.raid);

    this.evt = document.createElement('button');
    this.evt.className = 'evt';
    this.evt.onclick = () => this.evtClick?.();
    document.body.appendChild(this.evt);

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
    this.vals.essence.textContent = String(Math.floor(r.essence));
    this.res.essence.style.display = this.src.hasLab || r.essence > 0 ? 'flex' : 'none';
    // Blood per minute: positive changes over the last minute (spending doesn't count against it).
    const now = performance.now();
    if (now - this.sampleAt >= 1000) {
      this.sampleAt = now;
      this.samples.push(r.blood);
      if (this.samples.length > 61) this.samples.shift();
    }
    let gain = 0;
    for (let i = 1; i < this.samples.length; i++) gain += Math.max(0, this.samples[i] - this.samples[i - 1]);
    const perMin = this.samples.length > 5 ? Math.round(gain * 60 / (this.samples.length - 1)) : 0;
    state.bloodRate = perMin;
    this.res.blood.querySelector<HTMLElement>('.rate')!.textContent = perMin ? `+${perMin}/min` : '';
    const ob = this.ordersBtn.querySelector<HTMLElement>('.badge')!;
    ob.textContent = this.src.ordersReady ? String(this.src.ordersReady) : '';
    ob.style.display = ob.textContent ? 'block' : 'none';
    this.ordersBtn.classList.toggle('crown', this.src.ordersReady > 0);
    this.treeBtn.style.display = this.src.hasLab ? 'block' : 'none';
    const tb = this.treeBtn.querySelector<HTMLElement>('.badge')!;
    tb.textContent = this.src.treeReady ? '!' : '';
    tb.style.display = tb.textContent ? 'block' : 'none';
    this.vals.pop.textContent = String(this.src.population);
    this.vals.morale.textContent = String(Math.round(this.src.avgMorale));
    this.res.food.classList.toggle('low', r.food < 10);
    // Tension is partly hidden (GDD §5): it only shows up once it starts to matter.
    const t = state.world.tension;
    this.vals.tension.textContent = String(Math.round(t));
    this.res.tension.style.display = t >= 25 ? 'flex' : 'none';
    this.res.tension.classList.toggle('low', t >= 60);
    const c = state.contracts;
    const badge = this.deals.querySelector<HTMLElement>('.badge')!;
    badge.textContent = c.active ? '!' : c.offers.length ? String(c.offers.length) : '';
    badge.style.display = badge.textContent ? 'block' : 'none';

    const n = state.night, quota = quotaFor(n.night);
    const left = Math.max(0, NIGHT_MS - n.elapsed), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    const q = (sel: string) => this.tithe.querySelector<HTMLElement>(sel)!;
    q('.n').textContent = `Noite ${n.night}`;
    q('.q').textContent = `Sangria ${Math.floor(Math.min(r.blood, quota))}/${quota}`;
    q('.t').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    q('.x').textContent = '✕'.repeat(n.strikes) + '·'.repeat(MAX_STRIKES - n.strikes);
    q('.fill').style.width = `${Math.min(100, (r.blood / quota) * 100)}%`;
    this.tithe.classList.toggle('done', r.blood >= quota);
    q('.pay').style.visibility = r.blood >= quota ? 'visible' : 'hidden'; // space is always reserved: the strip never changes size
    this.tithe.classList.toggle('behind', r.blood < quota && r.blood / quota < n.elapsed / NIGHT_MS - 0.15);
    // Floating elements sit just below the HUD, however tall it is on this screen.
    // (Skip while hidden, e.g. during a battle: a hidden HUD measures 0 and would pull everything to the top edge.)
    const hb = this.root.getBoundingClientRect();
    if (hb.height > 0) document.documentElement.style.setProperty('--hud-bottom', `${hb.bottom + 8}px`);
  }

  // Objective card: always visible while a mission is active, with a "where?" shortcut.
  objective(text: string | null, progress?: string) {
    this.quest.classList.toggle('on', !!text);
    if (!text) return;
    this.quest.querySelector('.qt')!.textContent = text;
    this.quest.querySelector('.qp')!.textContent = progress ?? '';
    this.quest.classList.remove('new'); void this.quest.offsetWidth; this.quest.classList.add('new');
  }

  // Ascension available: a glowing crown in the resource bar.
  setAscend(on: boolean) { this.crown.style.display = on ? 'block' : 'none'; }

  setSpeed(v: number) {
    this.speedBtn.textContent = `${v}×`;
    this.speedBtn.classList.toggle('fast', v > 1);
  }

  // Pending event: a pulsing chip on the right; the player opens it when ready (never a surprise modal).
  eventChip(title: string | null, onClick?: () => void, urgent = false) {
    this.evtClick = onClick;
    this.evt.classList.toggle('on', !!title);
    this.evt.classList.toggle('urgent', urgent);
    if (title) this.evt.innerHTML = `<img src="assets/${urgent ? 'icon_tension' : 'icon_quest'}.webp" alt=""><span>${title}</span>`;
  }

  // Werewolf alarm: its own chip so it never hides a pending decision event.
  raidChip(title: string | null, onClick?: () => void) {
    this.raidClick = onClick;
    this.raid.classList.toggle('on', !!title);
    if (title) this.raid.innerHTML = `<img src="assets/icon_raid.webp" alt=""><span>${title}<br><b>Defender ▸</b></span>`;
  }

  private openMenu() {
    const r = state.resources;
    const info = this.actions.info();
    this.menu.innerHTML = `<div class="box"><div style="text-align:center;color:#c9a98a;font-size:13px">${info.region} · Noite ${state.night.night}<br>` +
      `Meta do mandato: ${Math.floor(r.prestige)}/${info.goal} Prestígio</div></div>`;
    const box = this.menu.querySelector('.box')!;
    const add = (label: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.textContent = label; b.className = cls;
      b.onclick = () => { this.menu.classList.remove('on'); fn(); };
      box.appendChild(b);
    };
    add('Continuar', () => undefined);
    add('Mensagens recentes', () => this.openLog());
    add('Árvore de pesquisas', () => this.actions.onTree());
    add('Encomendas do Castelo', () => this.actions.onOrders());
    add('Relíquias do mandato', () => this.actions.onRelics());
    add('Álbum de Linhagens', () => this.actions.onAlbum());
    add('Arsenal de Aureliano', () => this.actions.onArsenal());
    if (!this.actions.tutorialActive()) { add('⚔ Caçada (campanha)', () => this.actions.onHunt()); add('Lua de Sangue (desafio)', () => this.actions.onBloodMoon()); }
    add('Mapa regional', () => this.actions.onMap());
    add(info.mute ? 'Som: desligado' : 'Som: ligado', () => this.actions.onSound());
    add(info.music ? 'Música: ligada' : 'Música: desligada', () => this.actions.onMusic());
    if (this.actions.tutorialActive()) add('Pular tutorial', () => { if (confirm('Pular o tutorial?')) this.actions.onSkipTutorial(); });
    add('Novo jogo', () => { if (confirm('Apagar o progresso e começar de novo?')) this.actions.onNewGame(); }, 'danger');
    this.menu.classList.add('on');
  }

  private log: { msg: string; kind: string }[] = [];

  // Messages: a quiet feed in the bottom-left corner (never over the middle of the farm), 2 at a time, full history in the menu.
  toast(msg: string, kind: 'good' | 'bad' | '' = '', ms = 5000) {
    this.log.push({ msg, kind });
    if (this.log.length > 40) this.log.shift();
    while (this.toasts.children.length >= 2) this.toasts.firstElementChild!.remove();
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    // A character speaking ("Bóris: ...") gets their portrait next to the line.
    const who = msg.match(/(Bóris|Vesper|Rubélia|Hemático|Aureliano|Davi|Lia|Mercador):/)?.[1];
    const key = who && { 'Bóris': 'boris', Vesper: 'vesper', 'Rubélia': 'rubelia', 'Hemático': 'hematico', Aureliano: 'aureliano', Davi: 'davi', Lia: 'lia', Mercador: 'merchant' }[who];
    if (key) {
      voice(key, 200);
      const img = document.createElement('img');
      img.src = `assets/portrait_${key}.webp`;
      img.alt = who!;
      t.appendChild(img);
    }
    t.appendChild(document.createTextNode(msg));
    this.toasts.appendChild(t);
    const life = Math.min(ms, 4500) + Math.min(2500, msg.length * 20);
    setTimeout(() => t.classList.add('out'), life);
    setTimeout(() => t.remove(), life + 500);
  }

  private openLog() {
    const esc = (x: string) => x.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    this.menu.innerHTML = `<div class="box"><b style="text-align:center;color:#f6d9a0">Mensagens recentes</b><div class="hlog">${
      [...this.log].reverse().map(l => `<div class="${l.kind}">${esc(l.msg)}</div>`).join('') || '<div>Nada por enquanto.</div>'}</div></div>`;
    const b = document.createElement('button');
    b.textContent = 'Fechar';
    b.onclick = () => this.menu.classList.remove('on');
    this.menu.querySelector('.box')!.appendChild(b);
    this.menu.classList.add('on');
  }
}
