/** `studygraph links`: unlinked mentions of other nodes' titles, terms and aliases (suggestions only). */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LINK, normalize, textsOf } from "../core/text.js";
import { loadWorkspace, readJson, writeJson } from "./workspace.js";

const stem = (w: string) => { w = normalize(w); return w.length >= 8 ? w.slice(0, -3) : w.length >= 6 ? w.slice(0, -2) : w.length >= 5 ? w.slice(0, -1) : w; };
const words = (s: string) => s.match(/[\p{L}]+/gu) || [];

export interface Suggestion { node: string; field: string; text: string; target: string; score: number }

export function rejectSuggestion(root: string, pair: string) {
  const p = join(root, ".sg", "links-rejected.json");
  const s = new Set<string>(existsSync(p) ? readJson(p) : []); s.add(pair); writeJson(p, [...s].sort());
}

export function suggestLinks(root: string, opts: { topic?: string } = {}) {
  const ws = loadWorkspace(root);
  const rp = join(root, ".sg", "links-rejected.json");
  const rejected = new Set<string>(existsSync(rp) ? readJson(rp) : []);
  const ignore = new Set(ws.config.linkIgnore || []);
  const byFirst = new Map<string, Array<{ stems: string[]; target: string; w: number }>>();
  for (const [id, n] of Object.entries(ws.nodes)) {
    if (ignore.has(id)) continue;
    const cands: Array<[string, number]> = [[n.title, 3], ...(n.terms || []).map((t: any) => [t.term, 4] as [string, number]),
      ...(n.terms || []).filter((t: any) => t.alt).map((t: any) => [t.alt, 2] as [string, number]), ...(n.aliases || []).map((a: string) => [a, 2] as [string, number])];
    for (let [text, w] of cands) {
      text = String(text || "").replace(/\$[^$]*\$/g, " ").replace(/^\s*\p{L}+\s+[\d.]+[a-z]?\s*[–:-]\s*/u, "").split(/[–:(]/)[0];
      if (/\d/.test(text)) continue;
      const ws_ = words(text).filter(x => x.length > 2);
      if (ws_.length < 1 || ws_.length > 5 || (ws_.length === 1 && ws_[0].length < 5)) continue;
      const stems = ws_.map(stem);
      if (!byFirst.has(stems[0])) byFirst.set(stems[0], []);
      byFirst.get(stems[0])!.push({ stems, target: id, w: w + stems.length });
    }
  }
  let out: Suggestion[] = [];
  for (const [id, n] of Object.entries(ws.nodes)) {
    if (opts.topic && n.topic !== opts.topic) continue;
    const linked = new Set<string>([...(n.uses || []), ...(n.relations || []).map((r: any) => r.target), id]);
    const done = new Set<string>();
    for (const [field, t] of textsOf(n)) {
      const plain = t.replace(LINK, m => " ".repeat(m.length)).replace(/\$[^$]*\$/g, m => " ".repeat(m.length));
      const toks = [...plain.matchAll(/[\p{L}]+/gu)].map(m => ({ at: m.index!, w: m[0] }));
      const st = toks.map(x => stem(x.w));
      for (let k = 0; k < toks.length; k++) for (const ph of byFirst.get(st[k]) || []) {
        if (linked.has(ph.target) || done.has(ph.target) || rejected.has(`${id}:${ph.target}`)) continue;
        if (ph.stems.every((s, j) => st[k + j] === s)) {
          const last = toks[k + ph.stems.length - 1];
          out.push({ node: id, field, text: t.slice(toks[k].at, last.at + last.w.length), target: ph.target, score: ph.w }); done.add(ph.target);
        }
      }
    }
  }
  const per = new Map<string, number>(); out.forEach(x => per.set(x.target, (per.get(x.target) || 0) + 1));
  const limit = Math.max(12, Math.floor(Object.keys(ws.nodes).length / 25));
  const generic = [...per].filter(([, c]) => c > limit).map(([t]) => t).sort();
  out = out.filter(x => !generic.includes(x.target)).sort((a, b) => b.score - a.score);
  writeJson(join(root, ".sg", "links.json"), out);
  return { suggestions: out, generic, limit };
}
