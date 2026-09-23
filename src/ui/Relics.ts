// Relic choice every few nights (roguelite layer): pick 1 of 3, kept until the mandate ends.
import Phaser from 'phaser';
import { bus } from '../core/events';
import { state } from '../core/state';
import { invalidate } from '../core/bonus';
import { sfx } from '../core/sfx';
import { RELICS, RELIC_EVERY } from '../data/relics';
import { Modal, icon } from './Modal';
import { L } from '../core/i18n';

export class Relics {
  constructor(private modal: Modal, private onPause: (p: boolean) => void) {
    bus.on('NIGHT_STARTED', ({ night }) => {
      if (night % RELIC_EVERY !== 0) return;
      const pool = Object.keys(RELICS).filter(id => !state.relics.includes(id));
      state.relicPick = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
      this.offer();
    });
  }

  // Resume a pending offer (e.g. after reloading the page).
  resume() { if (state.relicPick?.length) this.offer(); }

  offer() {
    const ids = state.relicPick;
    if (!ids?.length) return;
    this.onPause(true);
    const box = this.modal.show(`<h2>${L('Oferenda do Castelo', 'The Castle\'s Offering')}</h2><div class="sub">${L('Vesper: Escolha uma relíquia. Ela fica com você até o fim do mandato.', 'Vesper: Choose a relic. It stays with you until the end of the mandate.')}</div>
      <div class="cards3">${ids.map(id => `<button class="pick" data-r="${id}">${icon(RELICS[id].icon, 44)}<b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span></button>`).join('')}</div>`,
      { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-r]').forEach(b => b.onclick = () => {
      state.relics.push(b.dataset.r!);
      state.relicPick = undefined;
      invalidate();
      sfx.chime();
      this.modal.close();
      this.onPause(false);
    });
  }

  list() {
    const rows = state.relics.map(id => `<div class="row">${icon(RELICS[id].icon, 30)}<div class="t"><b>${RELICS[id].name}</b><br><small>${RELICS[id].desc}</small></div></div>`).join('');
    this.modal.show(`<h2>${L('Relíquias do mandato', 'Mandate relics')}</h2><div class="sub">${L(`Uma nova escolha a cada ${RELIC_EVERY} noites`, `A new choice every ${RELIC_EVERY} nights`)}</div>
      ${rows || `<p class="muted" style="text-align:center">${L(`Nenhuma ainda. A primeira oferenda chega na noite ${RELIC_EVERY}.`, `None yet. The first offering arrives on night ${RELIC_EVERY}.`)}</p>`}`);
  }
}
