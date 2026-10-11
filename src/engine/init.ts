/** `studygraph init <dir>`: a new course repo from the template — content/ is the only thing that will differ between apps. */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { presetNodeTypes, relationTypesFor, PRESETS, APP_COLOR, courseIdOf } from "../core/presets.js";
import { writeJson } from "./workspace.js";
import { PKG_ROOT, ENGINE_VERSION } from "./paths.js";

export interface InitOptions {
  name: string; title: string; kicker?: string; lead?: string; preset?: string; lang?: string; alt?: string; ui?: string;
  courses?: Array<{ id: string; title: string }>; figures?: string[]; copyright?: string;
  /** npm spec for the core, e.g. github:you/studygraph#semver:^1.0.0 or file:../studygraph */
  core?: string;
}

function copyTemplate(dir: string, vars: Record<string, string>) {
  const tpl = join(PKG_ROOT, "template");
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else {
    const rel = relative(tpl, p).replace(/^_/, ".").replace(/[/\\]_/g, m => m[0] + ".");
    const dest = join(dir, rel); if (existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(p, "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ""));
  } } };
  walk(tpl);
}

export function init(dir: string, o: InitOptions) {
  if (existsSync(join(dir, "content", "config.json"))) throw new Error(`${dir} already has content/config.json`);
  const preset = o.preset && PRESETS[o.preset] ? o.preset : "math";
  const lang = o.lang || "en", ui = o.ui || (lang === "sk" ? "sk" : "en");
  const courseId = courseIdOf(o.name);
  const core = o.core || `github:P4trick-sk/studygraph#semver:^${ENGINE_VERSION.split(".")[0]}.0.0`;
  for (const d of ["content/topics", "sources", "docs/outlines", "docs/tasks", ".sg/scratch"]) mkdirSync(join(dir, d), { recursive: true });
  copyTemplate(dir, { NAME: o.name, SLUG: courseId, TITLE: o.title, CORE: core, ENGINE: ENGINE_VERSION });
  writeJson(join(dir, "content", "config.json"), {
    schemaVersion: 1, engine: ENGINE_VERSION, preset,
    app: { name: o.name, courseId, tagline: o.kicker || "", heroTitle: o.title, heroText: o.lead || "", copyright: o.copyright || "" },
    language: { primary: lang, alt: o.alt || "", ui },
    courses: o.courses?.length ? o.courses : [{ id: "A", title: o.kicker || o.title }],
    nodeTypes: presetNodeTypes(preset, ui), applicationColor: APP_COLOR,
    proofLabel: PRESETS[preset].proofLabel[ui === "sk" ? "sk" : "en"],
    figureKinds: o.figures?.length ? o.figures : PRESETS[preset].figureKinds,
    relationTypes: relationTypesFor(preset), linkIgnore: [],
  });
  writeJson(join(dir, "content", "registry.json"), { schemaVersion: 1, topics: [], reserved: [] });
  if (!existsSync(join(dir, "docs", "QUESTIONS.md"))) writeFileSync(join(dir, "docs", "QUESTIONS.md"), "# Questions for the lecturer\n\n");
  return { dir, courseId, core };
}
