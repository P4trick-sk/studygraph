/** A course workspace on disk: content/config.json, content/registry.json, content/topics/*.json. */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Config, Registry, TopicFile, type TopicFile as TTopicFile, type Config as TConfig, type Registry as TRegistry } from "../schema/index.js";
import { relationTypesFor } from "../core/presets.js";

export const readJson = (p: string): any => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p: string, v: unknown, compact = false) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, compact ? undefined : 1) + (compact ? "" : "\n")); };

export interface Workspace {
  root: string; config: TConfig; registry: TRegistry;
  files: Map<string, TTopicFile>;       // path → topic file (as on disk, parsed with defaults)
  topics: TTopicFile[];                 // sorted by registry order
  nodes: Record<string, any>; figures: Record<string, any>; apps: Record<string, any>; quiz: Record<string, any>;
  pos: Record<string, [number, number]>;
  types: Record<string, any>; relations: Set<string>; reserved: Record<string, any>;
  parseErrors: Array<{ file: string; msg: string }>;
  isRefType(t: string): boolean; rank(id: string): number; deps(n: any): Set<string>;
  save(path: string): void; fileOf(nodeId: string): string | undefined;
}

export function contentDir(root: string) { return join(root, "content"); }

export function loadWorkspace(root: string): Workspace {
  const c = contentDir(root);
  if (!existsSync(join(c, "config.json"))) throw new Error(`${root} is not a course: content/config.json is missing (run studygraph init)`);
  const parseErrors: Workspace["parseErrors"] = [];
  const parse = <T>(schema: { safeParse(v: unknown): any }, v: unknown, file: string): T => {
    const r = schema.safeParse(v);
    if (r.success) return r.data as T;
    for (const i of r.error.issues.slice(0, 20)) parseErrors.push({ file, msg: `${i.path.join(".")}: ${i.message}` });
    return v as T;
  };
  const config = parse<TConfig>(Config, readJson(join(c, "config.json")), "content/config.json");
  const registry = parse<TRegistry>(Registry, existsSync(join(c, "registry.json")) ? readJson(join(c, "registry.json")) : { topics: [], reserved: [] }, "content/registry.json");
  const files = new Map<string, TTopicFile>();
  const tdir = join(c, "topics");
  if (existsSync(tdir)) for (const f of readdirSync(tdir).filter(f => f.endsWith(".json")).sort()) {
    const p = join(tdir, f); files.set(p, parse<TTopicFile>(TopicFile, readJson(p), `content/topics/${f}`));
  }
  const order: Record<string, number> = Object.fromEntries(registry.topics.map(t => [t.id, t.order ?? 99]));
  const topics = [...files.values()].sort((a, b) => (order[a.meta.id] ?? a.meta.order ?? 99) - (order[b.meta.id] ?? b.meta.order ?? 99) || a.meta.id.localeCompare(b.meta.id));
  const nodes: Record<string, any> = {}, figures: Record<string, any> = {}, apps: Record<string, any> = {}, quiz: Record<string, any> = {}, pos: Workspace["pos"] = {};
  for (const d of topics) {
    const tid = d.meta.id;
    d.nodes.forEach((n, i) => { (n as any).topic ??= tid; nodes[n.id] = n; pos[n.id] = [order[tid] ?? d.meta.order ?? 99, i]; });
    for (const f of d.figures) figures[f.id] = { ...f, topic: tid };
    for (const a of d.applications) apps[a.id] = { ...a, topic: tid };
    for (const q of d.quiz) quiz[q.id] = { ...q, topic: tid };
  }
  const types: Record<string, any> = Object.fromEntries(config.nodeTypes.map(t => [t.type, t]));
  const relations = new Set(config.relationTypes?.length ? config.relationTypes : relationTypesFor(config.preset));
  const reserved: Record<string, any> = Object.fromEntries(registry.reserved.map(r => [r.id, r]));
  const isRefType = (t: string) => { const ty = types[t] || {}; return !!ty.reference || ty.rank === undefined || ty.rank === null || ty.rank >= 4; };
  const ws: Workspace = {
    root, config, registry, files, topics, nodes, figures, apps, quiz, pos, types, relations, reserved, parseErrors,
    isRefType,
    rank: (id: string) => isRefType(nodes[id].type) ? 4 : (types[nodes[id].type]?.rank ?? 4),
    deps: (n: any) => { const s = new Set<string>(n.uses || []); for (const st of n.proof?.steps || []) for (const u of st.uses || []) s.add(u); s.delete(n.id); return new Set([...s].filter(x => x in nodes)); },
    save: (p: string) => writeJson(p, files.get(p)),
    fileOf: (id: string) => [...files.entries()].find(([, d]) => d.nodes.some(n => n.id === id))?.[0],
  };
  return ws;
}

/** Strongly connected components (size > 1) of the prerequisite graph. */
export function cycles(ws: Workspace): Array<Set<string>> {
  const idx: Record<string, number> = {}, low: Record<string, number> = {}, on = new Set<string>(), st: string[] = [], out: Array<Set<string>> = [];
  let c = 0;
  const go = (v: string) => {
    idx[v] = low[v] = c++; st.push(v); on.add(v);
    for (const w of ws.deps(ws.nodes[v])) {
      if (!(w in idx)) { go(w); low[v] = Math.min(low[v], low[w]); }
      else if (on.has(w)) low[v] = Math.min(low[v], idx[w]);
    }
    if (low[v] === idx[v]) { const comp = new Set<string>(); let w: string; do { w = st.pop()!; on.delete(w); comp.add(w); } while (w !== v); if (comp.size > 1) out.push(comp); }
  };
  for (const v of Object.keys(ws.nodes)) if (!(v in idx)) go(v);
  return out;
}
