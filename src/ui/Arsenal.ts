// Aureliano's Arsenal: battle stars become hunt marks, spent on permanent unit levels (+15% each).
import { meta, saveMeta } from '../core/meta';
import { sfx } from '../core/sfx';
import { UNITS, UnitId, UNIT_MAX_LV, unitLvCost } from '../data/battle';
import { has } from '../data/research';
import type { Modal } from './Modal';
import { L } from '../core/i18n';

export function openArsenal(modal: Modal) {
  const m = meta.marks ?? 0;
  const row = (id: UnitId) => {
    const u = UNITS[id], l = meta.unitLv?.[id] ?? 0, c = unitLvCost(l), locked = u.hunt ? !meta.cards?.includes(id) : !!u.research && !has(u.research);
    return `<div class="row"><div class="t"><b>${u.name}</b> <small>${L('nível', 'level')} ${l}/${UNIT_MAX_LV}${locked ? (u.hunt ? L(' · conquiste na Caçada', ' · win it in the Hunt') : L(' · ainda não liberado na árvore', ' · not unlocked in the tree yet')) : ''}</small><br>` +
      `<small>${u.desc} ${L(`Agora: +${l * 15}% de força.`, `Now: +${l * 15}% strength.`)}</small></div>` +
      `<button data-u="${id}"${l >= UNIT_MAX_LV || m < c ? ' disabled' : ''}>${l >= UNIT_MAX_LV ? L('Máximo', 'Max') : `${c} ★`}</button></div>`;
  };
  const box = modal.show(`<h2>${L('Arsenal de Aureliano', 'Aureliano\'s Armory')}</h2><div class="sub">${L(`${m} marcas de caça ★ · ganhe até 3 por defesa (3 = ninguém levado) · permanentes`, `${m} hunt marks ★ · earn up to 3 per defense (3 = nobody taken) · permanent`)}</div>
    ${(Object.keys(UNITS) as UnitId[]).map(row).join('')}
    <p class="muted" style="font-size:12px;margin:8px 0 0">${L(`Recorde na Lua de Sangue: ${meta.bestWave ?? 0} ondas.`, `Blood Moon record: ${meta.bestWave ?? 0} waves.`)}</p>`);
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
