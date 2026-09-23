// Dialogue (GDD §8.1): short lines, portrait first, tap anywhere on the box to continue. The game keeps running.
// "Pular" skips only this conversation (straight to the objective); skipping the whole tutorial lives in the ☰ menu.
import { Line, SPEAKERS } from '../data/tutorial';

import { voice, sfx } from '../core/sfx';

const CSS = `
.dlg{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:8;
  width:min(540px,calc(100vw - 20px));box-sizing:border-box;display:none;padding:12px 14px 10px 108px;min-height:96px;
  background:linear-gradient(180deg,#1a0f16f7,#0d0a12f7);border:1px solid #8a2a36;border-radius:12px;box-shadow:0 8px 24px #000e;
  color:#f3e2c8;font:15px Georgia,serif;cursor:pointer}
.dlg.on{display:block;animation:dlgin .22s ease-out}
@keyframes dlgin{from{opacity:0;transform:translate(-50%,14px)}}
.dlg .pic{position:absolute;left:10px;bottom:10px;width:88px;height:104px;border-radius:10px 10px 8px 8px;border:2px solid #a07818;
  background:#1a1016 center/cover no-repeat;box-shadow:0 4px 10px #000c}
.dlg .who{display:inline-block;font-weight:700;color:#1a0a0e;background:#e0a060;border-radius:5px;padding:1px 8px;font-size:12px;margin-bottom:5px}
.dlg .txt{line-height:1.42;min-height:2.8em}
.dlg .foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:12px;color:#9a8a80}
.dlg .dots{display:flex;gap:4px}.dlg .dots i{width:6px;height:6px;border-radius:50%;background:#4a2a30}.dlg .dots i.on{background:#e0a060}
.dlg .skip{background:none;border:1px solid #4a2a30;color:#c9a98a;border-radius:6px;font:12px Georgia,serif;padding:6px 10px;cursor:pointer}
body.dlg-open .bpanel{bottom:calc(150px + env(safe-area-inset-bottom,0px));max-height:calc(100vh - 290px)}
@media (orientation:landscape) and (max-height:520px){
  .dlg{left:max(10px,env(safe-area-inset-left,0px));transform:none;width:min(460px,50vw);min-height:74px;padding:8px 10px 6px 84px;font-size:13px}
  .dlg.on{animation:none}.dlg .pic{width:66px;height:78px;left:8px;bottom:8px}.dlg .txt{min-height:2.4em}
  /* dialogue sits bottom-left, panels on the right: no need to push panels up */
  body.dlg-open .bpanel{bottom:calc(8px + env(safe-area-inset-bottom,0px));max-height:calc(100vh - 70px)}
}
@media (max-width:520px){.dlg{font-size:14px;padding-left:92px}.dlg .pic{width:74px;height:90px}}
`;

export class Dialogue {
  private el: HTMLDivElement;
  private typing?: ReturnType<typeof setInterval>;
  private full = '';
  private lines: Line[] = [];
  private i = 0;
  private onDone?: () => void;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'dlg';
    this.el.innerHTML = '<div class="pic"></div><div class="who"></div><div class="txt"></div>' +
      '<div class="foot"><div class="dots"></div><span>toque ▸</span><button class="skip">Pular ▸▸</button></div>';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', e => {
      if ((e.target as HTMLElement).classList.contains('skip')) { this.i = this.lines.length; }
      else if (this.typing) { this.finishTyping(); return; } // first tap completes the line
      this.advance();
    });
  }

  get open() { return this.el.classList.contains('on'); }

  say(lines: Line[], onDone: () => void) {
    this.lines = lines;
    this.i = 0;
    this.onDone = onDone;
    this.render();
  }

  private advance() {
    sfx.click();
    this.i++;
    this.render();
  }

  private render() {
    const line = this.lines[this.i];
    if (!line) {
      this.finishTyping();
      this.el.classList.remove('on');
      document.body.classList.remove('dlg-open');
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
      return;
    }
    (this.el.querySelector('.pic') as HTMLElement).style.backgroundImage = `url(assets/portrait_${line.who}.webp)`;
    this.el.querySelector('.who')!.textContent = SPEAKERS[line.who];
    this.type(line.text, line.who);
    this.el.querySelector('.dots')!.innerHTML = this.lines.map((_, k) => `<i class="${k <= this.i ? 'on' : ''}"></i>`).join('');
    this.el.classList.add('on');
    document.body.classList.add('dlg-open'); // panels move up so both stay usable
  }

  // Typewriter with a wordless voice every few letters (each character has their own timbre).
  private type(text: string, who: string) {
    this.finishTyping();
    this.full = text;
    const el = this.el.querySelector('.txt')!;
    let n = 0;
    el.textContent = '';
    this.typing = setInterval(() => {
      n += 2;
      el.textContent = text.slice(0, n);
      if (n % 6 === 0 && text[n - 1] !== ' ') voice(who, 60);
      if (n >= text.length) this.finishTyping();
    }, 28);
  }

  private finishTyping() {
    if (!this.typing) return;
    clearInterval(this.typing);
    this.typing = undefined;
    this.el.querySelector('.txt')!.textContent = this.full;
  }
}
