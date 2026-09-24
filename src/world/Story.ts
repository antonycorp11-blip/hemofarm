// "The Inheritance" (GDD_ADENDO A9/A10): Aunt Leonor's letter, her diary pages found along the way, the Heart × Fang
// scale, choices that come back later, the cast reacting to who you are, and five endings. Everything here lives in meta,
// so the story carries across mandates.
import { bus } from '../core/events';
import { state } from '../core/state';
import { meta, saveMeta, addSoul, flag, setFlag, soulTier } from '../core/meta';
import { invalidate } from '../core/bonus';
import { sfx } from '../core/sfx';
import { L } from '../core/i18n';
import { CREDITS, DIARY, ELDER_FANG, ENDINGS, EndingId, LETTER, PACT_PAGES, REACTIONS, REVEAL, REVOLT_HEART, TRAGIC_PAGES, fates } from '../data/lore';
import { CLEAN_WINS } from '../data/story';
import { CONTRACTS } from '../data/contracts';
import { SHORT, type Line } from '../data/tutorial';
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
.endings .opt b{color:#f6d9a0}.endings .opt small{color:#9a8a80}.endings .opt.secret{border-color:#8a1424;box-shadow:0 0 12px #8a142480}
.diary .pg.burnt{opacity:.7;border-left-color:#3a2a20;background:#d8c8a0;font-style:italic}
.fates{margin:6px 0 10px;padding-left:18px}.fates li{margin:3px 0}
`;

// Found once each, in the order the night hands them out.
const FIRST: Partial<Record<string, string>> = { bosque: 'ulf', pantano: 'grenda', fronteira: 'korvus', vale: 'soror', costa: 'captain' };

export interface StoryHost { say(lines: Line[], done?: () => void): void }

export class Story {
  private tick = 0;
  private reactIn = 0;

  constructor(private hud: Hud, private modal: Modal, private host: StoryHost) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    meta.diary ??= [];
    const find = (id: string) => this.find(id);
    bus.on('BLOOD_COLLECTED', () => find('first_blood'));
    bus.on('TITHE_PAID', () => find('first_tithe'));
    // Selling costs Fang, except the tutorial's first order, which every player has to deliver.
    bus.on('CONTRACT_COMPLETED', e => { find('first_sale'); if (!CONTRACTS.find(c => c.id === e.contractId)?.tutorialOnly) addSoul(-e.delivered); });
    bus.on('BOND_FORMED', () => find('first_bond'));
    bus.on('HEIR_ARRIVED', () => find('first_bond'));
    bus.on('RAID_ENDED', e => { if (e.result === 'won') find('first_raid'); });
    bus.on('RESEARCH_DONE', () => find('first_research'));
    bus.on('TITHE_FAILED', () => find('first_taken'));
    bus.on('HUMAN_TAKEN', e => { if (e.by === 'tithe') find('first_taken'); }); // the page is about the carriage's road, not the wolves
    bus.on('REBELLION_STARTED', () => find('rebellion'));
    bus.on('REGENT_CROWNED', () => find('regent'));
    bus.on('REGION_CLEARED', e => { const id = FIRST[e.region]; if (id) find(id); });
    bus.on('SOUL_CHANGED', e => {
      invalidate(); // Heart and Fang carry small bonuses (core/bonus)
      if (Math.abs(e.delta) < 2) return; // small nudges (a feast, a gift) move the scale quietly
      this.hud.toast(e.delta > 0 ? L(`❤ Coração +${e.delta}`, `❤ Heart +${e.delta}`) : L(`🗡 Presa +${-e.delta}`, `🗡 Fang +${-e.delta}`), e.delta > 0 ? 'good' : '', 2500);
    });
    // Now and then, someone tells you what they think of who you're becoming.
    bus.on('NIGHT_STARTED', ({ night }) => { if (state.tutorial.done && night >= 2 && Math.random() < 0.5) this.reactIn = 25000; });
    // Domains conquered before this chapter of the story existed still count.
    for (const r of Object.keys(meta.domains ?? {})) { const id = FIRST[r]; if (id && !meta.diary.includes(id)) meta.diary.push(id); }
    saveMeta();
  }

  get pages() { return (meta.diary ?? []).filter(id => !meta.diaryBurned?.includes(id)).length; }
  // Pages the player actually opened in the diary: the Pact and the tragic ending are about what you READ.
  get pagesRead() { return (meta.diaryRead ?? []).filter(id => meta.diary?.includes(id) && !meta.diaryBurned?.includes(id)).length; }
  get unread() { return meta.diaryNew ?? 0; }

  update(dt: number) {
    this.react(dt);
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 2000;
    const c = state.conquest;
    if (state.region === 'cripta' && c.introSeen) this.find('crypt');
    if (state.region === 'cripta' && c.cleanWins >= CLEAN_WINS) this.find('mother');
    this.consequences();
  }

  // Reactions run on real time (2 s ticks from update), the rest on story state.
  react(dt: number) {
    if (this.reactIn <= 0) return;
    this.reactIn -= dt;
    if (this.reactIn > 0) return;
    const pool = REACTIONS[soulTier()].filter(l => !(l.who === 'davi' && flag('daviGone')));
    const l = pool[Math.floor(Math.random() * pool.length)];
    if (l) this.hud.toast(`${SHORT[l.who]}: ${l.text}`, '', 8000);
  }

  // Choices that come back later (GDD_ADENDO A10).
  private consequences() {
    // Telling the Count about the cellar: he burned what was inside, including a page of the diary.
    if (flag('cellarToldCount') && !meta.diaryBurned?.includes('captain')) {
      meta.diaryBurned = [...(meta.diaryBurned ?? []), 'captain'];
      meta.diary = (meta.diary ?? []).filter(id => id !== 'captain');
      saveMeta();
      this.hud.toast(L('Vesper mandou queimar o que havia no porão. Uma página do diário se perdeu para sempre.', 'Vesper had everything in the cellar burned. A page of the diary is lost forever.'), 'bad', 8000);
    }
    // Opening the cellar: the Merchant pays well for a look at Leonor's island map when you reach the coast.
    if (state.region === 'costa' && state.conquest.introSeen && flag('cellarOpened') && !flag('costaMapPaid')) {
      setFlag('costaMapPaid');
      state.resources.gold += 300;
      this.host.say([
        { who: 'merchant', text: L('Esse mapa… é da Leonor! As ilhas, as enseadas, onde o Capitão ancora. Pago 300 de Ouro só para copiar.', 'This map… it\'s Leonor\'s! The islands, the coves, where the Captain anchors. I\'ll pay 300 Gold just to copy it.') },
        { who: 'aureliano', text: L('Com isso, pegamos o Capitão cansado. Ele vai chegar mais fraco.', 'With this, we catch the Captain tired. He\'ll arrive weaker.') },
      ]);
    }
  }

  private find(id: string) {
    const d = meta.diary ??= [];
    if (d.includes(id) || meta.diaryBurned?.includes(id)) return;
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

  // What the scale does right now (core/bonus + event odds), so the choice is never invisible.
  private soulEffects() {
    const t = soulTier();
    const txt = t === 'heart' ? L('Coração: humanos recuperam 10% mais rápido e acordam mais animados. O Conde desconfia: o Fiscal aparece mais.', 'Heart: humans recover 10% faster and wake up in better spirits. The Count is suspicious: the Inspector shows up more.')
      : t === 'fang' ? L('Presa: a Casa te favorece, contratos pagam 15% a mais e compradores VIP aparecem mais. A fazenda sente.', 'Fang: the House favors you, contracts pay 15% more and VIP buyers show up more. The farm can tell.')
      : L('Equilíbrio: ninguém sabe ainda de que lado você está.', 'Balanced: nobody knows yet whose side you\'re on.');
    return `<p class="sub" style="margin:-6px 0 10px">${txt}</p>`;
  }

  openDiary() {
    const found = new Set(meta.diary ?? []), burnt = new Set(meta.diaryBurned ?? []);
    const fresh = meta.diaryNew ?? 0;
    const order = (meta.diary ?? []);
    const recent = new Set(order.slice(order.length - fresh));
    meta.diaryNew = 0;
    meta.diaryRead = [...found].filter(id => !burnt.has(id));
    saveMeta();
    const pages = DIARY.map((p, i) => burnt.has(p.id)
      ? `<div class="pg burnt">${i + 1}. ${L('Página queimada por ordem do Conde. Só sobrou a borda.', 'Page burned on the Count\'s orders. Only the edge remains.')}</div>`
      : found.has(p.id)
      ? `<div class="pg${recent.has(p.id) ? ' new' : ''}"><b>${i + 1}. ${p.title}</b><br>${p.text}</div>`
      : `<div class="pg lock">${i + 1}. ${L('Página perdida. A noite ainda não a entregou.', 'A lost page. The night hasn\'t handed it over yet.')}</div>`).join('');
    const box = this.modal.show(`<h2>${L('Diário de Leonor', 'Leonor\'s Diary')}</h2>
      <div class="sub">${L(`${this.pages} de ${DIARY.length} páginas`, `${this.pages} of ${DIARY.length} pages`)}</div>${this.soulBar()}${this.soulEffects()}
      <div class="diary"><div class="pg"><b>${LETTER.title}</b><br>${LETTER.body.join(' ')} <i>${LETTER.sign}</i></div>${pages}</div>
      ${meta.endings?.length ? `<p class="sub" style="margin-top:10px">${L('Finais vistos', 'Endings seen')}: ${meta.endings.map(e => ENDINGS[e as EndingId]?.title).join(' · ')}</p>` : ''}`, { wide: true });
    box.classList.add('parch');
    sfx.page();
  }

  // ---------- the finale (Chapter VI) ----------
  finale() {
    // Too few pages and you never learn who she is (GDD_ADENDO A10): the tragic ending, no choice.
    if (this.pagesRead < TRAGIC_PAGES) { this.host.say(ENDINGS.tragic.lines, () => this.epilogue('tragic')); return; }
    this.host.say(REVEAL, () => this.chooseEnding());
  }

  private chooseEnding() {
    const soul = meta.soul ?? 0, pages = this.pagesRead, gone = !!flag('daviGone');
    const ids: EndingId[] = ['house', 'revolt', 'pact', ...(soul <= -ELDER_FANG ? ['elder' as EndingId] : [])]; // the secret one only shows when earned
    const ok: Partial<Record<EndingId, boolean>> = { house: true, revolt: soul >= REVOLT_HEART && !gone, pact: pages >= PACT_PAGES, elder: true };
    const why: Partial<Record<EndingId, string>> = {
      revolt: gone ? L('Davi foi embora depois da segunda repressão. Ninguém mais seguraria o portão.', 'Davi left after the second crackdown. Nobody else would hold the gate.')
        : L(`Seu Coração está em ${soul}. Precisa de ${REVOLT_HEART}.`, `Your Heart is at ${soul}. You need ${REVOLT_HEART}.`),
      pact: L(`Você leu ${pages} páginas. Precisa de ${PACT_PAGES}.`, `You've read ${pages} pages. You need ${PACT_PAGES}.`),
    };
    const opts = ids.map(id => {
      const e = ENDINGS[id];
      return `<div class="opt${id === 'elder' ? ' secret' : ''}"><b>${e.title}</b> · <small>${e.need}</small><br><button class="go" data-end="${id}"${ok[id] ? '' : ' disabled'}>${e.choice}</button>` +
        (ok[id] ? '' : `<small>${why[id]}</small>`) + '</div>';
    }).join('');
    const sub = gone ? L('Leonor espera. Vesper espera. O portão está sem ninguém.', 'Leonor waits. Vesper waits. Nobody holds the gate.')
      : L('Leonor espera. Vesper espera. Davi segura o portão.', 'Leonor waits. Vesper waits. Davi holds the gate.');
    const box = this.modal.show(`<h2>${L('A escolha', 'The choice')}</h2><div class="sub">${sub}</div>
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
    if (id === 'tragic') sfx.bad(); else sfx.chime();
    const who = fates(id, flag, meta.soul ?? 0);
    const total = Object.keys(ENDINGS).length;
    const box = this.modal.show(`<h2>${e.title}</h2>${e.epilogue.map(p => `<p>${p}</p>`).join('')}
      <h2 style="margin-top:14px;font-size:17px">${L('O que aconteceu com cada um', 'What became of them')}</h2><ul class="fates">${who.map(f => `<li>${f}</li>`).join('')}</ul>
      <h2 style="margin-top:18px">${CREDITS.title}</h2><p style="text-align:center">${CREDITS.thanks}</p>
      <p class="sub">${id === 'tragic' ? L('Existem outros finais. Da próxima vez, leia o diário.', 'There are other endings. Next time, read the diary.') : CREDITS.more} ${L(`Finais vistos: ${meta.endings.length}/${total}.`, `Endings seen: ${meta.endings.length}/${total}.`)}</p>
      <p class="sub">${L('A fazenda continua. Toque na coroa quando quiser fazer da Cripta um Domínio.', 'The farm goes on. Tap the crown whenever you want to make the Crypt a Domain.')}</p>
      <button class="go">${L('Voltar à fazenda', 'Back to the farm')}</button>`, { closable: false });
    box.classList.add('parch');
    box.querySelector<HTMLButtonElement>('.go')!.onclick = () => this.modal.close();
  }
}
