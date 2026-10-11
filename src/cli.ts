/** studygraph command line. Run `studygraph help` for the list. */
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { validate } from "./engine/validate.js";
import { breakCycles } from "./engine/cycles.js";
import { suggestLinks, rejectSuggestion } from "./engine/links.js";
import { build } from "./engine/build.js";
import { importCourse } from "./engine/importer.js";
import { ingest } from "./engine/ingest.js";
import { init } from "./engine/init.js";
import { migrate } from "./engine/migrate.js";
import { upgrade } from "./engine/upgrade.js";
import { applyReview } from "./engine/review.js";
import { serve } from "./engine/serve.js";
import { ENGINE_VERSION } from "./engine/paths.js";

const HELP = `studygraph ${ENGINE_VERSION}

Course repo commands (run inside a course, or pass the course directory):
  init <dir> --name N --title T [--kicker K] [--lead L] [--preset math|cs-theory|programming]
             [--lang sk] [--alt en] [--ui sk] [--course "A:Title"]… [--figures graph,table,plot] [--core <npm spec>]
  ingest [dir] [files…] [--images]   per-page text from PDF/PPTX/DOCX/MD into sources/text/
  validate [dir] [--topic ID] [--fix] [--json] [--no-katex]
  links [dir] [--topic ID] [--max N] | links [dir] --reject node:target
  cycles [dir] [--apply]
  build [dir] [--single] [--viewer] [--out dist] [--allow-errors] [--allow-open]
  serve [dir] [--port 8000]          serve dist/ (builds first with --build)
  review apply <patch.json> [dir]    fold a review patch exported from the app into the content
  import <knowledge.json> <dir>      turn an existing flat course file into a course repo
  migrate [dir] [--dry-run]          apply content migrations for this core's schema
  upgrade [dir] [--check] [--to X.Y.Z|latest] [--dry-run]
  version`;

const argv = process.argv.slice(2);
const cmd = argv[0] || "help";
const flags = new Map<string, string | true>(); const pos: string[] = []; const multi: Record<string, string[]> = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; flags.set(k, v); if (typeof v === "string") (multi[k] ||= []).push(v); }
  else pos.push(a);
}
const flag = (k: string) => flags.get(k);
const str = (k: string) => typeof flags.get(k) === "string" ? (flags.get(k) as string) : undefined;
const dirArg = (i = 0) => resolve(pos[i] || ".");
const print = (s: string) => process.stdout.write(s + "\n");

function report(v: ReturnType<typeof validate>, max = 200) {
  for (const e of v.errors) print(`ERROR ${e.id} – ${e.msg}`);
  for (const w of v.warnings.slice(0, max)) print(`warn  ${w.id} – ${w.msg}`);
  if (v.warnings.length > max) print(`… ${v.warnings.length - max} more warnings`);
  const c = v.counts;
  print(`${c.topics} topics, ${c.nodes} nodes, ${c.figures} figures, ${c.applications} applications, ${c.quiz} quiz | ${v.errors.length} errors, ${v.warnings.length} warnings${v.fixed ? ` | ${v.fixed} fixes saved` : ""}`);
}

try {
  switch (cmd) {
    case "init": {
      const dir = dirArg(); if (!str("name") || !str("title")) throw new Error("init needs --name and --title");
      const r = init(dir, { name: str("name")!, title: str("title")!, kicker: str("kicker"), lead: str("lead"), preset: str("preset"), lang: str("lang"), alt: str("alt"), ui: str("ui"),
        courses: (multi.course || []).map(c => { const [id, ...t] = c.split(":"); return { id, title: t.join(":") || id }; }), figures: str("figures")?.split(","), copyright: str("copyright"), core: str("core") });
      print(`created course ${r.courseId} in ${r.dir}\ncore dependency: ${r.core}\nnext: npm install, put materials in sources/, studygraph ingest`);
      break;
    }
    case "ingest": { const root = dirArg(); for (const r of ingest(root, pos.slice(1).map(p => resolve(p)), { images: !!flag("images") })) print(`${r.file}: ${r.pages} pages, ${r.flagged.length} with garbled maths ${r.flagged.slice(0, 15).join(",")}`); break; }
    case "validate": {
      const v = validate(dirArg(), { topic: str("topic"), fix: !!flag("fix"), katex: !flag("no-katex") });
      if (flag("json")) print(JSON.stringify({ errors: v.errors, warnings: v.warnings, counts: v.counts }, null, 1)); else report(v);
      process.exitCode = v.errors.length ? 1 : 0; break;
    }
    case "links": {
      const root = dirArg();
      if (str("reject")) { rejectSuggestion(root, str("reject")!); print("rejected " + str("reject")); break; }
      const r = suggestLinks(root, { topic: str("topic") });
      if (r.generic.length) print(`skipped ${r.generic.length} generic targets (suggested more than ${r.limit}×); consider config.linkIgnore: ${r.generic.slice(0, 15).join(", ")}${r.generic.length > 15 ? " …" : ""}`);
      for (const s of r.suggestions.slice(0, Number(str("max") || 400))) print(`${s.node.padEnd(40)} ${s.field.padEnd(28)} "${s.text}" -> ${s.target}`);
      print(`${r.suggestions.length} suggestions written to .sg/links.json`); break;
    }
    case "cycles": {
      const r = breakCycles(dirArg(), !!flag("apply"));
      for (const d of r.demoted) print(`demote ${d.source} -> ${d.target}  (${d.reason})`);
      print(`${r.demoted.length} demotions, ${r.left} cycles left${flag("apply") ? "" : " (dry run; --apply to save)"}`); process.exitCode = r.left ? 1 : 0; break;
    }
    case "build": {
      const r = build(dirArg(), { out: str("out"), single: !!flag("single"), viewer: !!flag("viewer"), allowErrors: !!flag("allow-errors"), allowOpen: !!flag("allow-open") });
      if (!r.ok) { report(r.validation, 0); throw new Error("validation failed: fix the errors (or --allow-errors for a draft build)"); }
      const s = r.stats;
      for (const f of r.files) print(`wrote ${f.path} (${(f.size / 1e6).toFixed(2)} MB)`);
      print(`${s.topics} topics, ${s.nodes} nodes, ${s.figures} figures, ${s.applications} applications, ${s.quiz} quiz, ${s.edges} edges`);
      break;
    }
    case "serve": {
      const root = dirArg();
      if (flag("build")) { const r = build(root); if (!r.ok) throw new Error("validation failed"); }
      const dist = existsSync(join(root, "dist", "index.html")) ? join(root, "dist") : root;
      serve(dist, Number(str("port") || 8000)); break;
    }
    case "review": {
      if (pos[0] !== "apply" || !pos[1]) throw new Error("usage: studygraph review apply <patch.json> [dir]");
      const r = applyReview(resolve(pos[2] || "."), resolve(pos[1]));
      print(`applied ${r.applied} verdicts${r.missing.length ? `; not found: ${r.missing.join(", ")}` : ""}`); break;
    }
    case "import": { if (pos.length < 2) throw new Error("usage: studygraph import <knowledge.json> <dir>"); const r = importCourse(resolve(pos[0]), resolve(pos[1])); print(`imported ${r.topics} topics, ${r.nodes} nodes into ${pos[1]}`); break; }
    case "migrate": { const r = migrate(dirArg(), !!flag("dry-run")); print(`schema ${r.schema}; ${r.applied.length ? r.applied.join("; ") : "no content migrations needed"}; engine ${r.engineBefore || "?"} → ${r.engine}`); break; }
    case "upgrade": {
      const r: any = upgrade(dirArg(), { check: !!flag("check"), to: str("to"), dryRun: !!flag("dry-run") });
      if (flag("check")) print(r.latest ? (r.available ? `studygraph ${r.latest} is available (installed ${r.installed}): run studygraph upgrade` : `up to date (${r.installed})`) : `installed ${r.installed}; no release tags found for ${r.spec}`);
      else print(`core ${r.spec} → ${r.next}${r.latest ? ` (latest release ${r.latest})` : ""}`);
      break;
    }
    case "version": case "--version": case "-v": print(ENGINE_VERSION); break;
    default: print(HELP);
  }
} catch (e) { process.stderr.write(`studygraph: ${(e as Error).message}\n`); process.exitCode = 1; }
