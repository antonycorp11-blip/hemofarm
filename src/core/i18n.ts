// Language (PT/EN). Every player-facing string is written as L('português', 'english') right where it's used, so a line
// can never be missing a translation. The choice is read once at startup (data modules translate at import time);
// changing it saves the choice and reloads the page.
export type Lang = 'pt' | 'en';
const KEY = 'hemo.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  const nav = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return nav.startsWith('pt') ? 'pt' : 'en';
}

export const lang: Lang = detect();
export const L = (pt: string, en: string) => (lang === 'en' ? en : pt);

export function setLang(l: Lang) {
  if (l === lang) return;
  try { localStorage.setItem(KEY, l); } catch { /* not critical */ }
  location.reload(); // the farm is saved on beforeunload
}

document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
