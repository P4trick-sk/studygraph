/** Input normalisation: bundles, flat knowledge.json (Temno v0b, Diskrétka v0a, builds) and loose files → CourseBundle. */
import type { CourseBundle, TopicFile } from "../schema/index.js";
import { PRESETS } from "./presets.js";

type Json = Record<string, any>;

/** In-memory v0 → v1 fixes for one topic file. */
export function migrateTopic(t: Json, warnings: string[]): TopicFile {
  const out: Json = { schemaVersion: 1, meta: { ...(t.meta || {}) }, nodes: [], figures: [], applications: [], quiz: [] };
  for (const n0 of t.nodes || []) {
    const n: Json = { terms: [], aliases: [], tags: [], uses: [], relations: [], figures: [], ...n0 };
    n.terms = (n.terms || []).map((x: any) => typeof x === "string" ? { term: x }
      : ("sk" in x || "en" in x) && !("term" in x) ? { term: x.sk ?? x.en, ...(x.sk && x.en ? { alt: x.en } : {}), ...(x.symbol ? { symbol: x.symbol } : {}) } : x);
    n.review = { status: "draft", notes: [], ...(n.review || {}) };
    if (n.proof) n.proof = { steps: [], ...n.proof };
    if (n.explanation) n.explanation = { intuition: "", detailed: "", pitfalls: "", examples: "", ...n.explanation };
    delete n.derived;
    out.nodes.push(n);
  }
  for (const f0 of t.figures || []) {
    const f: Json = { illustrates: [], sources: [], ...f0 };
    if (!f.kind) f.kind = f.vertices ? "graph" : f.rows ? "table" : f.code ? "code" : "graph";
    if (typeof f.source === "string") { if (!f.code) f.code = f.source; delete f.source; }
    else if (Array.isArray(f.source)) { if (!f0.sources) f.sources = f.source; delete f.source; }
    out.figures.push(f);
  }
  out.applications = (t.applications || []).map((a: Json) => { const { __topic, ...rest } = a; return { connects: [], figures: [], tags: [], ...rest }; });
  out.quiz = (t.quiz || []).map((q: Json) => ({ about: [], difficulty: 1, ...q }));
  if (!out.meta.id) warnings.push("A topic file had no meta.id and was skipped.");
  return out as TopicFile;
}

/** Accepts: a bundle {config, registry, topics: [topicFile]}; loose files; or a flat knowledge.json. */
export function assembleCourse(files: unknown[]): CourseBundle {
  const warnings: string[] = []; let config: Json | null = null, registry: Json | null = null, demotions: any[] = [];
  const topics: Json[] = [];
  const takeFlat = (j: Json) => {
    const metas: Json[] = j.topics || []; const by: Record<string, Json> = {};
    for (const m of metas) by[m.id] = { meta: m, nodes: [], figures: [], applications: [], quiz: [] };
    const bucket = (id: string) => by[id] || (by[id] = { meta: { id, title: id, order: 99 }, nodes: [], figures: [], applications: [], quiz: [] });
    j.nodes.forEach((n: Json) => bucket(n.topic).nodes.push(n));
    const nodeTopic: Record<string, string> = Object.fromEntries(j.nodes.map((n: Json) => [n.id, n.topic]));
    const guess = (x: Json) => x.topic || x.__topic || nodeTopic[(x.illustrates || x.connects || x.about || [])[0]] || metas[0]?.id;
    (j.figures || []).forEach((f: Json) => bucket(guess(f)).figures.push(f));
    (j.applications || []).forEach((a: Json) => bucket(guess(a)).applications.push(a));
    (j.quiz || []).forEach((q: Json) => bucket(guess(q)).quiz.push(q));
    if (j.config) config = j.config;
    registry = { topics: metas, reserved: j.reserved || j.pending || [] };
    if (j.demotions) demotions = j.demotions;
    Object.values(by).forEach(t => topics.push(t));
  };
  const take = (j: unknown): void => {
    if (!j || typeof j !== "object") return;
    if (Array.isArray(j)) { j.forEach(take); return; }
    const o = j as Json;
    if (Array.isArray(o.nodes) && !o.meta) return takeFlat(o);
    if (o.config || (Array.isArray(o.topics) && o.topics[0]?.nodes)) {
      if (o.config) config = o.config; if (o.registry) registry = o.registry; if (o.demotions) demotions = o.demotions;
      (o.topics || []).forEach(take); return;
    }
    if (o.nodes && o.meta) { topics.push(o); return; }
    if (o.nodeTypes || o.app || o.preset) { config = o; return; }
    if (o.topics && !o.nodes) { registry = o; return; }
    warnings.push("One file did not look like a Studygraph topic, registry or config and was ignored.");
  };
  files.forEach(take);
  if (!topics.length) throw new Error("No topic files found. Choose a course bundle, a knowledge.json, or the topic JSON files of a course.");
  const migrated = topics.map(t => migrateTopic(t, warnings)).filter(t => t.meta.id);
  if (!config) {
    const types = [...new Set(migrated.flatMap(t => t.nodes.map(n => n.type)))];
    const sample = migrated.slice(0, 5).flatMap(t => t.nodes.slice(0, 20).map(n => n.statement || "")).join(" ");
    const skish = (sample.match(/[áäčďéíĺľňóôŕšťúýž]/gi) || []).length / Math.max(1, sample.length) > 0.02;
    config = { preset: "math", app: { name: "Course" }, ...(skish ? { language: { primary: "sk", alt: "en", ui: "sk" } } : {}) };
    const known = new Set(PRESETS.math.types.map(x => x[0]));
    if (types.some(x => !known.has(x))) warnings.push("No config file was included, so unknown node types use default colours.");
  }
  return { config: config as any, registry: (registry || { topics: [], reserved: [] }) as any, topics: migrated, warnings, demotions };
}
