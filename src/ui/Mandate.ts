// End of mandate (GDD_ADENDO A5): summary → Vampire House upgrades → regional map → new mandate.
// Full-screen HTML overlay, skinned with the UI kit.
import { state, resetSave } from '../core/state';
import { meta, saveMeta, UPGRADES, lv, legacyFor } from '../core/meta';
import { REGIONS, RegionId } from '../data/regions';
import { CHAPTERS } from '../data/story';

const CSS = `
.mand{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:#050308ee;color:#f3e2c8;font:14px Georgia,serif}
.mand .box{width:min(520px,calc(100vw - 20px));max-height:calc(100vh - 30px);overflow:auto;box-sizing:border-box;padding:16px;
  border:12px solid transparent;border-image:url(assets/frame_panel.webp) 22 fill / 12px stretch}
.mand h2{margin:0 0 4px;color:#f6d9a0;font-size:22px;text-align:center}.mand .sub{text-align:center;color:#c9a98a;margin-bottom:10px}
.mand .stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.mand .stats div{padding:6px 8px;background:#1a0f14;border-radius:6px}
.mand .legacy{text-align:center;font-size:20px;color:#ff6a78;margin:10px 0}
.mand button.go{width:100%;min-height:44px;margin-top:8px;border:6px solid transparent;border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;
  background:none;color:#fff;font:700 15px Georgia,serif;cursor:pointer}.mand button.go:disabled{filter:grayscale(1) brightness(.6)}
.mand button.ghost{width:100%;min-height:40px;margin-top:6px;background:none;border:1px solid #4a2a30;border-radius:6px;color:#c9a98a;font:inherit;cursor:pointer}
.mand .up{display:flex;gap:8px;align-items:center;padding:8px;margin:6px 0;background:#1a0f14;border-radius:8px}.mand .up .t{flex:1}
.mand .up b{color:#f6d9a0}.mand .up small{color:#9a8a80}.mand .up button{flex:none;min-width:88px;min-height:38px;border:6px solid transparent;
  border-image:url(assets/button_normal.webp) 18 fill / 6px stretch;background:none;color:#fff;font:600 12px Georgia,serif}
.mand .up button:disabled{filter:grayscale(1) brightness(.6)}
.mand .map{position:relative;width:100%;aspect-ratio:3/2;background:url(assets/regional_map.jpg) center/cover;border-radius:8px;margin-top:6px}
.mand .pin{position:absolute;transform:translate(-50%,-100%);width:44px;height:44px;background:center/contain no-repeat;border:0;cursor:pointer;padding:0}
.mand .pin.sel{filter:drop-shadow(0 0 8px #e8b54a)}.mand .pin span{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;
  font-size:10px;background:#000b;padding:1px 4px;border-radius:4px;color:#f3e2c8}
.mand .reg{margin-top:8px;padding:8px;background:#1a0f14;border-radius:8px;min-height:52px}
`;

const domains = () => Object.keys(meta.domains ?? {}).length;
const allDone = () => domains() >= Object.keys(REGIONS).length;

export class Mandate {
  private el: HTMLDivElement;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'mand';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  private show(html: string) {
    this.el.innerHTML = `<div class="box">${html}</div>`;
    this.el.style.display = 'flex';
    return this.el;
  }

  close() { this.el.style.display = 'none'; }

  // ---------- 1. summary ----------
  end(ascended: boolean, population: number, onCancel?: () => void, title?: string, extra = 0) {
    const gain = legacyFor(ascended) + extra;
    const n = state.night.night, r = state.resources;
    const root = this.show(`<h2>${title ?? (ascended ? 'Ascensão da Casa' : 'Propriedade confiscada')}</h2>
      <div class="sub">${ascended ? 'Vesper: A casa superior está impressionada. Isso quase nunca acontece.' : 'Vesper: Três noites sem Sangria. A propriedade volta para mim. Você, por enquanto, não.'}</div>
      <div class="stats"><div>Noites: <b>${n}</b></div><div>Prestígio: <b>${Math.floor(r.prestige)}</b></div>
      <div>Humanos: <b>${population}</b></div><div>Contratos: <b>${state.contracts.done.length}</b></div></div>
      <div class="legacy">+${gain} Legado de Sangue</div>
      <button class="go" data-a="next">Continuar para a Casa Vampírica</button>
      ${onCancel ? '<button class="ghost" data-a="cancel">Ainda não — continuar este mandato</button>' : ''}`);
    root.querySelector<HTMLButtonElement>('[data-a="next"]')!.onclick = () => {
      meta.legacy += gain;
      meta.mandates += 1;
      meta.bestNight = Math.max(meta.bestNight, n);
      saveMeta();
      // The run is over the moment its Legacy is paid: drop the save so it can't be claimed twice.
      (window as unknown as { __hemoResetting?: boolean }).__hemoResetting = true;
      resetSave();
      this.shop();
    };
    root.querySelector<HTMLButtonElement>('[data-a="cancel"]')?.addEventListener('click', () => { this.close(); onCancel!(); });
  }

  // ---------- 2. permanent upgrades ----------
  shop() {
    const row = (u: typeof UPGRADES[number]) => {
      const l = lv(u.id), max = l >= u.max, cost = u.cost(l);
      return `<div class="up"><div class="t"><b>${u.name}</b> <small>${l}/${u.max}</small><br><small>${u.desc}</small></div>
        <button data-u="${u.id}"${max || meta.legacy < cost ? ' disabled' : ''}>${max ? 'Máximo' : `${cost} Legado`}</button></div>`;
    };
    const root = this.show(`<h2>Casa Vampírica</h2><div class="sub">Melhorias permanentes para todos os próximos mandatos</div>
      <div class="legacy">${meta.legacy} Legado de Sangue</div>${UPGRADES.map(row).join('')}
      <button class="go" data-a="map">Escolher a próxima região</button>`);
    root.querySelectorAll<HTMLButtonElement>('[data-u]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.id === b.dataset.u)!;
      const cost = u.cost(lv(u.id));
      if (meta.legacy < cost || lv(u.id) >= u.max) return;
      meta.legacy -= cost;
      meta.levels[u.id] = lv(u.id) + 1;
      saveMeta();
      this.shop();
    });
    root.querySelector<HTMLButtonElement>('[data-a="map"]')!.onclick = () => this.map(true);
  }

  // ---------- 3. regional map ----------
  map(starting: boolean, selected: RegionId = meta.nextRegion) {
    const pins = (Object.keys(REGIONS) as RegionId[]).map(id => {
      const g = REGIONS[id], dom = meta.domains?.[id], open = domains() >= g.unlock && (!dom || allDone());
      const current = !starting && id === state.region;
      return `<button class="pin${id === selected ? ' sel' : ''}" data-r="${id}" style="left:${g.x}%;top:${g.y}%;background-image:url(assets/${open ? 'pin_farm' : 'pin_locked'}.webp)">` +
        `<span>${current ? '★ ' : ''}${dom ? '👑 ' : ''}${g.name}</span></button>`;
    }).join('');
    const g = REGIONS[selected], dom = meta.domains?.[selected], open = domains() >= g.unlock && (!dom || allDone());
    const root = this.show(`<h2>Mapa Regional</h2><div class="sub">${starting ? 'Onde será o próximo mandato?' : `Mandato atual: ${REGIONS[state.region].name}`}</div>
      <div class="map">${pins}</div>
      <div class="reg"><b>${g.name}</b> · ${g.tag}<br><small>${g.desc}</small><br><small style="color:#c9a98a">${CHAPTERS[selected].title} · meta ${CHAPTERS[selected].rate} de Sangue/min</small>${dom ? `<br><small style="color:#e8b54a">👑 Domínio da Casa · ${dom.regent}${allDone() ? ' · pode ser jogado de novo' : ''}</small>` : ''}${!dom && domains() < g.unlock ? `<br><small style="color:#ff9aa4">Abre com ${g.unlock} Domínio${g.unlock === 1 ? '' : 's'} conquistado${g.unlock === 1 ? '' : 's'} (você tem ${domains()}).</small>` : ''}</div>
      ${starting ? `<button class="go" data-a="start"${open ? '' : ' disabled'}>Iniciar novo mandato em ${g.name}</button>` : '<button class="ghost" data-a="close">Fechar</button>'}`);
    root.querySelectorAll<HTMLButtonElement>('[data-r]').forEach(b => b.onclick = () => this.map(starting, b.dataset.r as RegionId));
    root.querySelector<HTMLButtonElement>('[data-a="close"]')?.addEventListener('click', () => this.close());
    root.querySelector<HTMLButtonElement>('[data-a="start"]')?.addEventListener('click', () => {
      meta.nextRegion = selected;
      saveMeta();
      (window as unknown as { __hemoResetting?: boolean }).__hemoResetting = true;
      resetSave();
      location.reload();
    });
  }
}
