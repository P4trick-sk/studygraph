/**
 * `studygraph cycles`: break dependency cycles (port of break_cycles.py).
 * 1) reference types are never prerequisites of non-reference types → relations as see-also;
 * 2) per cycle demote the weakest back-reference (only in uses < linked in statement < cited in proof),
 *    preferring edges whose target ranks later. Every demotion is logged in .sg/demotions.json.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadWorkspace, cycles, readJson, writeJson } from "./workspace.js";

export function breakCycles(root: string, apply = false) {
  const ws = loadWorkspace(root);
  const demoted: Array<{ source: string; target: string; reason: string }> = [];
  const key = (i: string): number[] => [ws.rank(i), ...ws.pos[i]];
  const cmpKey = (a: number[], b: number[]) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] - b[k]; return 0; };
  const demote = (a: string, b: string, reason: string) => {
    const n = ws.nodes[a];
    n.uses = (n.uses || []).filter((u: string) => u !== b);
    for (const st of n.proof?.steps || []) st.uses = (st.uses || []).filter((u: string) => u !== b);
    if (!(n.relations || []).some((r: any) => r.target === b)) n.relations = [...(n.relations || []), { type: "see-also", target: b }];
    demoted.push({ source: a, target: b, reason });
  };
  const strength = (a: string, b: string) => {
    const n = ws.nodes[a], p = n.proof || {};
    if ((p.steps || []).some((s: any) => (s.text || "").includes(`](${b})`) || (s.uses || []).includes(b)) || (p.strategy || "").includes(`](${b})`)) return 2;
    return (n.statement || "").includes(`](${b})`) ? 1 : 0;
  };
  for (const [a, n] of Object.entries(ws.nodes)) for (const b of ws.deps(n))
    if (ws.isRefType(ws.nodes[b].type) && !ws.isRefType(n.type)) demote(a, b, "reference type used as prerequisite");
  for (let round = 1; round <= 200; round++) {
    const comps = cycles(ws); if (!comps.length) break;
    for (const comp of comps) {
      const edges: Array<[string, string]> = [];
      for (const a of comp) for (const b of ws.deps(ws.nodes[a])) if (comp.has(b)) edges.push([a, b]);
      edges.sort((x, y) => strength(...x) - strength(...y)
        || Number(cmpKey(key(x[1]), key(x[0])) <= 0) - Number(cmpKey(key(y[1]), key(y[0])) <= 0)
        || -cmpKey(key(x[1]), key(y[1])));
      demote(edges[0][0], edges[0][1], `cycle (round ${round})`);
    }
  }
  const left = cycles(ws).length;
  if (apply && demoted.length) {
    for (const p of ws.files.keys()) ws.save(p);
    const log = join(root, ".sg", "demotions.json");
    writeJson(log, [...(existsSync(log) ? readJson(log) : []), ...demoted]);
  }
  return { demoted, left };
}
