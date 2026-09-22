// Contextual card for a plot/building (bottom of the screen, thumb-friendly). Art skin arrives with the HUD kit.
const CSS = `
.bpanel{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-height:62vh;overflow:auto;box-sizing:border-box;transform:translateX(-50%);z-index:7;width:min(360px,calc(100vw - 32px));
  background:#140a10f2;border:1px solid #6b1d2a;border-radius:8px;box-shadow:0 6px 18px #000c;color:#f3e2c8;
  font:14px Georgia,serif;padding:14px 16px 16px;display:none}
.bpanel.on{display:block;animation:bpin .18s ease-out}
@keyframes bpin{from{opacity:0;transform:translate(-50%,8px)}}
.bpanel h3{margin:0;font-size:18px;color:#f6d9a0}
.bpanel .sub{color:#c9a98a;font-size:12px;margin:2px 0 8px}
.bpanel .desc{margin:0 0 8px;line-height:1.35}
.bpanel ul{margin:0 0 12px;padding-left:18px;color:#e6cfa8;font-size:13px}
.bpanel .x{position:absolute;top:8px;right:10px;background:none;border:0;color:#c9a98a;font-size:20px;cursor:pointer;padding:4px 8px}
.bpanel .go{width:100%;min-height:44px;padding:10px;border-radius:6px;border:1px solid #2a0a10;background:#8a1424;color:#fff3e0;font:600 15px Georgia,serif;cursor:pointer}
.bpanel .ch{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.bpanel .ch button{flex:1 1 90px;min-height:40px;padding:8px 4px;border-radius:6px;border:1px solid #5a1a24;background:#241218;color:#f3e2c8;font:13px Georgia,serif;cursor:pointer}
.bpanel .ch button.on{background:#5a1a24;border-color:#e8b54a}
.bpanel .go:disabled{background:#3a2a2e;color:#9a8a80;cursor:not-allowed}
`;

export interface PanelInfo {
  title: string;
  subtitle: string;
  desc: string;
  stats: string[];
  action?: { label: string; disabled?: boolean; onClick?: () => void };
  choices?: { label: string; active: boolean; onClick: () => void }[];
}

export class BuildPanel {
  private el: HTMLDivElement;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'bpanel';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  }

  open(info: PanelInfo) {
    const esc = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    this.el.innerHTML = `<button class="x" aria-label="Fechar">×</button><h3>${esc(info.title)}</h3><div class="sub">${esc(info.subtitle)}</div>` +
      `<p class="desc">${esc(info.desc)}</p>` + (info.stats.length ? `<ul>${info.stats.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '') +
      (info.choices ? `<div class="ch">${info.choices.map((c, i) => `<button data-i="${i}" class="${c.active ? 'on' : ''}">${esc(c.label)}</button>`).join('')}</div>` : '') +
      (info.action ? `<button class="go"${info.action.disabled ? ' disabled' : ''}>${esc(info.action.label)}</button>` : '');
    this.el.querySelector<HTMLButtonElement>('.x')!.onclick = () => this.close();
    const go = this.el.querySelector<HTMLButtonElement>('.go');
    if (go && info.action?.onClick) go.onclick = info.action.onClick;
    this.el.querySelectorAll<HTMLButtonElement>('.ch button').forEach(b => { b.onclick = () => info.choices![Number(b.dataset.i)].onClick(); });
    this.el.classList.add('on');
  }

  close() { this.el.classList.remove('on'); }
}
