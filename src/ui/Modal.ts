// Full-screen overlay card, skinned like the mandate screens. Used by the tree, relics, album, orders, arsenal and reports.
const CSS = `
.mdl{position:fixed;inset:0;z-index:35;display:none;align-items:center;justify-content:center;background:#050308dd;color:#f3e2c8;font:14px Georgia,serif}
.mdl.on{display:flex}
.mdl .box{position:relative;width:min(560px,calc(100vw - 20px));max-height:calc(100dvh - 20px);overflow:auto;box-sizing:border-box;padding:14px 16px;
  border:12px solid transparent;border-image:url(assets/frame_panel.webp) 22 fill / 12px stretch}
.mdl .box.wide{width:min(900px,calc(100vw - 20px))}
.mdl h2{margin:0 0 2px;color:#f6d9a0;font-size:20px;text-align:center}.mdl .sub{text-align:center;color:#c9a98a;margin-bottom:10px;font-size:13px}
.mdl .x{position:absolute;top:4px;right:6px;background:none;border:0;color:#c9a98a;font-size:24px;cursor:pointer;padding:4px 10px;z-index:2}
.mdl button.go{width:100%;min-height:42px;margin-top:8px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;
  background:none;color:#fff;font:700 14px Georgia,serif;cursor:pointer}.mdl button.go:disabled{filter:grayscale(1) brightness(.6);cursor:default}
.mdl .row{display:flex;gap:8px;align-items:center;padding:8px;margin:6px 0;background:#1a0f14;border-radius:8px}.mdl .row .t{flex:1}
.mdl .row b{color:#f6d9a0}.mdl .muted,.mdl small{color:#9a8a80}
.mdl .row button{flex:none;min-width:84px;min-height:36px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;
  background:none;color:#fff;font:600 12px Georgia,serif;cursor:pointer}.mdl .row button:disabled{filter:grayscale(1) brightness(.6)}
.mdl .meter{height:8px;background:#2a1016;border-radius:4px;overflow:hidden;margin-top:4px}.mdl .meter i{display:block;height:100%;background:linear-gradient(90deg,#8a1424,#e8b54a)}
.mdl .cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mdl .pick{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:12px 8px;background:#1a0f14;border:1px solid #4a1620;border-radius:10px;
  color:#f3e2c8;font:inherit;cursor:pointer}.mdl .pick:hover{border-color:#e8b54a}.mdl .pick img{height:44px}.mdl .pick b{color:#f6d9a0}
.mdl .chest{display:block;margin:8px auto;font-size:64px;background:none;border:0;cursor:pointer;animation:chest 0.9s ease-in-out infinite alternate}
@keyframes chest{to{transform:scale(1.08) rotate(-3deg);filter:drop-shadow(0 0 12px #e8b54a)}}
.mdl .gains{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:8px 0}.mdl .gains span{display:flex;align-items:center;gap:4px;padding:4px 10px;background:#241218;border-radius:14px}
.mdl .gains img{height:18px}
@media (max-width:520px){.mdl .cards3{grid-template-columns:1fr}}
@media (orientation:landscape) and (max-height:520px){.mdl .box{padding:8px 12px}.mdl h2{font-size:17px}.mdl .pick{padding:8px 6px}.mdl .pick img{height:32px}}
`;

export class Modal {
  private el: HTMLDivElement;
  private onClose?: () => void;

  constructor() {
    if (!document.getElementById('mdl-css')) {
      const style = document.createElement('style');
      style.id = 'mdl-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'mdl';
    this.el.onclick = e => { if (e.target === this.el && this.closable) this.close(); };
    document.body.appendChild(this.el);
  }

  private closable = true;

  get open() { return this.el.classList.contains('on'); }

  show(html: string, opts: { wide?: boolean; closable?: boolean; onClose?: () => void } = {}) {
    this.closable = opts.closable ?? true;
    this.el.innerHTML = `<div class="box${opts.wide ? ' wide' : ''}">${this.closable ? '<button class="x" aria-label="Fechar">×</button>' : ''}${html}</div>`;
    this.el.querySelector<HTMLButtonElement>('.x')?.addEventListener('click', () => this.close());
    this.onClose = opts.onClose;
    this.el.classList.add('on');
    return this.el.querySelector<HTMLElement>('.box')!;
  }

  close() {
    this.el.classList.remove('on');
    const cb = this.onClose;
    this.onClose = undefined;
    cb?.();
  }
}

export const icon = (name: string, h = 18) => `<img src="assets/${name}.webp" alt="" style="height:${h}px;vertical-align:middle">`;
