// A* on the tile grid (4-neighbour). Cobblestone paths are cheaper so humans prefer the streets.
type P = [number, number];
const k = (i: number, j: number) => `${i},${j}`;

export function findPath(from: P, to: P, walkable: Set<string>, paths: Set<string>): P[] | null {
  const goal = k(to[0], to[1]);
  if (!walkable.has(goal)) return null;
  const open: { p: P; f: number }[] = [{ p: from, f: 0 }];
  const g = new Map<string, number>([[k(from[0], from[1]), 0]]);
  const came = new Map<string, P>();
  const h = (p: P) => Math.abs(p[0] - to[0]) + Math.abs(p[1] - to[1]);

  while (open.length) {
    let best = 0;
    for (let n = 1; n < open.length; n++) if (open[n].f < open[best].f) best = n;
    const { p } = open.splice(best, 1)[0];
    const pk = k(p[0], p[1]);
    if (pk === goal) {
      const out: P[] = [p];
      let c = came.get(pk);
      while (c) { out.unshift(c); c = came.get(k(c[0], c[1])); }
      return out;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n: P = [p[0] + di, p[1] + dj], nk = k(n[0], n[1]);
      if (!walkable.has(nk)) continue;
      const cost = g.get(pk)! + (paths.has(nk) ? 1 : 1.8);
      if (cost >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, cost); came.set(nk, p);
      open.push({ p: n, f: cost + h(n) });
    }
  }
  return null;
}
