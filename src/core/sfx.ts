// Audio: CC0 samples (Kenney, OpenGameArt — see public/audio/CREDITS.txt), looping music with crossfades,
// and wordless "voices" (short vocal blips per character, Undertale style). Everything goes through one WebAudio
// context started on the first user gesture ("Jogar"). Samples load lazily; until one is ready a synthesized tone stands in.
import { meta, saveMeta } from './meta';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let sfxBus: GainNode | undefined;
let musicBus: GainNode | undefined;
const buffers = new Map<string, AudioBuffer | 'loading'>();

const SFX_VOL = 0.55, MUSIC_VOL = 0.32;

export function unlockAudio() {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = meta.mute ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = meta.music === false ? 0 : MUSIC_VOL; musicBus.connect(master);
    // Preload the short effects; music loads when first requested.
    for (const k of Object.values(SAMPLE).flat()) load(k);
    // Phones suspend audio when the app goes to the background: resume on return.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void ctx?.resume(); });
    if (pendingMusic) music(pendingMusic);
  } catch { /* no audio on this device */ }
}

export function setMute(m: boolean) {
  meta.mute = m;
  saveMeta();
  if (master) master.gain.value = m ? 0 : 1;
}

export function setMusic(on: boolean) {
  meta.music = on;
  saveMeta();
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, 0.3);
}

function load(name: string) {
  if (!ctx || buffers.has(name)) return;
  buffers.set(name, 'loading');
  fetch(`audio/${name}.mp3`).then(r => r.arrayBuffer()).then(b => ctx!.decodeAudioData(b)).then(buf => buffers.set(name, buf))
    .catch(() => buffers.delete(name));
}

function play(name: string, vol = 1, rate = 1, bus = sfxBus) {
  const buf = buffers.get(name);
  if (!ctx || !bus || !buf || buf === 'loading' || meta.mute) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  g.gain.value = vol;
  src.connect(g).connect(bus);
  src.start();
  return true;
}

// Synth fallback while samples load (and for a couple of tiny cues).
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, at = 0, slide?: number) {
  if (!ctx || !sfxBus || meta.mute) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const SAMPLE = {
  coin: ['sfx_coin', 'sfx_coin2'], drop: ['sfx_drop'], build: ['sfx_build', 'sfx_build2'], bell: ['sfx_bell'], howl: ['sfx_howl'], chime: ['sfx_confirm'],
  bad: ['sfx_error'], click: ['sfx_click'], open: ['sfx_open'], close: ['sfx_close'], page: ['sfx_page'], door: ['sfx_door'], chop: ['sfx_chop'],
  hit: ['sfx_hit'], hitHeavy: ['sfx_hit_heavy'], shot: ['sfx_shot'], flask: ['sfx_flask'], blade: ['sfx_blade'], thud: ['sfx_thud'], pluck: ['sfx_pluck'],
  glass: ['sfx_glass'], bong: ['sfx_bong'], latch: ['sfx_latch'],
};
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const vary = () => 0.92 + Math.random() * 0.16; // small pitch variation so repeats don't sound robotic

// Rate limit per sound: a battle with 20 sentinels shouldn't become noise.
const last = new Map<string, number>();
function fire(k: keyof typeof SAMPLE, vol = 1, gap = 60, fallback?: () => void) {
  const now = performance.now();
  if (now - (last.get(k) ?? 0) < gap) return;
  last.set(k, now);
  if (!play(pick(SAMPLE[k]), vol, vary())) fallback?.();
}

export const sfx = {
  coin: () => fire('coin', 0.9, 80, () => { tone(988, 0.08, 'square', 0.18); tone(1319, 0.18, 'square', 0.18, 0.07); }),
  drop: () => fire('drop', 0.6, 350, () => tone(620, 0.16, 'sine', 0.35, 0, 240)),
  build: () => fire('build', 1, 150, () => { tone(392, 0.25, 'triangle', 0.3); tone(494, 0.25, 'triangle', 0.25, 0.08); }),
  bell: () => fire('bell', 0.9, 400, () => { tone(523, 1.2, 'sine', 0.35); tone(1046, 0.8, 'sine', 0.12); }),
  howl: () => fire('howl', 1, 800, () => { tone(300, 1.6, 'sawtooth', 0.08, 0, 520); tone(310, 1.4, 'sine', 0.2, 0.1, 480); }),
  chime: () => fire('chime', 0.8, 120, () => { tone(880, 0.3, 'sine', 0.25); tone(1175, 0.4, 'sine', 0.2, 0.1); }),
  bad: () => fire('bad', 0.8, 200, () => tone(220, 0.35, 'square', 0.12, 0, 150)),
  click: () => fire('click', 0.6, 40, () => tone(700, 0.04, 'square', 0.08)),
  open: () => fire('open', 0.6, 80), close: () => fire('close', 0.5, 80), page: () => fire('page', 0.7, 120),
  door: () => fire('door', 0.35, 400), chop: () => fire('chop', 0.6, 150),
  hit: () => fire('hit', 0.5, 70), hitHeavy: () => fire('hitHeavy', 0.8, 150), shot: () => fire('shot', 0.35, 90),
  flask: () => fire('flask', 0.6, 120), blade: () => fire('blade', 0.7, 120), thud: () => fire('thud', 0.7, 120),
  pluck: () => fire('pluck', 0.5, 60), glass: () => fire('glass', 0.5, 100), bong: () => fire('bong', 0.6, 200), latch: () => fire('latch', 0.6, 150),
};

// ---------- voices: wordless vocal blips ----------
type Voice = { set: string; rate: number };
const VOICES: Record<string, Voice> = {
  boris: { set: 'male_deep', rate: 0.85 }, aureliano: { set: 'male_deep', rate: 1 }, vesper: { set: 'whisper', rate: 0.9 },
  rubelia: { set: 'female_standard', rate: 1.05 }, lia: { set: 'female_light', rate: 1.05 }, davi: { set: 'male_standard', rate: 1 },
  hematico: { set: 'quick', rate: 1.1 }, ulf: { set: 'demon', rate: 0.85 }, merchant: { set: 'male_standard', rate: 0.85 },
  inspector: { set: 'male_standard', rate: 0.9 }, human_m: { set: 'male_standard', rate: 1.1 }, human_f: { set: 'female_standard', rate: 1.15 },
  count: { set: 'male_deep', rate: 0.95 }, mother: { set: 'demon', rate: 0.7 },
};
let voicesLoaded = false;
let lastVoice = 0;
export function voice(who: string, gap = 90) {
  if (!ctx) return;
  if (!voicesLoaded) {
    voicesLoaded = true;
    for (const v of new Set(Object.values(VOICES).map(x => x.set))) for (let i = 1; i <= 4; i++) load(`voice_${v}_${i}`);
  }
  const now = performance.now();
  if (now - lastVoice < gap) return;
  lastVoice = now;
  const v = VOICES[who] ?? VOICES.human_m;
  play(`voice_${v.set}_${1 + Math.floor(Math.random() * 4)}`, 0.55, v.rate * (0.95 + Math.random() * 0.1));
}

// ---------- music: one looping track at a time, crossfaded ----------
export type Track = 'night' | 'forest' | 'battle';
const TRACK_FILE: Record<Track, string> = { night: 'music_night', forest: 'music_forest', battle: 'music_battle' };
let current: { track: Track; src: AudioBufferSourceNode; g: GainNode } | undefined;
let pendingMusic: Track | undefined;

export function music(track: Track) {
  pendingMusic = track;
  if (!ctx || !musicBus) return;
  if (current?.track === track) return;
  const file = TRACK_FILE[track];
  const buf = buffers.get(file);
  if (!buf || buf === 'loading') {
    load(file);
    // Try again once it's decoded.
    const wait = setInterval(() => { const b = buffers.get(file); if (b && b !== 'loading') { clearInterval(wait); if (pendingMusic === track) music(track); } }, 400);
    return;
  }
  const t = ctx.currentTime;
  if (current) {
    const old = current;
    old.g.gain.setTargetAtTime(0, t, 0.6);
    setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 3000);
  }
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.loop = true;
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(1, t, 0.8);
  src.connect(g).connect(musicBus);
  src.start();
  current = { track, src, g };
}

// The farm alternates its two night themes.
let farmTimer: ReturnType<typeof setTimeout> | undefined;
export function farmMusic() {
  clearTimeout(farmTimer);
  const next = current?.track === 'night' ? 'forest' : 'night';
  music(current?.track === 'battle' || !current ? 'night' : next);
  farmTimer = setTimeout(farmMusic, 4 * 60 * 1000);
}
export function battleMusic() { clearTimeout(farmTimer); music('battle'); }
