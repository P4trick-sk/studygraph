/** `studygraph import`: an existing flat knowledge.json (Temno, Diskrétka, a build) → course workspace. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { assembleCourse } from "../core/assemble.js";
import { presetNodeTypes, relationTypesFor, courseIdOf } from "../core/presets.js";
import { readJson, writeJson } from "./workspace.js";
import { ENGINE_VERSION } from "./paths.js";

export function importCourse(file: string, root: string) {
  const raw = readJson(file);
  const b = assembleCourse([raw]);
  const cfg: any = { schemaVersion: 1, engine: ENGINE_VERSION, ...(b.config || {}) };
  const ui = cfg.language?.ui || "en";
  cfg.preset ||= "math";
  cfg.app = { name: "Course", ...(cfg.app || {}) }; cfg.app.courseId ||= courseIdOf(cfg.app.name);
  cfg.nodeTypes = (cfg.nodeTypes?.length ? cfg.nodeTypes : presetNodeTypes(cfg.preset, ui)).map((t: any) => ({ ...t, type: t.type || t.id, ...(t.reference ? { rank: 4 } : {}) }));
  cfg.relationTypes ||= relationTypesFor(cfg.preset);
  cfg.courses ||= [...new Set(b.topics.map(t => t.meta.course || "A"))].map(id => ({ id, title: id }));
  cfg.figureKinds ||= ["graph", "table", "plot", "mermaid", "code"];
  for (const d of ["content/topics", "sources/text", "docs/outlines", "docs/tasks", ".sg/scratch"]) mkdirSync(join(root, d), { recursive: true });
  writeJson(join(root, "content", "config.json"), cfg);
  writeJson(join(root, "content", "registry.json"), { schemaVersion: 1,
    topics: b.registry.topics.map((t: any) => ({ id: t.id, title: t.title, course: t.course, order: t.order, sourceFiles: t.sourceFiles || [], status: t.status || "draft" })),
    reserved: b.registry.reserved || [] });
  for (const t of b.topics) {
    const strip = (x: any) => { const { topic, __topic, ...rest } = x; return rest; };
    writeJson(join(root, "content", "topics", `${t.meta.id}.json`), { schemaVersion: 1, meta: t.meta, nodes: t.nodes, figures: t.figures.map(strip), applications: t.applications.map(strip), quiz: t.quiz.map(strip) });
  }
  if (b.demotions?.length) writeJson(join(root, ".sg", "demotions.json"), b.demotions);
  return { topics: b.topics.length, nodes: b.topics.reduce((s, t) => s + t.nodes.length, 0) };
}
