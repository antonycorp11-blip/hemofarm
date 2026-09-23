// Lineage album: every blood type × quality (and every rare trait) ever seen on the farm is recorded forever.
// Each entry is +1% Blood in every future mandate — a collection that makes pairing humans worth planning.
import { bus } from '../core/events';
import { meta, saveMeta } from '../core/meta';
import { invalidate } from '../core/bonus';
import { BLOOD, BloodType, QUALITY, Quality, TRAIT, Trait, HumanTraits } from '../data/humans';
import type { Modal } from './Modal';

export const ALBUM_SIZE = Object.keys(BLOOD).length * Object.keys(QUALITY).length + Object.keys(TRAIT).length;

export function discover(t: HumanTraits, quiet = false) {
  const keys = [`${t.blood}:${t.quality}`, ...(t.trait ? [`trait:${t.trait}`] : [])];
  for (const key of keys) {
    meta.album ??= [];
    if (meta.album.includes(key)) continue;
    meta.album.push(key);
    saveMeta();
    invalidate();
    const name = key.startsWith('trait:') ? TRAIT[key.slice(6) as Trait].name : `${BLOOD[t.blood].name} ${QUALITY[t.quality].name}`;
    if (!quiet) bus.emit('LINEAGE_DISCOVERED', { key, name, total: meta.album.length });
  }
}

export function openAlbum(modal: Modal) {
  const has = (k: string) => meta.album?.includes(k);
  const bloods = Object.keys(BLOOD) as BloodType[], quals = Object.keys(QUALITY) as Quality[];
  const cell = (k: string, label: string) => `<div style="padding:6px 4px;border-radius:6px;text-align:center;font-size:11px;` +
    `background:${has(k) ? '#3a1a22' : '#140b0f'};color:${has(k) ? '#f6d9a0' : '#5a4a48'};border:1px solid ${has(k) ? '#8a3a44' : '#2a1a1e'}">${has(k) ? label : '?'}</div>`;
  const grid = `<div style="display:grid;grid-template-columns:auto repeat(${quals.length},1fr);gap:4px;align-items:center">` +
    `<div></div>${quals.map(q => `<div style="text-align:center;font-size:11px;color:#c9a98a">${QUALITY[q].name}</div>`).join('')}` +
    bloods.map(b => `<div style="font-size:12px;color:#c9a98a;padding-right:4px">${BLOOD[b].name}</div>${quals.map(q => cell(`${b}:${q}`, '✓')).join('')}`).join('') + '</div>';
  const traits = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">${(Object.keys(TRAIT) as Trait[]).map(t => cell(`trait:${t}`, TRAIT[t].name)).join('')}</div>`;
  const n = meta.album?.length ?? 0;
  modal.show(`<h2>Álbum de Linhagens</h2><div class="sub">${n}/${ALBUM_SIZE} descobertas · +${n}% de Sangue em todos os mandatos</div>
    ${grid}${traits}<p class="muted" style="font-size:12px;margin:10px 0 0">Cada combinação nova de sangue e qualidade que aparecer na fazenda entra no álbum para sempre.
    Forme pares de qualidades diferentes para descobrir as mais raras.</p>`);
}
