// Werewolf raids on the farm side (GDD_ADENDO A6): schedule, warning chip, defend (battle scene) or auto-resolve.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state, NIGHT_MS } from '../core/state';
import { buildRaid, Raid } from '../data/battle';
import { fx, more } from '../core/bonus';
import { TUTORIAL } from '../data/tutorial';
import type { BattleResult } from '../scenes/BattleScene';
import type { Hud } from '../ui/Hud';
import type { Buildings } from './Buildings';
import type { Humans } from './Humans';

const WARN_MS = 45000;      // time to answer before the raid resolves itself
const RAID_AT = 0.4;        // fraction of the night when the howls start

export class Raids {
  private current?: Raid;
  private tutorialFought = false; // the tutorial raid happens once, not again while its closing lines play

  constructor(private humans: Humans, private buildings: Buildings, private hud: Hud,
    private startBattle: (raid: Raid, done: (r: BattleResult) => void) => void) {
    bus.on('NIGHT_STARTED', ({ night }) => this.plan(night));
    if (!state.world.raid) this.plan(state.night.night);
  }

  // Full moon every 4th night is a big raid; other nights have a chance of a small one (from night 2).
  private plan(night: number) {
    const kind = night % state.mods.bigEvery === 0 ? 'big' : night >= 2 && Math.random() < state.mods.raidChance ? 'small' : 'none';
    state.world.raid = { night, kind, status: 'waiting', warnLeft: WARN_MS };
  }

  update(dt: number) {
    const r = state.world.raid;
    if (!r) return;
    const tutorialRaid = !state.tutorial.done && TUTORIAL[state.tutorial.step]?.id === 't13_lobisomens';
    if (tutorialRaid && r.status !== 'warned' && !this.current && !this.tutorialFought) { r.kind = 'small'; r.status = 'waiting'; this.warn(true); return; }
    if (r.kind === 'none' || r.status === 'done') return;
    if (r.status === 'waiting' && state.night.elapsed >= NIGHT_MS * RAID_AT && !state.world.rebellion) this.warn(false);
    if (r.status === 'warned' && !tutorialRaid) {
      r.warnLeft -= dt;
      if (r.warnLeft <= 0) this.autoResolve();
    }
  }

  private warn(tutorial: boolean) {
    const r = state.world.raid!;
    r.status = 'warned';
    r.warnLeft = WARN_MS;
    this.current = buildRaid(state.night.night, r.kind === 'big', tutorial, Math.min(0.5, fx('raidSize')));
    this.hud.raidChip(r.kind === 'big' ? 'Lua cheia: ataque grande!' : 'Lobisomens na trilha!', () => this.defend());
    this.hud.toast(`Aureliano: ${r.kind === 'big' ? 'Lua cheia. Eles vêm em bando. Às raias!' : 'Uivos na trilha norte. Toque no alerta para defender.'}`, 'bad', 7000);
    bus.emit('RAID_WARNING', { big: r.kind === 'big' });
  }

  private defend() {
    const raid = this.current;
    if (!raid) return;
    this.hud.raidChip(null);
    this.startBattle(raid, res => this.apply(res));
  }

  private apply(res: BattleResult) {
    if (!state.tutorial.done) this.tutorialFought = true;
    const lost = this.humans.takeByRaid(res.grabbed);
    const r = state.world.raid!;
    r.status = 'done';
    this.current = undefined;
    if (res.won && !lost.length) {
      const gold = Math.round((60 + state.night.night * 25) * more('defense')), prestige = Math.round((5 + state.night.night) * more('defense'));
      state.resources.gold += gold;
      state.resources.prestige += prestige;
      this.hud.toast(`Aureliano: Eles recuaram. +${gold} Ouro · +${prestige} Prestígio pela defesa.`, 'good', 7000);
    } else if (lost.length) {
      this.hud.toast(`Os lobisomens levaram ${lost.join(', ')}.`, 'bad', 7000);
    }
    bus.emit('RAID_ENDED', { result: res.won ? 'won' : 'lost', losses: lost.length });
  }

  // Ignored the alarm: the watchtower, guards and research decide (GDD §12.2 — never wipes the farm).
  private autoResolve() {
    const raid = this.current!;
    const r = state.world.raid!;
    r.status = 'done';
    this.current = undefined;
    this.hud.raidChip(null);
    const threat = raid.spawns.reduce((a, s) => a + (s.wolf === 'alpha' ? 12 : s.wolf === 'brute' ? 4 : 1), 0);
    const defense = 3 + (this.buildings.level('watch') ? 4 : 0) + ['n1', 'n2', 'n4', 'n5', 'n6'].filter(id => (state.research.lv[id] ?? 0) > 0).length * 2;
    const losses = fx('vigil') ? 0 : Phaser.Math.Clamp(Math.round((threat - defense) / 4), 0, 3);
    const lost = this.humans.takeByRaid(losses);
    const blood = Math.round(state.resources.blood * 0.15);
    state.resources.blood -= blood;
    this.hud.toast(lost.length ? `Ninguém defendeu a cerca. Levaram ${lost.join(', ')} e ${blood} de Sangue.`
      : `A torre e os ghouls seguraram o ataque sozinhos. Perdemos ${blood} de Sangue na bagunça.`, lost.length ? 'bad' : '', 8000);
    bus.emit('RAID_ENDED', { result: 'auto', losses: lost.length });
  }
}
