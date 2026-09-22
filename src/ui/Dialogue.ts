// Dialogue box (GDD §8.1): short lines, portrait first, one tap to continue. The game keeps running underneath.
import { Line, SPEAKERS } from '../data/tutorial';

const CSS = `
.dlg{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:8;
  width:min(520px,calc(100vw - 32px));box-sizing:border-box;display:none;gap:12px;align-items:flex-start;padding:12px 14px;
  background:#0d0a14f5;border:1px solid #6b1d2a;border-radius:8px;box-shadow:0 6px 20px #000d;color:#f3e2c8;font:15px Georgia,serif;cursor:pointer}
.dlg.on{display:flex;animation:dlgin .2s ease-out}
@keyframes dlgin{from{opacity:0;transform:translate(-50%,10px)}}
.dlg img{width:72px;height:72px;border-radius:6px;border:1px solid #6b1d2a;flex:none;background:#1a1016}
.dlg .body{flex:1;min-width:0}
.dlg .who{font-weight:700;color:#e0a060;font-size:13px;margin-bottom:3px}
.dlg .txt{line-height:1.4}
.dlg .foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12px;color:#9a8a80}
.dlg .skip{background:none;border:0;color:#9a8a80;text-decoration:underline;font:inherit;cursor:pointer;padding:6px 0}
@media (max-width:600px){.dlg{font-size:14px;padding:10px}.dlg img{width:56px;height:56px}}
`;

export class Dialogue {
  private el: HTMLDivElement;
  private queue: Line[] = [];
  private onDone?: () => void;

  constructor(onSkip: () => void) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'dlg';
    this.el.innerHTML = '<img alt=""><div class="body"><div class="who"></div><div class="txt"></div>' +
      '<div class="foot"><button class="skip">Pular tutorial</button><span>toque para continuar ▸</span></div></div>';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', e => {
      if ((e.target as HTMLElement).classList.contains('skip')) {
        if (confirm('Pular o tutorial?')) { this.queue = []; this.onDone = undefined; this.el.classList.remove('on'); onSkip(); }
        return;
      }
      this.advance();
    });
  }

  say(lines: Line[], onDone: () => void) {
    this.queue = [...lines];
    this.onDone = onDone;
    this.advance();
  }

  private advance() {
    const line = this.queue.shift();
    if (!line) {
      this.el.classList.remove('on');
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
      return;
    }
    this.el.querySelector('img')!.src = `assets/portrait_${line.who}.webp`;
    this.el.querySelector('.who')!.textContent = SPEAKERS[line.who];
    this.el.querySelector('.txt')!.textContent = line.text;
    this.el.classList.add('on');
  }
}
