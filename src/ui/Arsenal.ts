// Aureliano's Arsenal: battle stars become hunt marks, spent on permanent unit levels (+15% each).
import { meta, saveMeta } from '../core/meta';
import { sfx } from '../core/sfx';
import { UNITS, UnitId, UNIT_MAX_LV, unitLvCost } from '../data/battle';
import { has } from '../data/research';
import type { Modal } from './Modal';

export function openArsenal(modal: Modal) {
  const m = meta.marks ?? 0;
  const row = (id: UnitId) => {
    const u = UNITS[id], l = meta.unitLv?.[id] ?? 0, c = unitLvCost(l), locked = !!u.research && !has(u.research);
    return `<div class="row"><div class="t"><b>${u.name}</b> <small>nível ${l}/${UNIT_MAX_LV}${locked ? ' · ainda não liberado na árvore' : ''}</small><br>` +
      `<small>${u.desc} Agora: +${l * 15}% de força.</small></div>` +
      `<button data-u="${id}"${l >= UNIT_MAX_LV || m < c ? ' disabled' : ''}>${l >= UNIT_MAX_LV ? 'Máximo' : `${c} ★`}</button></div>`;
  };
  const box = modal.show(`<h2>Arsenal de Aureliano</h2><div class="sub">${m} marcas de caça ★ · ganhe até 3 por defesa (3 = ninguém levado) · permanentes</div>
    ${(Object.keys(UNITS) as UnitId[]).map(row).join('')}
    <p class="muted" style="font-size:12px;margin:8px 0 0">Recorde na Lua de Sangue: ${meta.bestWave ?? 0} ondas.</p>`);
  box.querySelectorAll<HTMLButtonElement>('[data-u]').forEach(b => b.onclick = () => {
    const id = b.dataset.u as UnitId, l = meta.unitLv?.[id] ?? 0, c = unitLvCost(l);
    if ((meta.marks ?? 0) < c || l >= UNIT_MAX_LV) return;
    meta.marks -= c;
    meta.unitLv = { ...meta.unitLv, [id]: l + 1 };
    saveMeta();
    sfx.build();
    openArsenal(modal);
  });
}
