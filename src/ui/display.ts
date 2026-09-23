// PC display helpers: interface scale for big screens and fullscreen.
// The HTML UI was sized for phones in landscape; on a 1080p+ monitor it gets small, so the whole overlay is zoomed.
// Auto = 1 on touch devices, otherwise grows with the window (1366×768 → 100%, 1920×1080 → ~140%).
export const isDesktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

const UI = ['.hud', '.quest', '.toasts', '.evt', '.dlg', '.bpanel', '.mdl .box', '.hmenu .box',
  '.bt .bottom', '.bt .spells', '.bt .horde', '.bt .go-now', '.bt .prev', '.bt .btoast', '.bt .res .box']; // the battle measures these to fit the field
let choice = 0;

function autoScale() {
  if (!isDesktop()) return 1;
  const s = Math.min(window.innerWidth / 1366, window.innerHeight / 768);
  return Math.round(Math.max(1, Math.min(1.75, s)) * 20) / 20;
}

export function applyUiScale(v: number) {
  choice = v;
  const s = v || autoScale();
  let style = document.getElementById('ui-scale') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'ui-scale';
    document.head.appendChild(style);
    window.addEventListener('resize', () => { if (!choice) applyUiScale(0); });
  }
  // `zoom` also scales `top`, so elements placed under the HUD divide the measured offset back.
  style.textContent = s === 1 ? '' : `:root{--ui:${s}}${UI.join(',')}{zoom:${s}}
    .quest,.evt{top:calc(var(--hud-bottom,90px) / ${s})}.evt.raid{top:calc(var(--hud-bottom,90px) / ${s} + 52px)}
    .mdl .box{max-height:calc((100dvh - 20px) / ${s})}.hmenu .box{max-height:calc((100dvh - 110px) / ${s})}
    .bpanel{max-height:calc(62vh / ${s})}body.dlg-open .bpanel{max-height:calc((100vh - 290px) / ${s})}
    .mdl .box{width:min(560px,calc((100vw - 20px) / ${s}))}.mdl .box.wide{width:min(900px,calc((100vw - 20px) / ${s}))}`;
}

export function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => { /* blocked by the browser or the portal frame */ });
}
