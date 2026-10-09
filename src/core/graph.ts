/** Derived data computed from a CourseBundle: reverse edges, learning paths, search index, checks, warnings. */
import type { CourseBundle, Demotion } from "../schema/index.js";
import { resolveConfig, type ResolvedConfig, type ResolvedType } from "./presets.js";
import { tokenize, evalExpr, numberIn } from "./text.js";

export interface GTopic { id: string; title: string; course?: string; order: number; nodeIds: string[]; figureIds: string[]; appIds: string[]; quizIds: string[]; [k: string]: any }
export interface GNode { id: string; type: string; topic: string; title: string; statement: string; seq: number; [k: string]: any }
export interface GEdge { source: string; target: string; kind: "uses" | "rel" | "app"; type?: string }
export interface Graph {
  cfg: ResolvedConfig;
  topics: GTopic[]; topicById: Record<string, GTopic>;
  nodes: Record<string, GNode>; figures: Record<string, any>; apps: Record<string, any>; quiz: Record<string, any>;
  reserved: Record<string, any>;
  usedBy: Record<string, string[]>; relatedFrom: Record<string, Array<{ type: string; source: string; note?: string }>>;
  appsFor: Record<string, string[]>; quizFor: Record<string, string[]>; figuresFor: Record<string, string[]>;
  edges: GEdge[];
  learningPath(id: string): string[]; prereqs(id: string): string[];
  index: Map<string, Map<string, number>>; vocab: string[];
  checkResults: Array<{ id: string; ok: boolean; detail: string }>;
  warnings: Array<{ id: string; msg: string }>;
  demotions: Demotion[];
  typeOf(id: string): ResolvedType | null; rank(id: string): number;
}

export function buildGraph(course: CourseBundle): Graph {
  const cfg = resolveConfig(course.config as any);
  const regTopics: Record<string, any> = Object.fromEntries((course.registry.topics || []).map(t => [t.id, t]));
  const topics: GTopic[] = course.topics.map(t => ({ ...regTopics[t.meta.id], ...t.meta, order: t.meta.order ?? regTopics[t.meta.id]?.order ?? 99, nodeIds: [], figureIds: [], appIds: [], quizIds: [] }) as GTopic)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
  const topicById: Record<string, GTopic> = Object.fromEntries(topics.map(t => [t.id, t]));
  const nodes: Record<string, GNode> = {}, figures: Record<string, any> = {}, apps: Record<string, any> = {}, quiz: Record<string, any> = {};
  let seq = 0;
  for (const t of course.topics) {
    const T = topicById[t.meta.id];
    for (const n of t.nodes) { nodes[n.id] = { ...(n as any), topic: n.topic || T.id, seq: seq++ }; T.nodeIds.push(n.id); }
    for (const f of t.figures) { figures[f.id] = { ...f, topic: T.id }; T.figureIds.push(f.id); }
    for (const a of t.applications) { apps[a.id] = { ...a, topic: T.id }; T.appIds.push(a.id); }
    for (const q of t.quiz) { quiz[q.id] = { ...q, topic: T.id }; T.quizIds.push(q.id); }
  }
  const reserved: Record<string, any> = Object.fromEntries((course.registry.reserved || []).map(r => [r.id, r]));
  const typeOf = (id: string) => nodes[id] ? cfg.typeById[nodes[id].type] || null : null;
  const rank = (id: string) => { const r = typeOf(id)?.rank; return r === null || r === undefined ? 9 : r; };
  const topicOrder = (id: string) => topicById[nodes[id]?.topic]?.order ?? 99;

  const usedBy: Graph["usedBy"] = {}, relatedFrom: Graph["relatedFrom"] = {}, appsFor: Graph["appsFor"] = {}, quizFor: Graph["quizFor"] = {}, figuresFor: Graph["figuresFor"] = {};
  const push = <T>(m: Record<string, T[]>, k: string, v: T) => { (m[k] || (m[k] = [])).push(v); };
  const edges: GEdge[] = [];
  const stepUses = (n: any): string[] => (n.proof?.steps || []).flatMap((s: any) => s.uses || []);
  for (const n of Object.values(nodes)) {
    for (const u of new Set<string>([...(n.uses || []), ...stepUses(n)])) if (nodes[u]) push(usedBy, u, n.id);
    for (const u of n.uses || []) if (nodes[u]) edges.push({ source: n.id, target: u, kind: "uses" });
    for (const r of n.relations || []) if (nodes[r.target]) { push(relatedFrom, r.target, { type: r.type, source: n.id, note: r.note }); edges.push({ source: n.id, target: r.target, kind: "rel", type: r.type }); }
    for (const f of n.figures || []) if (figures[f]) push(figuresFor, n.id, f);
  }
  for (const f of Object.values(figures)) for (const i of f.illustrates || []) if (nodes[i] && !(figuresFor[i] || []).includes(f.id)) push(figuresFor, i, f.id);
  for (const a of Object.values(apps)) for (const c of a.connects || []) if (nodes[c]) { push(appsFor, c, a.id); edges.push({ source: a.id, target: c, kind: "app" }); }
  for (const q of Object.values(quiz)) for (const c of q.about || []) if (nodes[c]) push(quizFor, c, q.id);
  for (const k in usedBy) usedBy[k] = [...new Set(usedBy[k])].sort((a, b) => nodes[a].seq - nodes[b].seq);

  const prereqs = (id: string) => { const n = nodes[id]; return [...new Set<string>([...(n.uses || []), ...stepUses(n)])].filter(u => nodes[u] && u !== id); };
  const pathCache: Record<string, string[]> = {};
  function learningPath(id: string): string[] {
    if (pathCache[id]) return pathCache[id];
    const seen = new Set<string>(), stack = [id];
    while (stack.length) { const v = stack.pop()!; for (const u of prereqs(v)) if (!seen.has(u) && u !== id) { seen.add(u); stack.push(u); } }
    const indeg: Record<string, number> = {}, out: Record<string, string[]> = {};
    for (const v of seen) { indeg[v] = 0; out[v] = []; }
    for (const v of seen) for (const u of prereqs(v)) if (seen.has(u)) { indeg[v]++; out[u].push(v); }
    const cmp = (a: string, b: string) => topicOrder(a) - topicOrder(b) || rank(a) - rank(b) || a.localeCompare(b);
    const ready = [...seen].filter(v => indeg[v] === 0).sort(cmp), res: string[] = [];
    while (ready.length) { const v = ready.shift()!; res.push(v); for (const x of out[v]) if (--indeg[x] === 0) { ready.push(x); ready.sort(cmp); } }
    if (res.length < seen.size) for (const v of seen) if (!res.includes(v)) res.push(v);
    return (pathCache[id] = res);
  }

  const W = { title: 5, terms: 4, aliases: 3, tags: 2, statement: 1 };
  const index = new Map<string, Map<string, number>>();
  const add = (tok: string, id: string, w: number) => { let m = index.get(tok); if (!m) index.set(tok, m = new Map()); m.set(id, Math.max(m.get(id) || 0, w)); };
  for (const n of Object.values(nodes)) {
    tokenize(n.title).forEach(t => add(t, n.id, W.title));
    (n.terms || []).forEach((x: any) => tokenize([x.term, x.alt].join(" ")).forEach(t => add(t, n.id, W.terms)));
    tokenize((n.aliases || []).join(" ")).forEach(t => add(t, n.id, W.aliases));
    tokenize((n.tags || []).join(" ")).forEach(t => add(t, n.id, W.tags));
    tokenize(n.statement).forEach(t => add(t, n.id, W.statement));
    tokenize(n.id.split(".")[1]?.replace(/-/g, " ")).forEach(t => add(t, n.id, W.aliases));
  }
  for (const a of Object.values(apps)) { tokenize(a.title).forEach(t => add(t, a.id, W.title)); tokenize(a.summary).forEach(t => add(t, a.id, 1)); }

  const checkResults: Graph["checkResults"] = [];
  for (const q of Object.values(quiz)) if (q.check?.verifier === "expr") {
    try { const v = evalExpr(q.check.expr); const want = q.kind === "mcq" ? numberIn(q.options[q.answer]) : numberIn(q.answer);
      checkResults.push({ id: q.id, ok: v === want, detail: `${q.check.expr} = ${v}, stated ${want}` }); }
    catch (e) { checkResults.push({ id: q.id, ok: false, detail: (e as Error).message }); }
  }
  for (const n of Object.values(nodes)) for (const c of n.checks || []) if (c.verifier === "expr") {
    try { const v = evalExpr(c.expr); checkResults.push({ id: n.id, ok: v === c.expect, detail: `${c.expr} = ${v}, expected ${c.expect}` }); }
    catch (e) { checkResults.push({ id: n.id, ok: false, detail: (e as Error).message }); }
  }

  const warnings: Graph["warnings"] = [];
  for (const n of Object.values(nodes)) {
    if (!n.explanation) warnings.push({ id: n.id, msg: "No explanation" });
    if (!(n.uses || []).length && !usedBy[n.id] && !(n.relations || []).length && !relatedFrom[n.id]) warnings.push({ id: n.id, msg: "Orphan node: no incoming or outgoing edges" });
    if (typeOf(n.id)?.needsProof && !n.proof) warnings.push({ id: n.id, msg: "Missing proof" });
    for (const u of n.uses || []) if (!nodes[u] && !reserved[u]) warnings.push({ id: n.id, msg: `Unresolved prerequisite ${u}` });
  }
  for (const q of Object.values(quiz)) if (!(q.about || []).length) warnings.push({ id: q.id, msg: "Quiz item without about" });
  for (const f of Object.values(figures)) if (!(f.illustrates || []).length) warnings.push({ id: f.id, msg: "Figure without illustrates" });

  return { cfg, topics, topicById, nodes, figures, apps, quiz, reserved, usedBy, relatedFrom, appsFor, quizFor, figuresFor, edges,
    learningPath, prereqs, index, vocab: [...index.keys()], checkResults, warnings, demotions: course.demotions || [], typeOf, rank };
}
