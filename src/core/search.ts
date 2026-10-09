/** Diacritics-insensitive weighted search with prefix and one-typo matching. */
import type { Graph } from "./graph.js";
import { tokenize } from "./text.js";

export function edit1(a: string, b: string): boolean {
  if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
  return e + (la - i) + (lb - j) <= 1;
}
export interface SearchFilters { type?: string; topic?: string; status?: string; course?: string }
export function search(G: Graph, q: string, filters: SearchFilters = {}): Array<{ id: string; score: number }> {
  const toks = tokenize(q); if (!toks.length) return [];
  let scores: Map<string, number> | null = null;
  toks.forEach((t, i) => {
    const last = i === toks.length - 1, s = new Map<string, number>();
    for (const v of G.vocab) {
      let f = 0;
      if (v === t) f = 1; else if (last && v.startsWith(t)) f = 0.8; else if (t.length >= 5 && edit1(v, t)) f = 0.6;
      if (f) for (const [id, w] of G.index.get(v)!) s.set(id, Math.max(s.get(id) || 0, w * f));
    }
    if (!scores) scores = s; else { const n = new Map<string, number>(); for (const [id, w] of scores as Map<string, number>) if (s.has(id)) n.set(id, w + s.get(id)!); scores = n; }
  });
  const res = [...(scores as Map<string, number> | null ?? new Map<string, number>())].map(([id, score]) => ({ id, score })).filter(({ id }) => {
    const n = G.nodes[id] || G.apps[id];
    if (filters.type && (G.nodes[id] ? n.type : "application") !== filters.type) return false;
    if (filters.topic && n.topic !== filters.topic) return false;
    if (filters.status && (n.review?.status || "draft") !== filters.status) return false;
    if (filters.course && G.topicById[n.topic]?.course !== filters.course) return false;
    return true;
  });
  return res.sort((a, b) => b.score - a.score || (G.nodes[a.id]?.seq ?? 1e9) - (G.nodes[b.id]?.seq ?? 1e9)).slice(0, 60);
}
