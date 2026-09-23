// Region conquest (GDD_ADENDO A8). A mandate is won by making the region a Domain of the House:
//   1. production — the farm reaches the chapter's Blood per minute;
//   2. a Regent — a rare human, transformed into a vampire to rule the region in your place;
//   3. the pack — win defenses without losses until the region's alpha shows up, then defeat it (no more raids here).
// Domains pay Legacy by the hour, forever (also while the game is closed, up to 24 h), and give +5% Blood each.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { meta, saveMeta } from '../core/meta';
import { invalidate } from '../core/bonus';
import { sfx } from '../core/sfx';
import { QUALITY } from '../data/humans';
import { REGIONS } from '../data/regions';
import { CHAPTERS, CLEAN_WINS, DOMAIN_LEGACY_H, REGENT_COST, Chapter } from '../data/story';
import type { Line } from '../data/tutorial';
import type { Hud } from '../ui/Hud';
import type { Modal } from '../ui/Modal';
import type { Human, Humans } from './Humans';
import { L } from '../core/i18n';

export interface ConquestHost {
  say(lines: Line[], done?: () => void): void;
  finale(): void;                 // the Pack Mother fell in the Crypt: Leonor's reveal and the ending choice
  fx(k: string, x: number, y: number, s?: number): void;
  bossFight(): void;
  conquer(): void;
  abandon(): void;
}

export const domainCount = () => Object.keys(meta.domains ?? {}).length;

export class Conquest {
  private regentSpr?: Phaser.GameObjects.Sprite;
  private regentLabel?: Phaser.GameObjects.Text;
  private tick = 0;
  private made: { t: number; v: number }[] = [];
  private started = performance.now();

  constructor(private scene: Phaser.Scene, private humans: Humans, private hud: Hud, private modal: Modal, private host: ConquestHost,
    private regentSpot: { x: number; y: number }) {
    bus.on('RAID_ENDED', e => { if (e.result === 'won' && !e.losses) state.conquest.cleanWins++; });
    // Production = what the farm makes (collections and orbs), not rewards or chests.
    bus.on('BLOOD_COLLECTED', e => this.made.push({ t: performance.now(), v: e.amount }));
    bus.on('ORB_TAPPED', e => this.made.push({ t: performance.now(), v: e.amount }));
    bus.on('TUTORIAL_DONE', () => this.scene.time.delayedCall(2500, () => this.intro()));
    this.placeRegent();
    this.payDomains(true);
  }

  get chapter(): Chapter { return CHAPTERS[state.region] ?? CHAPTERS.bosque; }

  // ---------- pillars ----------
  get rateOk() { return state.conquest.bestRate >= this.chapter.rate; }
  get regentOk() { return !!state.conquest.regent; }
  get clearOk() { return state.conquest.alphaDown; }
  get bossReady() { return !state.conquest.alphaDown && state.conquest.cleanWins >= CLEAN_WINS && state.conquest.bossNight !== state.night.night; }
  get ready() { return this.rateOk && this.regentOk && this.clearOk; }

  update(dt: number) {
    const c = state.conquest;
    // Blood per minute over the last minute of play (per game minute: faster speed counts as faster production).
    const now = performance.now();
    this.made = this.made.filter(m => now - m.t < 60000);
    const span = Math.min(60000, now - this.started) / 60000;
    state.bloodRate = span > 0.25 ? Math.round(this.made.reduce((a, m) => a + m.v, 0) / span) : 0;
    if (state.bloodRate > c.bestRate && span >= 1) c.bestRate = state.bloodRate;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 2000;
    // Story beats, once each.
    const beat = (id: string, ok: boolean, lines: Line[], msg?: string) => {
      c.beats ??= [];
      if (!ok || c.beats.includes(id)) return;
      c.beats.push(id);
      if (msg) this.hud.toast(msg, 'good', 7000);
      if (lines.length) this.host.say(lines);
    };
    if (!state.tutorial.done) return;
    if (!c.introSeen) { this.intro(); return; }
    // A short hook at the start of each new night of the chapter (GDD_ADENDO A9), one per night, in order.
    const hook = c.hook ??= { night: state.night.night, i: 0 };
    if (state.night.night > hook.night && hook.i < this.chapter.nights.length) {
      hook.night = state.night.night;
      this.host.say(this.chapter.nights[hook.i++]);
    }
    beat('rate', this.rateOk, [], L(`Domínio: meta de produção atingida (${this.chapter.rate} de Sangue/min)!`, `Domain: production goal reached (${this.chapter.rate} Blood/min)!`));
    beat('boss', this.bossReady, [{ who: 'aureliano', text: L(`${this.chapter.boss.name} apareceu na trilha. Quando estiver pronto, abra o Domínio (coroa) e vamos atrás dele.`, `${this.chapter.boss.name} has shown up on the trail. When you're ready, open the Domain (crown) and we'll go after them.`) }]);
    beat('ready', this.ready, this.chapter.ready);
    // The next step of the chapter lives in the objective card (tap "Onde?" to open the Domain panel).
    const ch = this.chapter;
    const next = !this.rateOk ? { t: L(`Domínio: produzir ${ch.rate} de Sangue/min`, `Domain: produce ${ch.rate} Blood/min`), p: `${state.bloodRate}/${ch.rate}` }
      : !this.regentOk ? { t: L('Domínio: transformar um humano Raro em Regente', 'Domain: turn a Rare human into a Regent'), p: '' }
      : !this.clearOk ? (this.bossReady ? { t: L(`Domínio: derrotar ${ch.boss.name}`, `Domain: defeat ${ch.boss.name}`), p: '' } : { t: L('Domínio: vencer defesas sem perdas', 'Domain: win defenses without losses'), p: `${Math.min(c.cleanWins, CLEAN_WINS)}/${CLEAN_WINS}` })
      : { t: L(`Conquistar ${REGIONS[state.region].name} (coroa)`, `Conquer ${REGIONS[state.region].name} (crown)`), p: '' };
    this.hud.objective(next.t, next.p || undefined);
    this.payDomains(false);
  }

  private intro() {
    const c = state.conquest;
    if (c.introSeen || !state.tutorial.done) return;
    c.introSeen = true;
    c.hook = { night: state.night.night, i: 0 };
    this.hud.toast(this.chapter.title, 'good', 6000);
    this.host.say(this.chapter.intro);
  }

  // ---------- the Regent ----------
  canCrown(h: Human): { ok: boolean; why?: string } {
    if (this.regentOk) return { ok: false, why: L('Esta região já tem um Regente.', 'This region already has a Regent.') };
    if (h.name || h.contract || h.taken) return { ok: false, why: L('Este humano não pode ser transformado.', 'This human can\'t be transformed.') };
    if (QUALITY[h.traits.quality].rank < 2) return { ok: false, why: L('Só humanos Raros ou Excepcionais aguentam a transformação.', 'Only Rare or Exceptional humans survive the transformation.') };
    if (h.morale < 60) return { ok: false, why: L(`Precisa de moral 60 ou mais (agora ${Math.round(h.morale)}).`, `Needs morale 60 or more (now ${Math.round(h.morale)}).`) };
    const r = state.resources;
    if (r.prestige < REGENT_COST.prestige || r.blood < REGENT_COST.blood) return { ok: false, why: L(`Custa ${REGENT_COST.prestige} Prestígio e ${REGENT_COST.blood} Sangue.`, `Costs ${REGENT_COST.prestige} Prestige and ${REGENT_COST.blood} Blood.`) };
    return { ok: true };
  }

  crown(h: Human) {
    if (!this.canCrown(h).ok) return;
    const r = state.resources;
    r.prestige -= REGENT_COST.prestige;
    r.blood -= REGENT_COST.blood;
    const name = `${L('Regente', 'Regent')} ${h.traits.code}`;
    this.host.fx('fx_vampire_poof', h.sprite.x, h.sprite.y - 20, 1.6);
    this.host.fx('fx_sparkle', h.sprite.x, h.sprite.y - 50, 1.6);
    sfx.chime(); sfx.bell();
    this.humans.sell(h, this.regentSpot); // walks to the manor and leaves the herd for good
    state.conquest.regent = { name, look: h.look };
    bus.emit('REGENT_CROWNED', { name });
    this.scene.time.delayedCall(2000, () => this.placeRegent());
    this.host.say(this.chapter.regent);
  }

  // The Regent stands by the gate, pale and satisfied, with a name over their head.
  private placeRegent() {
    const rg = state.conquest.regent;
    if (!rg || this.regentSpr) return;
    const { x, y } = this.regentSpot;
    this.regentSpr = this.scene.add.sprite(x, y, 'vampire_buyer', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y).setTint(0xe8d8ff);
    this.regentLabel = this.scene.add.text(x, y - 70, rg.name, { fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold', color: '#f6d9a0', stroke: '#1a0508', strokeThickness: 5 })
      .setOrigin(0.5, 1).setScale(0.5).setDepth(2.2e6);
    this.scene.tweens.add({ targets: this.regentSpr, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- Domains: passive Legacy ----------
  private payDomains(onStart: boolean) {
    const n = domainCount();
    const now = Date.now();
    if (!meta.domainClock) { meta.domainClock = now; saveMeta(); return; }
    const h = Math.min(24, (now - meta.domainClock) / 3600000);
    const gain = n * DOMAIN_LEGACY_H * h;
    if (gain < 1) return;
    meta.legacy += Math.floor(gain);
    meta.domainClock = now - ((gain - Math.floor(gain)) / (n * DOMAIN_LEGACY_H)) * 3600000; // keep the fraction
    saveMeta();
    if (onStart) this.hud.toast(L(`Seus ${n} Domínio${n > 1 ? 's' : ''} renderam +${Math.floor(gain)} Legado de Sangue enquanto você esteve fora.`, `Your ${n} Domain${n > 1 ? 's' : ''} yielded +${Math.floor(gain)} Blood Legacy while you were away.`), 'good', 8000);
  }

  // ---------- the Domain panel (crown) ----------
  open() {
    const c = state.conquest, ch = this.chapter, r = state.resources;
    const pill = (ok: boolean, title: string, body: string, action = '') => `<div class="row" style="${ok ? 'border:1px solid #6fbf73' : ''}">` +
      `<div style="font-size:22px;width:28px;text-align:center">${ok ? '✅' : '⬜'}</div><div class="t"><b>${title}</b><br><small>${body}</small>${action}</div></div>`;
    const rate = Math.min(ch.rate, Math.round(c.bestRate));
    const meter = (v: number, max: number) => `<div class="meter"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div>`;
    const boss = this.bossReady ? `<button class="go" data-boss style="margin-top:6px">${L('Enfrentar', 'Face')} ${ch.boss.name} ▸</button>`
      : !c.alphaDown && c.bossNight === state.night.night ? `<div class="muted" style="margin-top:4px">${L('Tente de novo na próxima noite.', 'Try again next night.')}</div>` : '';
    const doms = Object.entries(meta.domains ?? {}).map(([id, d]) => `${REGIONS[id as keyof typeof REGIONS]?.name ?? id} (${d.regent})`).join(', ');
    const box = this.modal.show(`<h2>${L('Domínio', 'Domain')} · ${REGIONS[state.region].name}</h2><div class="sub">${ch.title}</div>
      ${pill(this.rateOk, L(`Produção: ${ch.rate} de Sangue por minuto`, `Production: ${ch.rate} Blood per minute`), L(`Melhor marca neste mandato: ${Math.round(c.bestRate)}/min (agora ${state.bloodRate}/min). Mais humanos saudáveis, Tanques de Coleta, pesquisas de Sangue.`, `Best this mandate: ${Math.round(c.bestRate)}/min (now ${state.bloodRate}/min). More healthy humans, Collection Tanks, Blood research.`), meter(rate, ch.rate))}
      ${pill(this.regentOk, c.regent ? `${L('Regente', 'Regent')}: ${c.regent.name}` : L('Um Regente vampiro', 'A vampire Regent'),
        c.regent ? L('Governa esta região em seu nome.', 'Rules this region in your name.') : L(`Toque num humano <b>Raro ou Excepcional</b> com moral 60+ e escolha "Transformar em Regente" (${REGENT_COST.prestige} Prestígio + ${REGENT_COST.blood} Sangue). Pares bons na Casa das Famílias geram raros.`, `Tap a <b>Rare or Exceptional</b> human with 60+ morale and choose "Turn into Regent" (${REGENT_COST.prestige} Prestige + ${REGENT_COST.blood} Blood). Good pairs in the Family House produce rare ones.`))}
      ${pill(this.clearOk, `${L('A matilha', 'The pack')}: ${ch.boss.name}`, c.alphaDown ? L('Derrotado. Nenhum ataque mais nesta região.', 'Defeated. No more attacks in this region.')
        : L(`Vença ${CLEAN_WINS} defesas sem perder ninguém (${Math.min(c.cleanWins, CLEAN_WINS)}/${CLEAN_WINS}); então o alfa aparece.`, `Win ${CLEAN_WINS} defenses without losing anyone (${Math.min(c.cleanWins, CLEAN_WINS)}/${CLEAN_WINS}); then the alpha shows up.`), (c.alphaDown ? '' : meter(Math.min(c.cleanWins, CLEAN_WINS), CLEAN_WINS)) + boss)}
      <button class="go" data-conquer${this.ready ? '' : ' disabled'}>${this.ready ? `${L('Conquistar', 'Conquer')} ${REGIONS[state.region].name} ▸` : L('Conquistar (cumpra os 3 pilares)', 'Conquer (complete the 3 pillars)')}</button>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${L(`Cada Domínio rende ${DOMAIN_LEGACY_H} Legado por hora, para sempre, e +5% de Sangue em todos os mandatos. Novas regiões abrem conforme você conquista.`, `Each Domain yields ${DOMAIN_LEGACY_H} Legacy per hour, forever, and +5% Blood in every mandate. New regions open as you conquer.`)}
      ${doms ? `<br>${L('Seus Domínios', 'Your Domains')}: ${doms}.` : ''}</p>
      <button class="go" data-abandon style="filter:brightness(.6);font-size:12px;min-height:34px">${L(`Encerrar este mandato sem conquistar (${Math.floor(r.prestige)} Prestígio vira Legado)`, `End this mandate without conquering (${Math.floor(r.prestige)} Prestige becomes Legacy)`)}</button>`);
    box.querySelector<HTMLButtonElement>('[data-boss]')?.addEventListener('click', () => { this.modal.close(); c.bossNight = state.night.night; this.host.bossFight(); });
    box.querySelector<HTMLButtonElement>('[data-conquer]')!.onclick = () => { if (this.ready) { this.modal.close(); this.host.conquer(); } };
    box.querySelector<HTMLButtonElement>('[data-abandon]')!.onclick = () => { if (confirm(L('Encerrar o mandato sem transformar a região em Domínio?', 'End the mandate without making the region a Domain?'))) { this.modal.close(); this.host.abandon(); } };
  }

  // Boss fight result (FarmScene runs the battle).
  bossResult(killed: boolean) {
    if (!killed) { this.hud.toast(L(`Aureliano: ${this.chapter.boss.name} escapou. Amanhã à noite tentamos de novo.`, `Aureliano: ${this.chapter.boss.name} got away. Tomorrow night we try again.`), 'bad', 7000); return; }
    state.conquest.alphaDown = true;
    state.world.raid = { night: state.night.night, kind: 'none', status: 'done', warnLeft: 0 };
    bus.emit('REGION_CLEARED', { region: state.region });
    invalidate();
    // The last chapter doesn't end with a kill: the Pack Mother stands up, and she is Aunt Leonor.
    if (this.chapter.boss.wolf === 'mother') this.host.finale();
    else this.host.say(this.chapter.cleared);
  }

  // Record the Domain (called right before the mandate summary).
  recordDomain() {
    meta.domains = { ...(meta.domains ?? {}), [state.region]: { regent: state.conquest.regent?.name ?? L('Regente', 'Regent'), at: Date.now() } };
    if (!meta.domainClock) meta.domainClock = Date.now();
    saveMeta();
  }
}

