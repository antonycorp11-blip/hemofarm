// "The Inheritance" (GDD_ADENDO A9): Aunt Leonor's letter, her diary pages found along the way, the Heart × Fang scale
// and the three endings. Everything here lives in meta, so the story carries across mandates.
import { bus } from '../core/events';
import { state } from '../core/state';
import { meta, saveMeta, addSoul } from '../core/meta';
import { sfx } from '../core/sfx';
import { L } from '../core/i18n';
import { CREDITS, DIARY, ENDINGS, EndingId, LETTER, PACT_PAGES, REVEAL, REVOLT_HEART } from '../data/lore';
import { CLEAN_WINS } from '../data/story';
import type { Line } from '../data/tutorial';
import type { Hud } from '../ui/Hud';
import type { Modal } from '../ui/Modal';

const CSS = `
.mdl .box.parch{background:#e9d9b8;color:#2b1a12;border-image:none;border:0;border-radius:6px;box-shadow:0 10px 40px #000,inset 0 0 60px #a0784a90;
  font:16px/1.55 Georgia,serif;padding:22px 26px}
.mdl .box.parch h2{color:#5a1020}.mdl .box.parch .sub{color:#6a4a30}.mdl .box.parch .x{color:#5a3a20}
.mdl .box.parch p{margin:0 0 10px}.mdl .box.parch .sign{text-align:right;font-style:italic;color:#5a1020}
.mdl .box.parch button.go{color:#fff}
.diary{display:flex;flex-direction:column;gap:8px;text-align:left}
.diary .pg{padding:8px 12px;background:#f3e6c8;border-left:4px solid #8a1424;border-radius:0 6px 6px 0}
.diary .pg b{color:#5a1020}.diary .pg.lock{opacity:.55;border-left-color:#8a7a60;font-style:italic}.diary .pg.new{box-shadow:0 0 0 2px #e8b54a}
.soul{margin:6px 0 12px}.soul .bar{position:relative;height:12px;border-radius:6px;background:linear-gradient(90deg,#5a0a14,#8a6a50 50%,#c8a060)}
.soul .bar i{position:absolute;top:-4px;width:6px;height:20px;border-radius:3px;background:#1a0a0e;box-shadow:0 0 0 2px #f3e6c8;transform:translateX(-50%)}
.soul .ends{display:flex;justify-content:space-between;font-size:12px;color:#6a4a30;margin-top:3px}
.endings{display:flex;flex-direction:column;gap:8px}
.endings .opt{padding:10px 12px;border-radius:8px;background:#1a0f14;border:1px solid #4a1620}
.endings .opt b{color:#f6d9a0}.endings .opt small{color:#9a8a80}
`;

// Found once each, in the order the night hands them out.
const FIRST: Partial<Record<string, string>> = { bosque: 'ulf', pantano: 'grenda', fronteira: 'korvus', vale: 'soror', costa: 'captain' };

export interface StoryHost { say(lines: Line[], done?: () => void): void }

export class Story {
  private tick = 0;

  constructor(private hud: Hud, private modal: Modal, private host: StoryHost) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    meta.diary ??= [];
    const find = (id: string) => this.find(id);
    bus.on('BLOOD_COLLECTED', () => find('first_blood'));
    bus.on('TITHE_PAID', () => find('first_tithe'));
    bus.on('CONTRACT_COMPLETED', e => { find('first_sale'); addSoul(-e.delivered); });
    bus.on('BOND_FORMED', () => find('first_bond'));
    bus.on('HEIR_ARRIVED', () => find('first_bond'));
    bus.on('RAID_ENDED', e => { if (e.result === 'won') find('first_raid'); });
    bus.on('RESEARCH_DONE', () => find('first_research'));
    bus.on('TITHE_FAILED', () => find('first_taken'));
    bus.on('HUMAN_TAKEN', () => find('first_taken'));
    bus.on('REBELLION_STARTED', () => find('rebellion'));
    bus.on('REGENT_CROWNED', () => find('regent'));
    bus.on('REGION_CLEARED', e => { const id = FIRST[e.region]; if (id) find(id); });
    bus.on('SOUL_CHANGED', e => {
      if (Math.abs(e.delta) < 2) return; // small nudges (a feast, a gift) move the scale quietly
      this.hud.toast(e.delta > 0 ? L(`❤ Coração +${e.delta}`, `❤ Heart +${e.delta}`) : L(`🗡 Presa +${-e.delta}`, `🗡 Fang +${-e.delta}`), e.delta > 0 ? 'good' : '', 2500);
    });
    // Domains conquered before this chapter of the story existed still count.
    for (const r of Object.keys(meta.domains ?? {})) { const id = FIRST[r]; if (id && !meta.diary.includes(id)) meta.diary.push(id); }
    saveMeta();
  }

  get pages() { return meta.diary?.length ?? 0; }
  get unread() { return meta.diaryNew ?? 0; }

  update(dt: number) {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 2000;
    const c = state.conquest;
    if (state.region === 'cripta' && c.introSeen) this.find('crypt');
    if (state.region === 'cripta' && c.cleanWins >= CLEAN_WINS) this.find('mother');
  }

  private find(id: string) {
    const d = meta.diary ??= [];
    if (d.includes(id)) return;
    d.push(id);
    meta.diaryNew = (meta.diaryNew ?? 0) + 1;
    saveMeta();
    const page = DIARY.find(p => p.id === id);
    sfx.page();
    this.hud.toast(L(`📖 Página do diário encontrada: "${page?.title}". Leia no Diário de Leonor.`, `📖 Diary page found: "${page?.title}". Read it in Leonor's Diary.`), 'good', 7000);
    bus.emit('DIARY_PAGE', { id, total: d.length });
  }

  // ---------- the letter (first launch) ----------
  letter(done: () => void) {
    if (meta.letterSeen) { done(); return; }
    const box = this.modal.show(`<h2>${LETTER.title}</h2>${LETTER.body.map(p => `<p>${p}</p>`).join('')}<p class="sign">${LETTER.sign}</p>
      <button class="go">${L('Guardar a carta', 'Keep the letter')}</button>`, { closable: false, onClose: () => { meta.letterSeen = true; saveMeta(); done(); } });
    box.classList.add('parch');
    sfx.page();
    box.querySelector<HTMLButtonElement>('.go')!.onclick = () => this.modal.close();
  }

  // ---------- the diary ----------
  soulBar() {
    const s = meta.soul ?? 0;
    return `<div class="soul"><div class="bar"><i style="left:${(s + 100) / 2}%"></i></div>` +
      `<div class="ends"><span>🗡 ${L('Presa', 'Fang')}</span><span>${s > 0 ? L(`Coração ${s}`, `Heart ${s}`) : s < 0 ? L(`Presa ${-s}`, `Fang ${-s}`) : L('Equilíbrio', 'Balanced')}</span><span>${L('Coração', 'Heart')} ❤</span></div></div>`;
  }

  openDiary() {
    const found = new Set(meta.diary ?? []);
    const fresh = meta.diaryNew ?? 0;
    const order = (meta.diary ?? []);
    const recent = new Set(order.slice(order.length - fresh));
    meta.diaryNew = 0;
    saveMeta();
    const pages = DIARY.map((p, i) => found.has(p.id)
      ? `<div class="pg${recent.has(p.id) ? ' new' : ''}"><b>${i + 1}. ${p.title}</b><br>${p.text}</div>`
      : `<div class="pg lock">${i + 1}. ${L('Página perdida. A noite ainda não a entregou.', 'A lost page. The night hasn\'t handed it over yet.')}</div>`).join('');
    const box = this.modal.show(`<h2>${L('Diário de Leonor', 'Leonor\'s Diary')}</h2>
      <div class="sub">${L(`${found.size} de ${DIARY.length} páginas`, `${found.size} of ${DIARY.length} pages`)}</div>${this.soulBar()}
      <div class="diary"><div class="pg"><b>${LETTER.title}</b><br>${LETTER.body.join(' ')} <i>${LETTER.sign}</i></div>${pages}</div>
      ${meta.endings?.length ? `<p class="sub" style="margin-top:10px">${L('Finais vistos', 'Endings seen')}: ${meta.endings.map(e => ENDINGS[e as EndingId]?.title).join(' · ')}</p>` : ''}`, { wide: true });
    box.classList.add('parch');
    sfx.page();
  }

  // ---------- the finale (Chapter VI) ----------
  finale() {
    this.host.say(REVEAL, () => this.chooseEnding());
  }

  private chooseEnding() {
    const soul = meta.soul ?? 0, pages = this.pages;
    const ok: Record<EndingId, boolean> = { house: true, revolt: soul >= REVOLT_HEART, pact: pages >= PACT_PAGES };
    const why: Record<EndingId, string> = {
      house: '',
      revolt: L(`Seu Coração está em ${soul}. Precisa de ${REVOLT_HEART}.`, `Your Heart is at ${soul}. You need ${REVOLT_HEART}.`),
      pact: L(`Você leu ${pages} páginas. Precisa de ${PACT_PAGES}.`, `You've read ${pages} pages. You need ${PACT_PAGES}.`),
    };
    const opts = (Object.keys(ENDINGS) as EndingId[]).map(id => {
      const e = ENDINGS[id];
      return `<div class="opt"><b>${e.title}</b> · <small>${e.need}</small><br><button class="go" data-end="${id}"${ok[id] ? '' : ' disabled'}>${e.choice}</button>` +
        (ok[id] ? '' : `<small>${why[id]}</small>`) + '</div>';
    }).join('');
    const box = this.modal.show(`<h2>${L('A escolha', 'The choice')}</h2><div class="sub">${L('Leonor espera. Vesper espera. Davi segura o portão.', 'Leonor waits. Vesper waits. Davi holds the gate.')}</div>
      ${this.soulBar()}<div class="endings">${opts}</div>`, { closable: false });
    box.querySelectorAll<HTMLButtonElement>('[data-end]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.end as EndingId;
      if (!ok[id]) return;
      this.modal.close();
      this.host.say(ENDINGS[id].lines, () => this.epilogue(id));
    }));
  }

  private epilogue(id: EndingId) {
    const e = ENDINGS[id];
    meta.endings = [...new Set([...(meta.endings ?? []), id])];
    saveMeta();
    bus.emit('STORY_ENDING', { id });
    sfx.chime();
    const box = this.modal.show(`<h2>${e.title}</h2>${e.epilogue.map(p => `<p>${p}</p>`).join('')}
      <h2 style="margin-top:18px">${CREDITS.title}</h2><p style="text-align:center">${CREDITS.thanks}</p>
      <p class="sub">${CREDITS.more} ${L(`Finais vistos: ${meta.endings.length}/3.`, `Endings seen: ${meta.endings.length}/3.`)}</p>
      <p class="sub">${L('A fazenda continua. Toque na coroa quando quiser fazer da Cripta um Domínio.', 'The farm goes on. Tap the crown whenever you want to make the Crypt a Domain.')}</p>
      <button class="go">${L('Voltar à fazenda', 'Back to the farm')}</button>`, { closable: false });
    box.classList.add('parch');
    box.querySelector<HTMLButtonElement>('.go')!.onclick = () => this.modal.close();
  }
}
