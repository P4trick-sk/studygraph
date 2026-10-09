/**
 * Content migrations between schema versions. Each core release that changes the schema adds an entry here;
 * `studygraph migrate` (run by `upgrade`) applies the ones a course still needs and records the engine version.
 */
import { join } from "node:path";
import { SCHEMA_VERSION } from "../schema/index.js";
import { readJson, writeJson } from "./workspace.js";
import { readdirSync, existsSync } from "node:fs";
import { ENGINE_VERSION } from "./paths.js";

export interface Migration { from: number; to: number; describe: string; run(files: { config: any; registry: any; topics: Record<string, any> }): void }

/** Registered migrations, oldest first. Schema 1 is the first version, so there are none yet. */
export const MIGRATIONS: Migration[] = [];

export function migrate(root: string, dryRun = false) {
  const c = join(root, "content");
  const config = readJson(join(c, "config.json"));
  const registry = existsSync(join(c, "registry.json")) ? readJson(join(c, "registry.json")) : { topics: [], reserved: [] };
  const topics: Record<string, any> = {};
  for (const f of readdirSync(join(c, "topics")).filter(f => f.endsWith(".json"))) topics[f] = readJson(join(c, "topics", f));
  let v: number = config.schemaVersion ?? 1; const applied: string[] = [];
  if (v > SCHEMA_VERSION) throw new Error(`content is schema ${v} but this core only knows ${SCHEMA_VERSION}: upgrade studygraph`);
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS.find(x => x.from === v); if (!m) throw new Error(`no migration from schema ${v}`);
    m.run({ config, registry, topics }); v = m.to; applied.push(`${m.from}→${m.to}: ${m.describe}`);
  }
  const before = config.engine;
  config.schemaVersion = v; config.engine = ENGINE_VERSION;
  for (const t of Object.values(topics)) t.schemaVersion = v;
  registry.schemaVersion = v;
  if (!dryRun) {
    writeJson(join(c, "config.json"), config); writeJson(join(c, "registry.json"), registry);
    if (applied.length) for (const [f, t] of Object.entries(topics)) writeJson(join(c, "topics", f), t);
  }
  return { applied, schema: v, engineBefore: before, engine: ENGINE_VERSION };
}
