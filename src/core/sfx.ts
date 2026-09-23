// Small synthesized sound effects (GDD §17: character comes from short sounds). No audio files needed.
// The AudioContext starts on the first user gesture (the "Jogar" button) as browsers require.
import { meta, saveMeta } from './meta';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;

export function unlockAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = meta.mute ? 0 : 0.35;
    master.connect(ctx.destination);
  } catch { /* no audio on this device */ }
}

export function setMute(m: boolean) {
  meta.mute = m;
  saveMeta();
  if (master) master.gain.value = m ? 0 : 0.35;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, at = 0, slide?: number) {
  if (!ctx || !master || meta.mute) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let lastDrop = 0;
export const sfx = {
  coin: () => { tone(988, 0.08, 'square', 0.18); tone(1319, 0.18, 'square', 0.18, 0.07); },
  drop: () => { const now = performance.now(); if (now - lastDrop < 350) return; lastDrop = now; tone(620, 0.16, 'sine', 0.35, 0, 240); },
  build: () => { tone(392, 0.25, 'triangle', 0.3); tone(494, 0.25, 'triangle', 0.25, 0.08); tone(587, 0.4, 'triangle', 0.25, 0.16); },
  bell: () => { tone(523, 1.2, 'sine', 0.35); tone(1046, 0.8, 'sine', 0.12); tone(784, 1, 'sine', 0.1, 0.02); },
  howl: () => { tone(300, 1.6, 'sawtooth', 0.08, 0, 520); tone(310, 1.4, 'sine', 0.2, 0.1, 480); },
  chime: () => { tone(880, 0.3, 'sine', 0.25); tone(1175, 0.4, 'sine', 0.2, 0.1); },
  bad: () => { tone(220, 0.35, 'square', 0.12, 0, 150); },
  click: () => tone(700, 0.04, 'square', 0.08),
};
