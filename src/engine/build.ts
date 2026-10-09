/**
 * `studygraph build`: validate, then write the static app.
 *   default    dist/index.html + dist/knowledge.json (+ .nojekyll) — a standalone site for any static host
 *   --single   dist/index.html with the course inside (opens from disk; publishable as one artifact)
 *   --viewer   the core viewer: opens any course file; the course is its built-in sample
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CourseBundle } from "../schema/index.js";
import { resolveConfig } from "../core/presets.js";
import { loadWorkspace, readJson, writeJson, type Workspace } from "./workspace.js";
import { validate } from "./validate.js";
import { PKG_ROOT, ENGINE_VERSION } from "./paths.js";

export interface BuildOptions { out?: string; single?: boolean; viewer?: boolean; allowErrors?: boolean; allowOpen?: boolean }

export function bundleOf(ws: Workspace): CourseBundle {
  const reg = Object.fromEntries(ws.registry.topics.map(t => [t.id, t]));
  const dem = join(ws.root, ".sg", "demotions.json");
  return {
    schemaVersion: 1, config: { ...ws.config, engine: ENGINE_VERSION } as any,
    registry: { topics: ws.topics.map(t => ({ ...reg[t.meta.id], ...t.meta })), reserved: ws.registry.reserved.filter(r => !(r.id in ws.nodes)) },
    topics: ws.topics.map(t => ({ ...t, meta: { ...reg[t.meta.id], ...t.meta } })) as any,
    demotions: existsSync(dem) ? readJson(dem) : [],
  };
}

export function courseFile(ws: Workspace) {
  const b = bundleOf(ws);
  const nodes = b.topics.flatMap(t => t.nodes.map(n => ({ ...n, topic: t.meta.id })));
  const figures = b.topics.flatMap(t => t.figures.map(f => ({ ...f, topic: t.meta.id })));
  const applications = b.topics.flatMap(t => t.applications.map(a => ({ ...a, topic: t.meta.id })));
  const quiz = b.topics.flatMap(t => t.quiz.map(q => ({ ...q, topic: t.meta.id })));
  const byType: Record<string, number> = {}, review: Record<string, number> = {};
  for (const n of nodes) { byType[n.type] = (byType[n.type] || 0) + 1; const s = (n.review as any)?.status || "draft"; review[s] = (review[s] || 0) + 1; }
  const edges = nodes.reduce((s, n) => s + (n.uses || []).length + (n.relations || []).length, 0) + applications.reduce((s, a) => s + (a.connects || []).length, 0);
  const stats = { topics: b.topics.length, nodes: nodes.length, figures: figures.length, applications: applications.length, quiz: quiz.length, edges, byType, review,
    perTopic: Object.fromEntries(b.topics.map(t => [t.meta.id, t.nodes.length])) };
  return { generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"), schemaVersion: 1, engine: ENGINE_VERSION, config: b.config,
    topics: b.registry.topics, nodes, figures, applications, quiz, reserved: b.registry.reserved, pending: b.registry.reserved, demotions: b.demotions, stats };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Assemble the page from the shipped template, app bundle and stylesheet. */
export function renderPage(cfg: any, boot: Record<string, unknown>): string {
  const app = join(PKG_ROOT, "lib", "app");
  if (!existsSync(join(app, "app.js"))) throw new Error("studygraph is not built (lib/app/app.js missing): run npm run build in the studygraph package");
  const r = resolveConfig(cfg);
  const tpl = readFileSync(join(PKG_ROOT, "app-template", "index.html"), "utf8");
  const fill: Record<string, string> = {
    LANG: r.language.ui, TITLE: esc(r.app.brand === r.app.title ? r.app.title : `${r.app.brand} – ${r.app.title}`),
    DESCRIPTION: esc(String(r.app.tagline || r.app.kicker || "")), ENGINE: ENGINE_VERSION,
    CSS: readFileSync(join(app, "style.css"), "utf8"), BOOT: safeJson({ engine: ENGINE_VERSION, ...boot }),
    APP: readFileSync(join(app, "app.js"), "utf8").replace(/<\/script/gi, "<\\/script"),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => fill[k] ?? "");
}

export function build(root: string, opts: BuildOptions = {}) {
  const v = validate(root);
  if (v.errors.length && !opts.allowErrors) return { ok: false as const, validation: v };
  const ws = v.ws;
  const out = resolve(root, opts.out || "dist");
  mkdirSync(out, { recursive: true });
  const kf = courseFile(ws);
  writeJson(join(out, "knowledge.json"), kf, true);
  writeJson(join(out, "stats.json"), kf.stats);
  const files: string[] = [join(out, "knowledge.json")];
  let boot: Record<string, unknown>;
  if (opts.viewer) boot = { mode: "viewer", course: bundleOf(ws), allowOpen: true };
  else if (opts.single) boot = { mode: "standalone", course: { ...bundleOf(ws), embedded: true }, allowOpen: !!opts.allowOpen };
  else boot = { mode: "standalone", courseUrl: "knowledge.json", allowOpen: !!opts.allowOpen };
  writeFileSync(join(out, "index.html"), renderPage(ws.config, boot));
  writeFileSync(join(out, ".nojekyll"), "");
  files.unshift(join(out, "index.html"));
  return { ok: true as const, validation: v, files: files.map(f => ({ path: f, size: statSync(f).size })), stats: kf.stats };
}
