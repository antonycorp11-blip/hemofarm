// Art skin for the HTML UI (asset block 16): 9-slice frames via CSS border-image.
// Slice values are in source pixels of the processed frames (240px wide); the second number is the on-screen border.
const A = (n: string) => `url(assets/${n}.webp)`;

const CSS = `
.hud .bar,.hmenu .box,.bpanel{border:10px solid transparent;border-image:${A('frame_panel')} 22 fill / 10px stretch;background:none}
.hud .tithe,.toast,.bpanel .ch button{border:8px solid transparent;border-image:${A('frame_tooltip')} 18 fill / 8px stretch;background:none}
.hud .tithe .fill{inset:2px auto 2px 2px;border-radius:3px}
.hud .tithe.behind{border-image-source:${A('frame_tooltip')};filter:drop-shadow(0 0 4px #d8122a)}
.toast.good{filter:drop-shadow(0 0 4px #a07818)}.toast.bad{filter:drop-shadow(0 0 4px #d8122a)}
.quest{border:12px solid transparent;border-image:${A('frame_card')} 34 fill / 12px stretch;background:none;color:#3a1a10;
  padding:2px 4px 2px 6px}
.quest .qp{color:#8a1424}
.quest button,.hmenu button,.bpanel .go{border:6px solid transparent;border-image:${A('button_normal')} 18 fill / 6px stretch;
  background:none;color:#fff3e0;text-shadow:0 1px 2px #000}
.quest button:active,.hmenu button:active,.bpanel .go:active{border-image-source:${A('button_pressed')}}
.hmenu button.danger{color:#ffd0d4}
.bpanel .go:disabled{filter:grayscale(1) brightness(.7)}
.bpanel .ch button.on{filter:drop-shadow(0 0 4px #e8b54a);color:#f6d9a0}
.dlg{border:12px solid transparent;border-image:${A('frame_dialog')} 22 fill / 12px stretch;background:none}
.dlg .pic{border:0;box-shadow:0 4px 10px #000c}
.dlg .pic::after{content:'';position:absolute;inset:-6px;border:10px solid transparent;border-image:${A('frame_portrait')} 26 / 10px stretch}
@media (hover:hover) and (pointer:fine){html,body,canvas{cursor:url(assets/cursor_arrow.png) 2 2,auto}}
`;

export function applySkin() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}
