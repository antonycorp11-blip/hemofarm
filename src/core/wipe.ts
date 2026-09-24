// One-time progress wipe for every player (saves live only in each browser). Imported first by main.ts, so it runs
// before anything reads storage. Bump WIPE to reset everyone again; the chosen language (hemo.lang) is kept.
const WIPE = '2026-09-24-heranca';
try {
  if (localStorage.getItem('hemo.wipe') !== WIPE) {
    for (const k of Object.keys(localStorage)) if (k.startsWith('hemo.') && k !== 'hemo.lang') localStorage.removeItem(k);
    localStorage.setItem('hemo.wipe', WIPE);
  }
} catch { /* storage blocked: nothing saved to wipe */ }
