// Tutorial runner (GDD §8–9): a quest chain driven by semantic events. It never blocks input or pauses the game.
import { bus, GameEvents } from './events';
import { state } from './state';
import { TUTORIAL, Line, Step } from '../data/tutorial';

export interface TutorialUI {
  say(lines: Line[], onDone: () => void): void;
  objective(text: string | null, progress?: string): void;
  hint(level: 1 | 2 | 3, step: Step): void;   // 12 s: a line · 25 s: highlight · 45 s: arrow (GDD §9.1)
  clearHint(): void;
  toast(msg: string): void;
}

const HINT_AT = [12000, 25000, 45000];

export class Tutorial {
  private waiting = false;
  private idle = 0;
  private hintLevel = 0;
  private recheck = 0;

  constructor(private ui: TutorialUI) {
    const events = new Set(TUTORIAL.flatMap(s => s.objective?.events ?? []));
    for (const e of events) bus.on(e, (p: GameEvents[typeof e]) => this.onEvent(e, p));
  }

  start() {
    if (!state.tutorial.done) this.run(state.tutorial.step, true);
  }

  skip() {
    state.tutorial.done = true;
    this.waiting = false;
    this.ui.clearHint();
    this.ui.objective(null);
  }

  // "Onde?" button: jump straight to the strongest hint for the current objective.
  where() {
    if (!this.waiting) return;
    this.hintLevel = 3;
    this.ui.hint(3, TUTORIAL[state.tutorial.step]);
  }

  update(dt: number) {
    if (!this.waiting) return;
    this.idle += dt;
    const step = TUTORIAL[state.tutorial.step];
    // Done some other way (built earlier, older save, event missed): don't leave the player stuck.
    this.recheck -= dt;
    if (this.recheck <= 0) { this.recheck = 1000; if (step.satisfied?.()) { this.complete(step); return; } }
    while (this.hintLevel < 3 && this.idle >= HINT_AT[this.hintLevel]) {
      this.hintLevel++;
      this.ui.hint(this.hintLevel as 1 | 2 | 3, step);
    }
  }

  private run(i: number, resuming = false) {
    const step = TUTORIAL[i];
    if (!step) { this.finish(); return; }
    state.tutorial.step = i;
    if (!resuming) state.tutorial.count = 0;
    this.ui.say(step.lines, () => (step.objective ? this.activate(step) : this.run(i + 1)));
  }

  private activate(step: Step) {
    this.waiting = true;
    this.idle = 0;
    this.hintLevel = 0;
    if (step.satisfied?.()) { this.complete(step); return; }
    this.showObjective(step);
  }

  private showObjective(step: Step) {
    const n = step.objective!.count ?? 1;
    this.ui.objective(step.objective!.text, n > 1 ? `${state.tutorial.count}/${n}` : undefined);
  }

  private onEvent(type: keyof GameEvents, payload: unknown) {
    if (!this.waiting || state.tutorial.done) return;
    const step = TUTORIAL[state.tutorial.step];
    const o = step.objective!;
    if (!o.events.includes(type) || (o.match && !o.match(payload))) return;
    state.tutorial.count++;
    this.idle = 0;
    if (this.hintLevel > 0) { this.hintLevel = 0; this.ui.clearHint(); }
    if (state.tutorial.count < (o.count ?? 1)) { this.showObjective(step); return; }
    this.complete(step);
  }

  private complete(step: Step) {
    this.waiting = false;
    this.ui.clearHint();
    this.ui.objective(null);
    const r = step.reward;
    if (r) for (const k of Object.keys(r) as (keyof typeof r)[]) state.resources[k] += r[k]!;
    const names = { gold: 'Ouro', blood: 'Sangue', food: 'Comida', prestige: 'Prestígio' } as const;
    const gains = r ? Object.entries(r).map(([k, v]) => `+${v} ${names[k as keyof typeof names]}`).join(' · ') : '';
    this.ui.toast(`Missão concluída: ${step.objective!.text}${gains ? ` · ${gains}` : ''}`);
    const next = () => this.run(state.tutorial.step + 1);
    if (step.done?.length) this.ui.say(step.done, next); else next();
  }

  private finish() {
    state.tutorial.done = true;
    this.ui.objective(null);
    this.ui.toast('Tutorial concluído. A fazenda é sua — e as dívidas também.');
  }
}
